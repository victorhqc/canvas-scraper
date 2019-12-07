// import { TPage as Page } from 'foxr';
import stream from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import url from 'url';
import { Readable } from 'stream';
import { Browser, Page, JSHandle } from 'puppeteer';
import { buildGetElementHandle, navigateInNewPage } from './browser';

const pipeline = promisify(stream.pipeline);

export async function getTopics(page: Page): Promise<JSHandle[]> {
  const topics = await page.$$('[data-topic-index]');
  return topics;
}

export async function getTopicTabs(page: Page): Promise<JSHandle[]> {
  const tabs = await page.$$('#maintab li');
  return tabs;
}

export async function clickTopicByIndex(page: Page, activeTabIndex: number): Promise<void> {
  const getElement = buildGetElementHandle(page);
  const tab = await getElement(`#maintab li:nth-child(${activeTabIndex + 1})`);
  await tab.click();
}

export async function parseTopicTitles(page: Page, activeTabIndex: number): Promise<void> {
  await page.$$eval(
    `#tcontent${activeTabIndex + 1} li:nth-child(1) a[title="Ideas clave"]`,
    (titles: Element[]) => {
      titles.forEach((title, index) => {
        title.setAttribute('data-topic-index', index.toString());
      });
    }
  );
}

export function replacePictures(chunk: ContentChunk, pictures: Picture[]): ContentChunk {
  return pictures.reduce((acc, picture) => {
    const markdownPicture = `![${picture.name}](./pictures/${picture.name})`;
    return acc.replace(/!\[.*\]\(.*\)/gi, markdownPicture);
  }, chunk);
}

export function forgePictureUrl(picturePath: PicturePath, pageUrl: string): string {
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

export function forgePictureTargetPath(picturePath: PicturePath, topicNumber: number): PicturePath {
  const pictureName = getPictureName(picturePath);
  return `${topicPath(topicNumber)}/pictures/${pictureName}`;
}

export async function downloadPicture(
  browser: Browser,
  picUrl: string,
  picPath: string
): Promise<void> {
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

export function getPictureName(picturePath: PicturePath): string {
  const pictureName = picturePath.match(/([^/]+\.[a-z]{3,4})/gi);

  if (!pictureName) {
    throw new PictureBadName(picturePath);
  }

  return pictureName[0];
}

export function saveMarkdownFile(chunks: ContentChunk[], topicNumber: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = `${topicPath(topicNumber)}/README.md`;
    const file = fs.createWriteStream(filePath);

    file.on('error', e => {
      reject(new SaveMarkdownError(e));
    });

    chunks.forEach(chunk => {
      file.write(chunk);
    });
    file.end();

    resolve(filePath);
  });
}

export function topicPath(topicNumber: number): string {
  return `content/topic_${topicNumber}`;
}

export class PictureNotFound extends Error {
  contextMessage = "Couldn't find picture";
}

export class PictureBadName extends Error {
  contextMessage = 'Picture has incorrect name or path';
}

export class SaveMarkdownError extends Error {
  contextMessage = "Couldn't save Markdown file";
}

export type ContentChunk = string;
export type PicturePath = string;
export interface Picture {
  path: PicturePath;
  name: string;
}
