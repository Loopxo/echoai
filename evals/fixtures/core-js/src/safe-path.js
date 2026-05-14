import path from 'node:path';

export function resolveUserPath(root, userPath) {
  return path.join(root, userPath);
}
