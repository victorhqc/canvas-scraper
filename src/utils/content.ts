// import { TPage as Page } from 'foxr';
import stream from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import url from 'url';
import { Readable } from 'stream';
import chalk from 'chalk';
import { JSDOM } from 'jsdom';
import cheerio from 'cheerio';
import { Browser, Page, JSHandle } from 'puppeteer';
import { gatherInfo, ProvidedInfo } from './command-handler';
import { buildGetElementHandle, navigateInNewPage } from './browser';
import { ChosenCourse } from './courses';
import { ContentParseResult } from '../parsers/CourseParser';

const pipeline = promisify(stream.pipeline);

const questions = [
  {
    name: 'path',
    message: `Dónde quieres guardar el contenido? (Opcional, dejar vacío si es aquí mismo)`,
  },
];

export async function getPath(providedInfo: ProvidedInfo<typeof questions>): Promise<string> {
  const { path } = await gatherInfo<typeof questions>(questions, providedInfo);

  return path;
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

export async function getTopicsLength(page: Page): Promise<number> {
  const elements = await page.$$eval(
    `li:nth-child(1) a[title="Ideas clave"]`,
    (elements: Element[]) => {
      return elements;
    }
  );

  return elements.length;
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
  const $ = cheerio.load(chunk, { decodeEntities: false });

  images.forEach(image => {
    $(`[src="${image.originalPath}"]`).attr('src', `./images/${image.name}`);
    $(`[href="${image.originalPath}"]`).attr('href', `./images/${image.name}`);
  });

  return $('body').html() || chunk;
}

export function fixImagesInMarkdown(chunk: ContentChunk, images: Image[]): ContentChunk {
  const replacedImages = images.reduce((acc, _, index) => {
    const temporaryImage = `%%IMAGE_${index}%%`;
    return acc.replace(/!\[.*\]\(.*\)/i, temporaryImage);
  }, chunk);

  const result = images.reduce((acc, image, index) => {
    const markdownImage = `![${image.description}](./images/${image.name})`;

    const regexp = new RegExp(`%%IMAGE_${index}%%`);
    return acc.replace(regexp, markdownImage);
  }, replacedImages);

  return result;
}

export function findImages(chunk: ContentChunk): IncompleteImage[] {
  const $ = cheerio.load(chunk, { decodeEntities: false });

  const imagePaths: IncompleteImage[] = [];

  const addImagePathsFromElement = (index: number, element: CheerioElement): void => {
    if (element.attribs['href']) {
      imagePaths.push({
        description: $('[href]')
          .eq(index)
          .text(),
        originalPath: element.attribs['href'],
      });
    }

    if (element.attribs['src']) {
      imagePaths.push({
        description: element.attribs['alt'] || element.attribs['title'] || element.attribs['src'],
        originalPath: element.attribs['src'],
      });
    }
  };

  $('[href]')
    .filter(index => {
      return Boolean(
        (
          $('[href]')
            .eq(index)
            .attr('href') || ''
        ).match(/\.(png|jpg|jpeg|gif)$/)
      );
    })
    .map(addImagePathsFromElement);

  $('img').map(addImagePathsFromElement);

  return imagePaths;
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
  path: string,
  topicNumber: number
): ImagePath {
  const imageName = getImageName(imagePath);
  return `${topicPath(path, topicNumber)}/images/${imageName}`;
}

export async function downloadImage(
  browser: Browser,
  picUrl: string,
  picPath: string
): Promise<void> {
  // We need to go to a new tab our it throws a navigation error.
  const imagePage = await navigateInNewPage(browser, picUrl, 'networkidle0');
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
  const imageName = imagePath.match(/([^/]+\.[a-z]{3,4}$)/gi);

  if (!imageName) {
    throw new ImageBadName(imagePath);
  }

  return imageName[0];
}

export function saveMarkdownFile(
  chunks: ContentChunk[],
  path: string,
  topicNumber: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const filePath = `${topicPath(path, topicNumber)}/README.md`;
    const file = fs.createWriteStream(filePath);

    file.on('error', e => {
      reject(new SaveMarkdownError(e));
    });

    chunks.forEach(chunk => {
      file.write(chunk);
    });

    file.end(() => {
      resolve(filePath);
    });
  });
}

export function getDefaultPath(targetPath: string, courseName: string): string {
  return path.join(targetPath || process.cwd(), courseName);
}

export function topicPath(targetPath: string, topicNumber: number): string {
  return path.join(targetPath, `topic_${topicNumber}`);
}

export function displayParsedContentResult(
  chosenCourse: ChosenCourse,
  result: ContentParseResult
): void {
  const boldCourse = chalk.bold.blue(chosenCourse.name);
  console.log();
  console.log(chalk.blue(`Se ha obtenido el contenido del curso ${boldCourse} exitosamente!`));
  console.log();

  for (const topicKey in result) {
    const topicResult = result[topicKey];
    console.log(chalk.bold.italic.blue(`Tema ${topicResult.topicNumber}`));
    console.log(chalk.blue(`Archivo generado: ${topicResult.path}`));
    console.log(chalk.blue(`Imágenes descargadas: ${topicResult.images}`));
    console.log();
  }
}

export function sanitizeHTML(html: string): string {
  const dom = new JSDOM();
  const doc = dom.window.document;

  const element = doc.implementation.createHTMLDocument().createElement('div');
  element.innerHTML = html;

  return element.innerHTML;
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

export interface IncompleteImage {
  originalPath: string;
  description: string;
}

export interface Image extends IncompleteImage {
  path: ImagePath;
  name: string;
}
