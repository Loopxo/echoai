export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('config is required');
  }
  return config;
}
