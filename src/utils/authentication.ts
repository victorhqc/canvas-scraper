import { AuthenticationFailedError } from '../types/authentication';
import Configstore from 'configstore';
import * as inquirer from 'inquirer';
import { launchBrowser, navigateToCanvas, buildGetElementHandle, waitFor } from './browser';
import { name as packageName } from '../../package.json';

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
  config.set('cookie', authInfo.cookie);
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
  const browser = await launchBrowser();
  const page = await navigateToCanvas(browser, '/login/canvas');
  const getElement = buildGetElementHandle(page);

  const usernameInput = await getElement('#pseudonym_session_unique_id');
  const passwordInput = await getElement('#pseudonym_session_password');

  await usernameInput.type(username);
  await passwordInput.type(password);

  const submitButton = await getElement('.Button--login');
  await submitButton.click();

  await page.screenshot({ path: 'example.png' });

  await waitFor(page, '#dashboard');

  await browser.close();

  return 'foo';
}
