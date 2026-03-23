export function normalizeEnvValue(value) {
  if (value == null) return "";

  return String(value)
    .replace(/\\r\\n/g, "")
    .replace(/\\n/g, "")
    .replace(/\\r/g, "")
    .replace(/[\r\n]+/g, "")
    .trim();
}

export function getEnv(...keys) {
  for (const key of keys) {
    const normalized = normalizeEnvValue(process.env[key]);
    if (normalized) return normalized;
  }

  return "";
}