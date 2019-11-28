// import foxr, {
//   TBrowser as Browser,
//   TPage as Page,
//   TElementHandle as ElementHandle,
// } from 'foxr';
import puppeteer, { Browser, Page, ElementHandle } from 'puppeteer';
import uuidv4 from 'uuid/v4';
import getConfig from './config';

export function launchBrowser(): Promise<Browser> {
  const profile = `/tmp/canvas_unir_${uuidv4()}`;
  return puppeteer.launch({
    // headless: false,
    args: ['-marionette', '-safe-mode', '-no-remote', '-profile', profile],
    // executablePath: getConfig().firefoxPath,
  });
}

/**
 * It'll make a **new** page and navigate to canvas.
 */
export async function navigateToCanvas(browser: Browser, path?: string): Promise<Page> {
  const page = await browser.newPage();

  await page.goto(`${getConfig().canvasHost}${path}`);
  await page.bringToFront();

  return page;
}

export function buildGetElementHandle(page: Page) {
  return async (selector: string): Promise<ElementHandle> => {
    const element = await page.$(selector);

    if (!element) {
      throw new MissingElementError(selector);
    }

    return element;
  };
}

/**
 * Waits for an element to appear in page. It will try to fetch it every 250 ms. And will fail if
 * it doesn't succeeds before timeout.
 *
 * ```js
 * const result = await waitFor(page, '#some-div');
 * ```
 */
export async function waitFor(
  page: Page,
  selector: string,
  timeout = 5000
): Promise<ElementHandle> {
  let interval: NodeJS.Timeout | undefined;
  const tryToFetchElement = (): Promise<ElementHandle> =>
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
