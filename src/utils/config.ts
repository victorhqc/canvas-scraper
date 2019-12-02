export default function getConfig(): Config {
  return {
    firefoxPath: getEnvRequired('FIREFOX_PATH'),
    canvasHost: getEnvRequired('CANVAS_HOST'),
    headless: getEnvBoolean('HEADLESS'),
  };
}

export interface Config {
  firefoxPath: string;
  canvasHost: string;
  headless: boolean;
}

export function getEnvRequired(key: string): string {
  const val = getEnv(key);
  if (!val) {
    throw new EnvironmentError(`${key} is missing`);
  }

  return val;
}

export function getEnvBoolean(key: string): boolean {
  const val = getEnv(key);

  if (!val) {
    return false;
  }

  if (val.toLowerCase() === 'true' || val === '1') {
    return true;
  }

  return false;
}

export function getEnv(key: string): string | undefined {
  return process.env[key];
}

export class EnvironmentError extends Error {
  contextMessage = 'Environment Config Missing';
}
