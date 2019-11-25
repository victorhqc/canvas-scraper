import { AuthenticationFailedError } from '../types/authentication';
import Configstore from 'configstore';
import { name as packageName } from '../../package.json';
import * as inquirer from 'inquirer';
import foxr from 'foxr';

const questions = [
  { name: 'username', message: 'What is your canvas username?' },
  { name: 'password', message: 'What is your canvas password?', type: 'password' },
] as const;
type RequiredParameter = typeof questions[number]['name'];
export type ProvidedAuthInfo = {
  [key in RequiredParameter]?: string;
};
type Answers = {
  [key in RequiredParameter]: string;
};

interface AuthInfo {
  cookie: string;
}

export function saveAuthInfo(authInfo: AuthInfo): string {
  const config = new Configstore(packageName);
  config.set('token', authInfo.cookie);
  return config.path;
}

export async function gatherLoginInput(providedInfo?: ProvidedAuthInfo): Promise<Answers> {
  const getOption = (parameter: RequiredParameter): string | undefined =>
    providedInfo && providedInfo[parameter];

  const missingQuestions = questions.filter(({ name }) => !getOption(name));
  const answers = await inquirer.prompt<Answers>(missingQuestions);

  const entries = questions.map(({ name: parameter }) => {
    const value = getOption(parameter) || answers[parameter];
    return [parameter, value] as const;
  });

  return Object.fromEntries(entries) as Answers;
}

export async function freshLogin(providedInfo: ProvidedAuthInfo): Promise<AuthInfo> {
  const { username, password } = await gatherLoginInput(providedInfo);
  const cookie = await auth(username, password);

  if (!cookie) {
    throw new AuthenticationFailedError('Unable to login');
  }

  return { cookie };
}

export async function ensureLogin(providedInfo: ProvidedAuthInfo): Promise<AuthInfo> {
  const config = new Configstore(packageName);
  if (providedInfo.username || providedInfo.password) {
    return freshLogin(providedInfo);
  }

  const cookie = config.get('cookie');
  if (cookie) {
    return { cookie };
  }
  return freshLogin(providedInfo);
}

export async function auth(username: string, password: string): Promise<string | null> {
  try {
    console.log({ username, password });
    const browser = await foxr.connect();
    const page = await browser.newPage();

    await page.goto('https://example.com');
    await page.screenshot({ path: 'example.png' });
    await browser.close();

    return 'foo';
  } catch (error) {
    console.error(error);
    return null;
  }
}
