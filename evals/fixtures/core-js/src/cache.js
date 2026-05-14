export function createCache() {
  const values = new Map();

  return {
    set(key, value, ttlMs) {
      values.set(key, { value, ttlMs, createdAt: Date.now() });
    },
    get(key) {
      return values.get(key)?.value;
    },
    clearPrefix(prefix) {
      values.clear();
      return 0;
    },
  };
}
