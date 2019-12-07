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
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

export default class ContentParser {
  private browser: Browser;
  private coursePage: Page;

  private topicsIterationLength: number;

  constructor(browser: Browser, page: Page) {
    this.browser = browser;
    this.coursePage = page;

    this.topicsIterationLength = 0;
  }

  async getContentFromCourse(): Promise<ContentChunksByTopic> {
    if (!(await exists('content/'))) {
      await mkdir('content/');
    }

    const tabs = await getTopicTabs(this.coursePage);
    let result: ContentChunksByTopic = {};
    for (const [tabIndex] of tabs.entries()) {
      logger.debug(`Parsing topic tab: (${tabIndex + 1})`);
      const chunks = await this.getContentFromTopicsTab(tabIndex);
      result = {
        ...result,
        ...chunks,
      };
    }

    return result;
  }

  /**
   * Navigates to a new page. This will allow us to avoid any pollution to the original page and
   * habe a blank canvas in each iteration.
   */
  async getContentFromTopicsTab(activeTabIndex: number): Promise<ContentChunksByTopic> {
    const page = await navigateInNewPage(this.browser, this.coursePage.url());

    await clickTopicByIndex(page, activeTabIndex);
    await parseTopicTitles(page, activeTabIndex);

    const topics = await getTopics(page);

    const courseChunks: ContentChunksByTopic = {};
    for (const [index] of topics.entries()) {
      logger.debug(`Parsing topic: (${index + 1})`);
      courseChunks[`topic_${activeTabIndex}_${index}`] = await this.getContentFromTopic(
        activeTabIndex,
        index,
        this.topicsIterationLength
      );
    }

    this.topicsIterationLength = topics.length;
    return courseChunks;
  }

  /**
   * Navigating to each topic will involve opening a fresh page as well.
   */
  async getContentFromTopic(
    activeTabIndex: number,
    activeTopicIndex: number,
    topicsLength: number
  ): Promise<ContentChunk[]> {
    const page = await navigateInNewPage(this.browser, this.coursePage.url());
    await parseTopicTitles(page, activeTabIndex);

    await Promise.all([
      page.click(`[data-topic-index="${activeTopicIndex}"]`),
      page.waitForNavigation(),
    ]);

    const topicNumber = activeTabIndex * topicsLength + (activeTopicIndex + 1);
    if (!(await exists(topicPath(topicNumber)))) {
      await mkdir(topicPath(topicNumber));
      await mkdir(`${topicPath(topicNumber)}/pictures`);
    }

    const result = this.extractTopicContent(page, topicNumber);

    return result;
  }

  async extractTopicContent(page: Page, topicNumber: number): Promise<ContentChunk[]> {
    await page.waitFor('.virtualpage');
    const contentChunks = await page.$$eval('.virtualpage', (elements: Element[]) => {
      return elements.map(element => element.innerHTML);
    });

    return this.parseContentChunks(contentChunks, page.url(), topicNumber);
  }

  async parseContentChunks(
    chunks: ContentChunk[],
    pageUrl: string,
    topicNumber: number
  ): Promise<ContentChunk[]> {
    try {
      const dom = new JSDOM();
      const converter = new showdown.Converter();

      const markdownChunksPromises = chunks.map(async chunk => {
        const pictures = await this.downloadPictures(chunk, pageUrl, topicNumber);
        const markdownChunk = converter.makeMarkdown(chunk, dom.window.document);
        const chunkWithPictures = replacePictures(markdownChunk, pictures);
        return chunkWithPictures;
      });

      return Promise.all(markdownChunksPromises);
    } catch (e) {
      throw new FailedParseContent(e);
    }
  }

  async downloadPictures(
    chunk: ContentChunk,
    pageUrl: string,
    topicNumber: number
  ): Promise<Picture[]> {
    const images = chunk.match(/(([^\s^\t^<^>^"^=]+)\.(png|jpg|jpeg|gif))/gi) || [];

    const picturePromises: Promise<Picture>[] = images.map(async picturePath => {
      const picUrl = forgePictureUrl(picturePath, pageUrl);
      const picPath = forgePictureTargetPath(picturePath, topicNumber);

      await downloadPicture(this.browser, picUrl, picPath);

      return {
        path: picPath,
        name: getPictureName(picPath),
      };
    });

    return Promise.all(picturePromises);
  }
}

async function getTopics(page: Page): Promise<JSHandle[]> {
  const topics = await page.$$('[data-topic-index]');
  return topics;
}

async function getTopicTabs(page: Page): Promise<JSHandle[]> {
  const tabs = await page.$$('#maintab li');
  return tabs;
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

export interface ContentChunksByTopic {
  [key: string]: ContentChunk[];
}

function replacePictures(chunk: ContentChunk, pictures: Picture[]): ContentChunk {
  return pictures.reduce((acc, picture) => {
    const markdownPicture = `![${picture.name}](./pictures/${picture.name})`;
    return acc.replace(/!\[.*\]\(.*\)/gi, markdownPicture);
  }, chunk);
}

function forgePictureUrl(picturePath: PicturePath, pageUrl: string): string {
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

  return `${parsedUrl.protocol}//${parsedUrl.host}${cleanedPathname}${picturePath}`;
}

function forgePictureTargetPath(picturePath: PicturePath, topicNumber: number): PicturePath {
  const pictureName = getPictureName(picturePath);
  return `${topicPath(topicNumber)}/pictures/${pictureName}`;
}

async function downloadPicture(browser: Browser, picUrl: string, picPath: string): Promise<void> {
  // We need to go to a new tab our it throws a navigation error.
  const imagePage = await navigateInNewPage(browser, picUrl);
  const source = await imagePage.goto(picUrl);
  if (!source) {
    throw new PictureNotFound(picUrl);
  }

  const readable = new Readable();
  // _read is required but you can noop it
  readable._read = () => {};
  readable.push(await source.buffer());
  readable.push(null);

  await pipeline(readable, fs.createWriteStream(picPath));
}

function getPictureName(picturePath: PicturePath): string {
  const pictureName = picturePath.match(/([^/]+\.[a-z]{3,4})/gi);

  if (!pictureName) {
    throw new PictureBadName(picturePath);
  }

  return pictureName[0];
}

function topicPath(topicNumber: number): string {
  return `content/topic_${topicNumber}`;
}

export class FailedParseContent extends Error {
  contextMessage = 'Parsing content failed';
}

export class PictureNotFound extends Error {
  contextMessage = "Couldn't find picture";
}

export class PictureBadName extends Error {
  contextMessage = 'Picture has incorrect name or path';
}

export type ContentChunk = string;
export type PicturePath = string;
export interface Picture {
  path: PicturePath;
  name: string;
}
