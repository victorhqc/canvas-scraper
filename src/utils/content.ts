// import { TPage as Page } from 'foxr';
import stream from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import url from 'url';
import { Readable } from 'stream';
import { Browser, Page, JSHandle } from 'puppeteer';
import showdown from 'showdown';
import { JSDOM } from 'jsdom';
import { buildGetElementHandle, navigateInNewPage } from './browser';
import logger from './logger';

const pipeline = promisify(stream.pipeline);

export async function getContentFromCouse(
  browser: Browser,
  page: Page
): Promise<ContentChunksByTopic> {
  const tabs = await getTopicTabs(page);
  let result: ContentChunksByTopic = {};
  for (const [tabIndex] of tabs.entries()) {
    logger.debug(`Parsing topic tab: (${tabIndex + 1})`);
    const chunks = await getContentFromTopicsTab(browser, page.url(), tabIndex);
    result = {
      ...result,
      ...chunks,
    };
  }

  return result;
}

async function getTopicTabs(page: Page): Promise<JSHandle[]> {
  const tabs = await page.$$('#maintab li');
  return tabs;
}

/**
 * Navigates to a new page. This will allow us to avoid any pollution to the original page and
 * habe a blank canvas in each iteration.
 */
async function getContentFromTopicsTab(
  browser: Browser,
  pageUrl: string,
  activeTabIndex: number
): Promise<ContentChunksByTopic> {
  const page = await navigateInNewPage(browser, pageUrl);

  await clickTopicByIndex(page, activeTabIndex);
  await parseTopicTitles(page, activeTabIndex);

  const topics = await getTopics(page);

  const courseChunks: ContentChunksByTopic = {};
  for (const [index] of topics.entries()) {
    logger.debug(`Parsing topic: (${index + 1})`);
    courseChunks[`topic_${activeTabIndex}_${index}`] = await getContentFromTopic(
      browser,
      pageUrl,
      activeTabIndex,
      index
    );
  }

  return courseChunks;
}

async function getTopics(page: Page): Promise<JSHandle[]> {
  const topics = await page.$$('[data-topic-index]');
  return topics;
}

async function clickTopicByIndex(page: Page, activeTabIndex: number): Promise<void> {
  const getElement = buildGetElementHandle(page);
  const tab = await getElement(`#maintab li:nth-child(${activeTabIndex + 1})`);
  await tab.click();
}

async function parseTopicTitles(page: Page, activeTabIndex: number): Promise<void> {
  await page.$$eval(
    `#tcontent${activeTabIndex + 1} li:nth-child(1) a[title="Ideas clave"]`,
    (titles: Element[]) => {
      titles.forEach((title, index) => {
        title.setAttribute('data-topic-index', index.toString());
      });
    }
  );
}

/**
 * Navigating to each topic will involve opening a fresh page as well.
 */
async function getContentFromTopic(
  browser: Browser,
  pageUrl: string,
  activeTabIndex: number,
  activeTopicIndex: number
): Promise<ContentChunk[]> {
  const page = await navigateInNewPage(browser, pageUrl);
  await parseTopicTitles(page, activeTabIndex);

  await Promise.all([
    page.click(`[data-topic-index="${activeTopicIndex}"]`),
    page.waitForNavigation(),
  ]);

  return extractTopicContent(browser, page);
}

async function extractTopicContent(browser: Browser, page: Page): Promise<ContentChunk[]> {
  await page.waitFor('.virtualpage');
  const contentChunks = await page.$$eval('.virtualpage', (elements: Element[]) => {
    return elements.map(element => element.innerHTML);
  });

  return parseContentChunks(contentChunks, browser, page);
}

export interface ContentChunksByTopic {
  [key: string]: ContentChunk[];
}

async function parseContentChunks(
  chunks: ContentChunk[],
  browser: Browser,
  page: Page
): Promise<ContentChunk[]> {
  try {
    const dom = new JSDOM();
    const converter = new showdown.Converter();
    const markdownChunksPromises = chunks.map(async chunk => {
      const images = await downloadPictures(chunk, browser, page);
      if (images.length > 0) {
        console.log('IMAGES', images);
      }
      return converter.makeMarkdown(chunk, dom.window.document);
    });

    return Promise.all(markdownChunksPromises);
  } catch (e) {
    throw new FailedParseContent(e);
  }
}

async function downloadPictures(
  chunk: ContentChunk,
  browser: Browser,
  page: Page
): Promise<ImagePath[]> {
  const images = chunk.match(/(([^\s^\t^<^>^"^=]+)\.(png|jpg|jpeg|gif))/gi) || [];

  for (const [index, imgPath] of images.entries()) {
    const imgUrl = forgeImageUrl(imgPath, page.url());
    const imagePage = await navigateInNewPage(browser, imgUrl);
    console.log('GO TO', imgUrl);
    const source = await imagePage.goto(imgUrl);
    if (!source) {
      throw new ImageNotFound(imgUrl);
    }

    const readable = new Readable();
    // _read is required but you can noop it
    readable._read = () => {};
    readable.push(await source.buffer());
    readable.push(null);

    console.log('IMG URL', imgUrl);
    await pipeline(readable, fs.createWriteStream(`pictures/${index}_${Math.random()}.png`));
  }

  return images;
}

function forgeImageUrl(imgPath: string, pageUrl: string): string {
  const parsedUrl = url.parse(pageUrl);

  // Usually, the url will loke like:
  // https://unir.com/whatever/page/foo.html?something=1
  // we use the parse() function to get the pathname:
  // `/whatever/page/foo.html`
  // And then remove the `foo.html`
  const cleanedPathname = parsedUrl.pathname?.replace(/([a-z0-9-_.]+\.html?)/gi, '');

  if (!cleanedPathname) {
    throw new Error("Can't forge img url");
  }

  return `${parsedUrl.protocol}//${parsedUrl.host}${cleanedPathname}${imgPath}`;
}

export class FailedParseContent extends Error {
  contextMessage = 'Parsing content failed';
}

export class ImageNotFound extends Error {
  contextMessage = "Couldn't find image";
}

export type ContentChunk = string;
export type ImagePath = string;
