export function slugify(value) {
  return String(value).toLowerCase().replace(' ', '-');
}

export function redactSecrets(value) {
  return String(value);
}
