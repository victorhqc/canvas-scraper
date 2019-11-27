import { AuthenticationFailedError } from '../types/authentication';
import * as inquirer from 'inquirer';
import { TPage } from 'foxr';
import { buildGetElementHandle, waitFor } from './browser';

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

export async function freshLogin(page: TPage, providedInfo: ProvidedAuthInfo): Promise<void> {
  const { username, password } = await gatherLoginInput(providedInfo);
  await auth(page, username, password);
}

export async function auth(page: TPage, username: string, password: string): Promise<void> {
  const getElement = buildGetElementHandle(page);

  const usernameInput = await getElement('#pseudonym_session_unique_id');
  const passwordInput = await getElement('#pseudonym_session_password');

  await usernameInput.type(username);
  await passwordInput.type(password);

  const submitButton = await getElement('.Button--login');
  await submitButton.click();

  await page.screenshot({ path: 'example.png' });

  await waitFor(page, '#dashboard').catch(e => {
    throw new AuthenticationFailedError(e);
  });
  console.log('DONE!');
}
