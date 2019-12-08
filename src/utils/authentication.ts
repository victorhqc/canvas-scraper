import { AuthenticationFailedError } from '../types/authentication';
// import { TPage as Page } from 'foxr';
import { Page } from 'puppeteer';
import { gatherInfo, ProvidedInfo } from './command-handler';
import { buildGetElementHandle } from './browser';

const questions = [
  { name: 'username', message: 'What is your canvas username?' },
  { name: 'password', message: 'What is your canvas password?', type: 'password' },
];

export async function freshLogin(
  page: Page,
  providedInfo: ProvidedInfo<typeof questions>
): Promise<void> {
  const { username, password } = await gatherInfo<typeof questions>(questions, providedInfo);
  await auth(page, username, password);
}

export async function auth(page: Page, username: string, password: string): Promise<void> {
  const getElement = buildGetElementHandle(page);

  const usernameInput = await getElement('#pseudonym_session_unique_id');
  const passwordInput = await getElement('#pseudonym_session_password');

  await usernameInput.type(username);
  await passwordInput.type(password);

  const submitButton = await getElement('.Button--login');
  await submitButton.click();

  await page.waitFor('#dashboard').catch(e => {
    throw new AuthenticationFailedError(e);
  });
}
