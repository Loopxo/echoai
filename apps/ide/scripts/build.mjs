import { context } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(projectRoot, '../..');
const watch = process.argv.includes('--watch');
const outputRoot = path.join(projectRoot, 'dist');
const licenseRoot = path.join(outputRoot, 'licenses');

const sharedBuildOptions = {
  absWorkingDir: repositoryRoot,
  bundle: true,
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  sourcesContent: false,
  legalComments: 'linked',
  logLevel: 'info',
  metafile: true,
};

const extensionBuild = await context({
  ...sharedBuildOptions,
  entryPoints: [path.join(projectRoot, 'src/extension.ts')],
  outfile: path.join(outputRoot, 'extension.cjs'),
  format: 'cjs',
  external: ['vscode'],
});
// The runtime is bundled as ESM, but it pulls in CommonJS dependencies
// (commander, cosmiconfig, typescript) that call `require(...)` and read
// `__filename`/`__dirname` at runtime. esbuild's ESM output provides none of
// those, so its `__require` shim threw `Dynamic require of "events" is not
// supported` and the agent died before answering `initialize`. Re-create the
// CommonJS globals so the shim resolves through the real module loader.
const nodeCompatBanner = [
  "import { createRequire as __echoCreateRequire } from 'node:module';",
  "import { fileURLToPath as __echoFileURLToPath } from 'node:url';",
  "import { dirname as __echoDirname } from 'node:path';",
  'const require = __echoCreateRequire(import.meta.url);',
  'const __filename = __echoFileURLToPath(import.meta.url);',
  'const __dirname = __echoDirname(__filename);',
].join('\n');

const acpServerBuild = await context({
  ...sharedBuildOptions,
  entryPoints: [path.join(projectRoot, 'src/acp-server.mjs')],
  outfile: path.join(outputRoot, 'acp-server.mjs'),
  format: 'esm',
  banner: { js: nodeCompatBanner },
});
const builds = [extensionBuild, acpServerBuild];

try {
  const results = await Promise.all(builds.map((build) => build.rebuild()));
  await writeBundledDependencyNotices(results);

  if (watch) {
    await Promise.all(builds.map((build) => build.watch()));
    console.log('Echo AI IDE extension and bundled runtime are watching for changes.');
  }
} finally {
  if (!watch) {
    await Promise.all(builds.map((build) => build.dispose()));
  }
}

async function writeBundledDependencyNotices(results) {
  const packageRoots = new Map();
  for (const result of results) {
    for (const input of Object.keys(result.metafile?.inputs ?? {})) {
      const absoluteInput = path.isAbsolute(input) ? input : path.resolve(repositoryRoot, input);
      if (!absoluteInput.includes(`${path.sep}node_modules${path.sep}`)) continue;
      const packageInfo = await findPackageInfo(path.dirname(absoluteInput));
      if (packageInfo) {
        packageRoots.set(`${packageInfo.name}@${packageInfo.version}`, packageInfo);
      }
    }
  }

  await rm(licenseRoot, { recursive: true, force: true });
  await mkdir(licenseRoot, { recursive: true });

  const notices = [];
  for (const packageInfo of [...packageRoots.values()].sort((left, right) => left.name.localeCompare(right.name))) {
    const entries = await readdir(packageInfo.root, { withFileTypes: true });
    const licenseFiles = entries
      .filter((entry) => entry.isFile() && /^(licen[cs]e|copying|notice)([._-].+)?$/iu.test(entry.name))
      .map((entry) => entry.name)
      .sort();
    const prefix = sanitizeFileName(`${packageInfo.name}-${packageInfo.version}`);
    const bundledFiles = [];
    for (const licenseFile of licenseFiles) {
      const targetName = `${prefix}-${sanitizeFileName(licenseFile)}`;
      await copyFile(path.join(packageInfo.root, licenseFile), path.join(licenseRoot, targetName));
      bundledFiles.push(targetName);
    }
    notices.push({
      name: packageInfo.name,
      version: packageInfo.version,
      license: packageInfo.license,
      licenseFiles: bundledFiles,
    });
  }

  await writeFile(
    path.join(licenseRoot, 'THIRD_PARTY_NOTICES.json'),
    `${JSON.stringify({ generatedFrom: 'esbuild metafiles', packages: notices }, null, 2)}\n`,
  );
}

async function findPackageInfo(startDirectory) {
  let current = startDirectory;
  while (current !== path.dirname(current)) {
    const manifestPath = path.join(current, 'package.json');
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (typeof manifest.name === 'string' && manifest.name && typeof manifest.version === 'string') {
        return {
          root: current,
          name: manifest.name,
          version: manifest.version,
          license: normalizeLicense(manifest.license),
        };
      }
    } catch {
      // Continue toward the package root.
    }
    current = path.dirname(current);
  }
  return undefined;
}

function normalizeLicense(license) {
  if (typeof license === 'string') return license;
  if (license && typeof license === 'object' && typeof license.type === 'string') return license.type;
  return 'UNSPECIFIED';
}

function sanitizeFileName(value) {
  return value.replace(/^@/u, '').replace(/[^a-zA-Z0-9._-]+/gu, '-');
}
