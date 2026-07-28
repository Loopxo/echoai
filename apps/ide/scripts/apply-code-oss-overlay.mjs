import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const codeOssRef = '1.102.3';
const codeOssVersion = '1.102.3';
const codeOssDistro = '3f7b8d49abafb9a5f23350c4e65247ffd2b28a51';
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const targetArg = args.find((arg) => !arg.startsWith('--'));
const configuredTarget = targetArg ?? process.env.ECHOAI_CODE_OSS_PATH ?? `../../../vscode-${codeOssRef}`;
const targetRoot = path.resolve(projectRoot, configuredTarget);
const requiredPaths = [
  'package.json',
  'product.json',
  'gulpfile.mjs',
  'src',
  'resources',
  'extensions',
  'LICENSE.txt',
  'ThirdPartyNotices.txt',
];

const missing = [];
await recoverOverlayTransaction(targetRoot);
for (const relativePath of requiredPaths) {
  if (!(await pathExists(path.join(targetRoot, relativePath)))) {
    missing.push(relativePath);
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

  if (checkOnly) {
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
