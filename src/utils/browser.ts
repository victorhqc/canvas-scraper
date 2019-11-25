import foxr, { TBrowser, TPage } from 'foxr';
import getConfig from './config';

export function launchBrowser(): Promise<TBrowser> {
  return foxr.launch({
    headless: false,
    args: ['-marionette', '-safe-mode', '-no-remote', '-profile', '/tmp/firefox_test-test_123'],
    executablePath: getConfig().firefoxPath,
  });
}

export async function navigateToCanvas(browser: TBrowser): Promise<TPage> {
  const page = await browser.newPage();

  await page.goto(getConfig().canvasHost);

  return page;
}
