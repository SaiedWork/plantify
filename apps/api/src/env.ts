// Imported first so the monorepo-root .env is in process.env before any module reads it.
for (const path of ['../../.env', '.env']) {
  try {
    process.loadEnvFile(path);
  } catch {
    // optional: production gets its env from the platform
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
