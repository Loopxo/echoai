import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codeOssRef = '1.102.3';
const codeOssVersion = '1.102.3';
const codeOssDistro = '3f7b8d49abafb9a5f23350c4e65247ffd2b28a51';
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
// Source patches match exact text, so an edited patch definition no longer matches
// the already-patched file. `--restore-source` puts the pristine copies back so the
// next apply starts from upstream.
const restoreSource = args.includes('--restore-source');
// Declared here rather than beside `applyDesignLayer` because the top-level apply
// runs before later declarations are initialized.
const designMarkerStart = '<!-- echoai:design-system:start -->';
const designMarkerEnd = '<!-- echoai:design-system:end -->';
const targetArg = args.find((arg) => !arg.startsWith('--'));
const configuredTarget = targetArg ?? process.env.ECHOAI_CODE_OSS_PATH ?? `../../../vscode-${codeOssRef}`;
const targetRoot = path.resolve(projectRoot, configuredTarget);
// Each entry lists the accepted spellings of one required base artifact. The build
// entry point is `gulpfile.js` on Code-OSS 1.102.x and `gulpfile.mjs` on newer refs,
// so accept either rather than pinning a spelling that contradicts `codeOssRef`.
const requiredPaths = [
  ['package.json'],
  ['product.json'],
  ['gulpfile.js', 'gulpfile.mjs'],
  ['src'],
  ['resources'],
  ['extensions'],
  ['LICENSE.txt'],
  ['ThirdPartyNotices.txt'],
];

const missing = [];
await recoverOverlayTransaction(targetRoot);
for (const candidates of requiredPaths) {
  const found = await Promise.all(
    candidates.map((relativePath) => pathExists(path.join(targetRoot, relativePath))),
  );
  if (!found.some(Boolean)) {
    missing.push(candidates.join(' or '));
  }
}

if (missing.length > 0) {
  console.error(`Cannot prepare Echo AI IDE: Code-OSS base is incomplete at ${targetRoot}`);
  console.error(`Missing: ${missing.join(', ')}`);
  console.error(`Supply a complete microsoft/vscode ${codeOssRef} source tree, then run this command again.`);
  process.exitCode = 1;
} else {
  const baseManifest = JSON.parse(await fs.readFile(path.join(targetRoot, 'package.json'), 'utf8'));
  if (
    baseManifest.name !== 'code-oss-dev' ||
    baseManifest.version !== codeOssVersion ||
    baseManifest.distro !== codeOssDistro
  ) {
    throw new Error(
      `Unsupported Code-OSS base at ${targetRoot}. Expected microsoft/vscode ${codeOssRef} ` +
      `(${codeOssVersion}, ${codeOssDistro}), received ${String(baseManifest.name)} ` +
      `${String(baseManifest.version)} ${String(baseManifest.distro)}.`,
    );
  }

  const license = await fs.readFile(path.join(targetRoot, 'LICENSE.txt'), 'utf8');
  const notices = await fs.readFile(path.join(targetRoot, 'ThirdPartyNotices.txt'), 'utf8');
  if (!license.includes('MIT License') || !notices.trim()) {
    throw new Error('The editor base must retain its MIT license and third-party notices.');
  }

  if (restoreSource) {
    const restored = await restoreSourcePatches(targetRoot);
    console.log(
      restored.length > 0
        ? `Restored pristine Code-OSS sources: ${restored.join(', ')}`
        : 'No patched Code-OSS sources to restore.',
    );
  } else if (checkOnly) {
    console.log(`Code-OSS ${codeOssRef} base is complete and overlay-ready: ${targetRoot}`);
  } else {
    const sourcePaths = [
      'LICENSE',
      'package.json',
      'product/echo-product.json',
      'dist/extension.cjs',
      'dist/acp-server.mjs',
      'dist/licenses/THIRD_PARTY_NOTICES.json',
      'media/echoai.svg',
      'themes/echoai-dark.json',
      'design/echo-design.css',
      'design/fonts/JetBrainsMono-Regular.woff2',
      'design/fonts/JetBrainsMono-Bold.woff2',
      'design/fonts/JetBrainsMono-ExtraBold.woff2',
      'design/fonts/OFL.txt',
      '../../assets/echo-logo.png',
    ];
    const missingSources = [];
    for (const relativePath of sourcePaths) {
      if (!(await pathExists(path.join(projectRoot, relativePath)))) {
        missingSources.push(relativePath);
      }
    }
    if (missingSources.length > 0) {
      throw new Error(`Build the Echo AI IDE overlay first. Missing: ${missingSources.join(', ')}`);
    }

    const overlay = JSON.parse(await fs.readFile(path.join(projectRoot, 'product/echo-product.json'), 'utf8'));
    const productPath = path.join(targetRoot, 'product.json');
    const product = JSON.parse(await fs.readFile(productPath, 'utf8'));
    const sourceManifest = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));
    const {
      scripts: _scripts,
      dependencies: _dependencies,
      devDependencies: _devDependencies,
      private: _private,
      ...runtimeManifest
    } = sourceManifest;

    const packagedManifest = {
      ...runtimeManifest,
      icon: 'media/echoai.png',
    };
    const brandingSource = path.resolve(projectRoot, '../../assets/echo-logo.png');
    const extensionTarget = path.join(targetRoot, 'extensions/echoai');
    const stagingTarget = path.join(targetRoot, 'extensions/.echoai-staging');
    const backupTarget = path.join(targetRoot, 'extensions/.echoai-backup');
    const productTemp = `${productPath}.echoai.tmp`;
    const productBackup = `${productPath}.echoai.backup`;
    const transactionPath = path.join(targetRoot, '.echoai-overlay-transaction.json');
    let movedExistingExtension = false;

    await Promise.all([
      fs.rm(stagingTarget, { recursive: true, force: true }),
      fs.rm(backupTarget, { recursive: true, force: true }),
      fs.rm(productTemp, { force: true }),
      fs.rm(productBackup, { force: true }),
    ]);
    await fs.mkdir(stagingTarget, { recursive: true });

    try {
      await Promise.all([
        fs.writeFile(path.join(stagingTarget, 'package.json'), `${JSON.stringify(packagedManifest, null, 2)}\n`),
        fs.cp(path.join(projectRoot, 'dist'), path.join(stagingTarget, 'dist'), { recursive: true, force: true }),
        fs.cp(path.join(projectRoot, 'media'), path.join(stagingTarget, 'media'), { recursive: true, force: true }),
        fs.cp(path.join(projectRoot, 'themes'), path.join(stagingTarget, 'themes'), { recursive: true, force: true }),
        fs.copyFile(path.join(projectRoot, 'LICENSE'), path.join(stagingTarget, 'LICENSE')),
        fs.writeFile(productTemp, `${JSON.stringify({ ...product, ...overlay }, null, 2)}\n`),
      ]);
      await fs.copyFile(brandingSource, path.join(stagingTarget, 'media', 'echoai.png'));
      await fs.copyFile(productPath, productBackup);
      movedExistingExtension = await pathExists(extensionTarget);
      await writeOverlayTransaction(transactionPath, {
        version: 1,
        phase: 'applying',
        extensionExisted: movedExistingExtension,
      });

      if (movedExistingExtension) {
        await fs.rename(extensionTarget, backupTarget);
      }

      await fs.rename(stagingTarget, extensionTarget);
      await fs.rename(productTemp, productPath);
      await writeOverlayTransaction(transactionPath, {
        version: 1,
        phase: 'committed',
        extensionExisted: movedExistingExtension,
      });

      await Promise.all([
        fs.rm(backupTarget, { recursive: true, force: true }),
        fs.rm(productBackup, { force: true }),
      ]);
      await fs.rm(transactionPath, { force: true });
      console.log(`Applied Echo AI product identity and bundled extension to ${targetRoot}`);
      console.log('The editor and bundled dependency license notices were preserved.');

      const design = await applyDesignLayer(projectRoot, targetRoot);
      console.log(`Applied the Echo monochrome design layer (${design.join(', ')}).`);

      const patches = await applySourcePatches(targetRoot);
      console.log(
        `Applied ${patches.applied} source patch edit(s); ${patches.alreadyApplied} already present.`,
      );
      if (patches.applied > 0) {
        console.log('Recompile the editor to pick up the source patches: npm run compile-client');
      }
    } catch (error) {
      await recoverOverlayTransaction(targetRoot);
      throw error;
    } finally {
      await Promise.all([
        fs.rm(stagingTarget, { recursive: true, force: true }),
        fs.rm(productTemp, { force: true }),
      ]);
    }
  }
}

// A color theme can only set registered palette values. Zero border-radius, a
// bundled font family, the 52px activity rail, the 44px title bar and the
// inverted bands are structural, so they ship as a stylesheet linked from the
// workbench document instead.
//
// The stylesheet and fonts land under `src/vs/workbench/browser/media/`, which the
// Code-OSS build copies verbatim into `out/`, so a later recompile keeps them.
// `out/` is also mirrored directly when present so the design applies without
// waiting for a full rebuild.
//
// Every step is additive and idempotent: the document edit is fenced by a marker
// and the untouched original is preserved once, so re-running is always safe.
async function applyDesignLayer(projectRoot, targetRoot) {
  const applied = [];
  const mediaRelative = path.join('vs', 'workbench', 'browser', 'media');
  const roots = ['src'];
  if (await pathExists(path.join(targetRoot, 'out', mediaRelative))) {
    roots.push('out');
  }

  for (const root of roots) {
    const mediaDir = path.join(targetRoot, root, mediaRelative);
    await fs.mkdir(path.join(mediaDir, 'echo-fonts'), { recursive: true });
    await fs.copyFile(
      path.join(projectRoot, 'design/echo-design.css'),
      path.join(mediaDir, 'echo-design.css'),
    );
    await fs.cp(path.join(projectRoot, 'design/fonts'), path.join(mediaDir, 'echo-fonts'), {
      recursive: true,
      force: true,
    });
    applied.push(`${root}/${mediaRelative.split(path.sep).join('/')}`);
  }

  // Dev windows load `workbench-dev.html`; packaged windows load `workbench.html`.
  // See windowImpl.ts, which appends `-dev` whenever the app is not built.
  const documents = ['workbench.html', 'workbench-dev.html'];
  let patchedDocuments = 0;
  for (const root of roots) {
    for (const document of documents) {
      const documentPath = path.join(
        targetRoot,
        root,
        'vs/code/electron-browser/workbench',
        document,
      );
      if (!(await pathExists(documentPath))) {
        continue;
      }
      if (await linkDesignStylesheet(documentPath)) {
        patchedDocuments += 1;
      }
    }
  }
  applied.push(`${patchedDocuments} workbench document(s)`);
  return applied;
}

async function linkDesignStylesheet(documentPath) {
  const original = await fs.readFile(documentPath, 'utf8');
  const pristinePath = `${documentPath}.echo-original`;
  if (!(await pathExists(pristinePath)) && !original.includes(designMarkerStart)) {
    await fs.writeFile(pristinePath, original);
  }

  const block = [
    designMarkerStart,
    '\t\t<link rel="stylesheet" href="../../../workbench/browser/media/echo-design.css">',
    `\t\t${designMarkerEnd}`,
  ].join('\n\t\t');

  let next = original;
  const startIndex = next.indexOf(designMarkerStart);
  if (startIndex !== -1) {
    const endIndex = next.indexOf(designMarkerEnd);
    if (endIndex === -1) {
      throw new Error(`Unterminated Echo design block in ${documentPath}`);
    }
    next = next.slice(0, startIndex) + block.trimStart() + next.slice(endIndex + designMarkerEnd.length);
  } else {
    const headClose = next.indexOf('</head>');
    if (headClose === -1) {
      throw new Error(`Cannot link the Echo design system: no </head> in ${documentPath}`);
    }
    next = `${next.slice(0, headClose)}\t${block}\n\t${next.slice(headClose)}`;
  }

  if (next === original) {
    return false;
  }
  await fs.writeFile(documentPath, next);
  return true;
}

// The title bar palette copy and the trust dialog wording are TypeScript string
// literals, so they cannot be themed. Each edit is an exact match: if upstream
// moves a line the patch fails loudly instead of corrupting the file.
async function applySourcePatches(targetRoot) {
  const { sourcePatches } = await import('../design/source-patches.mjs');
  let applied = 0;
  let alreadyApplied = 0;

  for (const patch of sourcePatches) {
    const filePath = path.join(targetRoot, patch.file);
    if (!(await pathExists(filePath))) {
      throw new Error(`Cannot patch a missing Code-OSS file: ${patch.file}`);
    }

    const originalPath = `${filePath}.echo-original`;
    let contents = await fs.readFile(filePath, 'utf8');
    if (!(await pathExists(originalPath))) {
      await fs.writeFile(originalPath, contents);
    }

    let changed = false;
    for (const [index, edit] of patch.edits.entries()) {
      // Idempotency has two shapes and the order of these checks matters.
      //
      // An additive edit keeps its anchor (it inserts a line after it), so `find`
      // still matches after the patch and re-running would insert a duplicate. Those
      // edits declare an explicit `appliedMarker`, which is checked first.
      //
      // A deleting edit produces a `replace` that is a substring of `find`, so the
      // marker would always look present. Those are detected by testing `find`.
      if (edit.appliedMarker && contents.includes(edit.appliedMarker)) {
        alreadyApplied += 1;
        continue;
      }
      if (contents.includes(edit.find)) {
        contents = contents.replace(edit.find, edit.replace);
        changed = true;
        applied += 1;
        continue;
      }
      if (!edit.appliedMarker && contents.includes(edit.replace)) {
        alreadyApplied += 1;
        continue;
      }
      throw new Error(
        `Echo source patch ${patch.file} edit #${index + 1} did not match. ` +
        `The Code-OSS ${codeOssRef} source may differ from the pinned revision.`,
      );
    }

    if (changed) {
      await fs.writeFile(filePath, contents);
    }
  }

  return { applied, alreadyApplied };
}

async function restoreSourcePatches(targetRoot) {
  const { sourcePatches } = await import('../design/source-patches.mjs');
  const restored = [];
  for (const patch of sourcePatches) {
    const filePath = path.join(targetRoot, patch.file);
    const originalPath = `${filePath}.echo-original`;
    if (await pathExists(originalPath)) {
      await fs.copyFile(originalPath, filePath);
      await fs.rm(originalPath, { force: true });
      restored.push(patch.file);
    }
  }
  return restored;
}

async function pathExists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function writeOverlayTransaction(transactionPath, transaction) {
  const tempPath = `${transactionPath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(transaction, null, 2)}\n`);
  await fs.rename(tempPath, transactionPath);
}

async function recoverOverlayTransaction(root) {
  const transactionPath = path.join(root, '.echoai-overlay-transaction.json');
  const transactionTemp = `${transactionPath}.tmp`;
  if (!(await pathExists(transactionPath))) {
    await fs.rm(transactionTemp, { force: true });
    return;
  }

  const extensionTarget = path.join(root, 'extensions/echoai');
  const stagingTarget = path.join(root, 'extensions/.echoai-staging');
  const backupTarget = path.join(root, 'extensions/.echoai-backup');
  const productPath = path.join(root, 'product.json');
  const productTemp = `${productPath}.echoai.tmp`;
  const productBackup = `${productPath}.echoai.backup`;
  const transaction = JSON.parse(await fs.readFile(transactionPath, 'utf8'));

  if (
    transaction.version !== 1 ||
    (transaction.phase !== 'applying' && transaction.phase !== 'committed') ||
    typeof transaction.extensionExisted !== 'boolean'
  ) {
    throw new Error(`Cannot recover unknown Echo AI overlay transaction at ${transactionPath}`);
  }

  if (transaction.phase === 'committed') {
    await Promise.all([
      fs.rm(stagingTarget, { recursive: true, force: true }),
      fs.rm(backupTarget, { recursive: true, force: true }),
      fs.rm(productTemp, { force: true }),
      fs.rm(productBackup, { force: true }),
      fs.rm(transactionTemp, { force: true }),
    ]);
    await fs.rm(transactionPath, { force: true });
    return;
  }

  if (await pathExists(productBackup)) {
    await fs.copyFile(productBackup, productPath);
  }

  if (transaction.extensionExisted === true) {
    if (await pathExists(backupTarget)) {
      await fs.rm(extensionTarget, { recursive: true, force: true });
      await fs.rename(backupTarget, extensionTarget);
    } else if (!(await pathExists(extensionTarget))) {
      throw new Error('Cannot recover Echo AI overlay: both the original extension and its backup are missing.');
    }
  } else {
    await fs.rm(extensionTarget, { recursive: true, force: true });
  }

  await Promise.all([
    fs.rm(stagingTarget, { recursive: true, force: true }),
    fs.rm(productTemp, { force: true }),
    fs.rm(productBackup, { force: true }),
    fs.rm(transactionTemp, { force: true }),
  ]);
  await fs.rm(transactionPath, { force: true });
}
