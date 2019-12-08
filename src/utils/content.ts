// import { TPage as Page } from 'foxr';
import stream from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import url from 'url';
import { Readable } from 'stream';
import { Browser, Page, JSHandle } from 'puppeteer';
import { gatherInfo, ProvidedInfo } from './command-handler';
import { buildGetElementHandle, navigateInNewPage } from './browser';

const pipeline = promisify(stream.pipeline);

const questions = [{ name: 'target', message: "Where do you want to save the course's content?" }];

export async function getTarget(providedInfo: ProvidedInfo<typeof questions>): Promise<string> {
  const { target } = await gatherInfo<typeof questions>(questions, providedInfo);

  return target;
}

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

export function replaceImages(chunk: ContentChunk, images: Image[]): ContentChunk {
  return images.reduce((acc, image) => {
    const markdownImage = `![${image.name}](./images/${image.name})`;
    return acc.replace(/!\[.*\]\(.*\)/gi, markdownImage);
  }, chunk);
}

export function forgeImageUrl(imagePath: ImagePath, pageUrl: string): string {
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

  return `${parsedUrl.protocol}//${parsedUrl.host}${cleanedPathname}${imagePath}`;
}

export function forgeImageTargetPath(
  imagePath: ImagePath,
  target: string,
  topicNumber: number
): ImagePath {
  const imageName = getImageName(imagePath);
  return `${topicPath(target, topicNumber)}/images/${imageName}`;
}

export async function downloadImage(
  browser: Browser,
  picUrl: string,
  picPath: string
): Promise<void> {
  // We need to go to a new tab our it throws a navigation error.
  const imagePage = await navigateInNewPage(browser, picUrl);
  const source = await imagePage.goto(picUrl);
  if (!source) {
    throw new ImageNotFound(picUrl);
  }

  const readable = new Readable();
  // _read is required but you can noop it
  readable._read = () => {};
  readable.push(await source.buffer());
  readable.push(null);

  await pipeline(readable, fs.createWriteStream(picPath));
}

export function getImageName(imagePath: ImagePath): string {
  const imageName = imagePath.match(/([^/]+\.[a-z]{3,4})/gi);

  if (!imageName) {
    throw new ImageBadName(imagePath);
  }

  return imageName[0];
}

export function saveMarkdownFile(
  chunks: ContentChunk[],
  target: string,
  topicNumber: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = `${topicPath(target, topicNumber)}/README.md`;
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

export function topicPath(target: string, topicNumber: number): string {
  return `${target}/topic_${topicNumber}`;
}

export class ImageNotFound extends Error {
  contextMessage = "Couldn't find image";
}

export class ImageBadName extends Error {
  contextMessage = 'Image has incorrect name or path';
}

export class SaveMarkdownError extends Error {
  contextMessage = "Couldn't save Markdown file";
}

export type ContentChunk = string;
export type ImagePath = string;
export interface Image {
  path: ImagePath;
  name: string;
}
