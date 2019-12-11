export default function getConfig(): Config {
  return {
    canvasHost: getEnvRequired('CANVAS_HOST', 'https://micampus.unir.net'),
    headless: getEnvBoolean('HEADLESS', 'true'),
    logLevel: getEnvRequired('LOG_LEVEL', 'info'),
    log: getEnvBoolean('LOG'),
  };
}

export interface Config {
  canvasHost: string;
  headless: boolean;
  logLevel: string;
  log: boolean;
}

export function getEnvRequired(key: string, fallback?: string): string {
  const val = getEnv(key, fallback);
  if (!val) {
    throw new EnvironmentError(`${key} is missing`);
  }

  return val;
}

export function getEnvBoolean(key: string, fallback?: string): boolean {
  const val = getEnv(key, fallback);

  if (!val) {
    return false;
  }

  if (val.toLowerCase() === 'true' || val === '1') {
    return true;
  }

  return false;
}

export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] || fallback;
}

export class EnvironmentError extends Error {
  contextMessage = 'Environment Config Missing';
}
