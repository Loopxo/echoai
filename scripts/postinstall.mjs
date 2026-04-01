import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const packagesDir = path.join(rootDir, "packages");
const scopedPackagesDir = path.join(rootDir, "node_modules", "@echoai");
const rootNodeModulesDir = path.join(rootDir, "node_modules");
const pnpmStoreDir = path.join(rootNodeModulesDir, ".pnpm");

function ensureBundledWorkspaceNodeModules() {
  if (!fs.existsSync(packagesDir) || !fs.existsSync(scopedPackagesDir)) {
    return;
  }

  for (const packageName of fs.readdirSync(packagesDir)) {
    const sourceNodeModules = path.join(packagesDir, packageName, "node_modules");
    const installedPackageDir = path.join(scopedPackagesDir, packageName);
    const targetNodeModules = path.join(installedPackageDir, "node_modules");

    if (!fs.existsSync(sourceNodeModules) || !fs.existsSync(installedPackageDir)) {
      continue;
    }

    try {
      if (fs.existsSync(targetNodeModules)) {
        const entries = fs.readdirSync(targetNodeModules);
        if (entries.length > 0) {
          continue;
        }
        fs.rmSync(targetNodeModules, { recursive: true, force: true });
      }

      fs.symlinkSync(sourceNodeModules, targetNodeModules, "dir");
    } catch {
      // Ignore already-fixed installs and platforms that reject directory symlinks.
    }
  }
}

function ensureRootPnpmLinks() {
  if (!fs.existsSync(pnpmStoreDir) || !fs.existsSync(rootNodeModulesDir)) {
    return;
  }

  for (const storeEntry of fs.readdirSync(pnpmStoreDir)) {
    const entryNodeModulesDir = path.join(pnpmStoreDir, storeEntry, "node_modules");
    if (!fs.existsSync(entryNodeModulesDir)) {
      continue;
    }

    for (const packageName of fs.readdirSync(entryNodeModulesDir)) {
      if (packageName.startsWith(".")) {
        continue;
      }

      if (packageName.startsWith("@")) {
        const scopeDir = path.join(entryNodeModulesDir, packageName);
        if (!fs.statSync(scopeDir).isDirectory()) {
          continue;
        }

        const targetScopeDir = path.join(rootNodeModulesDir, packageName);
        fs.mkdirSync(targetScopeDir, { recursive: true });

        for (const scopedName of fs.readdirSync(scopeDir)) {
          ensureLink(
            path.join(scopeDir, scopedName),
            path.join(targetScopeDir, scopedName)
          );
        }
        continue;
      }

      ensureLink(
        path.join(entryNodeModulesDir, packageName),
        path.join(rootNodeModulesDir, packageName)
      );
    }
  }
}

function ensureLink(sourcePath, targetPath) {
  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.lstatSync(targetPath);
      if (stat.isSymbolicLink()) {
        return;
      }
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(targetPath);
        if (entries.length > 0) {
          return;
        }
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        return;
      }
    }

    const relativeSource = path.relative(path.dirname(targetPath), sourcePath);
    fs.symlinkSync(relativeSource, targetPath, "junction");
  } catch {
    // Ignore already-fixed installs and platforms that reject directory symlinks.
  }
}

ensureBundledWorkspaceNodeModules();
ensureRootPnpmLinks();
console.log("\n🔮 Echo AI CLI installed! Run: echoai\n");
