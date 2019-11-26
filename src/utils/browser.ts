import foxr, { TBrowser, TPage, TElementHandle } from 'foxr';
import getConfig from './config';

export function launchBrowser(): Promise<TBrowser> {
  return foxr.launch({
    headless: false,
    args: ['-marionette', '-safe-mode', '-no-remote', '-profile', '/tmp/firefox_test-test_123'],
    executablePath: getConfig().firefoxPath,
  });
}

/**
 * It'll make a **new** page and navigate to canvas.
 */
export async function navigateToCanvas(browser: TBrowser, path?: string): Promise<TPage> {
  const page = await browser.newPage();

  await page.goto(`${getConfig().canvasHost}${path}`);

  return page;
}

export function buildGetElementHandle(page: TPage) {
  return async (selector: string): Promise<TElementHandle> => {
    const element = await page.$(selector);

    if (!element) {
      throw new MissingElementError(selector);
    }

    return element;
  };
}

export async function waitFor(
  page: TPage,
  selector: string,
  timeout = 5000
): Promise<TElementHandle> {
  let interval: NodeJS.Timeout | undefined;
  const tryToFetchElement = (): Promise<TElementHandle> =>
    new Promise(resolve => {
      const checkForElement = async (): Promise<void> => {
        const element = await page.$(selector);
        if (element) {
          return resolve(element);
        }
      };

      interval = setInterval(checkForElement, 250);
      checkForElement();
    });

  const timesOut = (): Promise<void> =>
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new PageTimedOut());
      }, timeout);
    });

  const result = await Promise.race([tryToFetchElement(), timesOut()]);

  if (interval) {
    clearTimeout(interval);
  }

  if (!result) {
    throw new MissingElementError(selector);
  }

  return result;
}

export class MissingElementError extends Error {
  contextMessage = 'Element does not exist in page';
}

export class PageTimedOut extends Error {
  contextMessage = 'Wait for element timed out';
}
