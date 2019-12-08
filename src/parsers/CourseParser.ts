// import { TPage as Page } from 'foxr';
import { promisify } from 'util';
import fs from 'fs';
import { Browser, Page } from 'puppeteer';
import showdown from 'showdown';
import { JSDOM } from 'jsdom';
import { navigateInNewPage } from '../utils/browser';
import logger from '../utils/logger';
import {
  ContentChunk,
  Image,
  getTopicTabs,
  getTopics,
  clickTopicByIndex,
  topicPath,
  parseTopicTitles,
  replaceImages,
  forgeImageUrl,
  forgeImageTargetPath,
  getImageName,
  downloadImage,
  saveMarkdownFile,
} from '../utils/content';

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

export default class CourseParser {
  private browser: Browser;
  private coursePage: Page;
  private target: string;

  private topicsIterationLength: number;

  constructor(browser: Browser, page: Page, target: string) {
    this.browser = browser;
    this.coursePage = page;
    this.target = target;

    this.topicsIterationLength = 0;
  }

  async getContentFromCourse(): Promise<ContentChunksByTopic> {
    if (!(await exists(`${this.target}/`))) {
      await mkdir(`${this.target}/`);
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
  ): Promise<CourseContent> {
    const topicNumber = activeTabIndex * topicsLength + (activeTopicIndex + 1);
    logger.debug(`Parsing topic: (${topicNumber + 1})`);

    const page = await navigateInNewPage(this.browser, this.coursePage.url());
    await parseTopicTitles(page, activeTabIndex);

    await Promise.all([
      page.click(`[data-topic-index="${activeTopicIndex}"]`),
      page.waitForNavigation(),
    ]);

    if (!(await exists(topicPath(this.target, topicNumber)))) {
      await mkdir(topicPath(this.target, topicNumber));
      await mkdir(`${topicPath(this.target, topicNumber)}/images`);
    }

    return this.extractTopicContent(page, topicNumber);
  }

  async extractTopicContent(page: Page, topicNumber: number): Promise<CourseContent> {
    await page.waitFor('.virtualpage');
    const contentChunks = await page.$$eval('.virtualpage', (elements: Element[]) => {
      return elements.map(element => element.innerHTML);
    });
    logger.debug(`Found ${contentChunks.length} content chunks`);

    return this.parseContentChunks(contentChunks, page.url(), topicNumber);
  }

  async parseContentChunks(
    chunks: ContentChunk[],
    pageUrl: string,
    topicNumber: number
  ): Promise<CourseContent> {
    try {
      const dom = new JSDOM();
      const converter = new showdown.Converter();

      const markdownChunksPromises = chunks.map(async chunk => {
        const images = await this.downloadImages(chunk, pageUrl, topicNumber);
        logger.debug(`Downloaded ${images.length} images`);
        const markdownChunk = converter.makeMarkdown(chunk, dom.window.document);
        logger.debug('Converted chunks to Markdown');
        const chunkWithImages = replaceImages(markdownChunk, images);
        logger.debug('Replaced images in Markdown');
        return chunkWithImages;
      });

      const parsedChunks = await Promise.all(markdownChunksPromises);
      const filePath = await saveMarkdownFile(parsedChunks, this.target, topicNumber);
      logger.debug('Saved markdown File');

      return {
        path: filePath,
      };
    } catch (e) {
      throw new FailedParseContent(e);
    }
  }

  async downloadImages(
    chunk: ContentChunk,
    pageUrl: string,
    topicNumber: number
  ): Promise<Image[]> {
    const images = chunk.match(/(([^\s^\t^<^>^"^=]+)\.(png|jpg|jpeg|gif))/gi) || [];

    const imagePromises: Promise<Image>[] = images.map(async imagePath => {
      const picUrl = forgeImageUrl(imagePath, pageUrl);
      const picPath = forgeImageTargetPath(imagePath, this.target, topicNumber);

      await downloadImage(this.browser, picUrl, picPath);

      return {
        path: picPath,
        name: getImageName(picPath),
      };
    });

    return Promise.all(imagePromises);
  }
}

export class FailedParseContent extends Error {
  contextMessage = 'Parsing content failed';
}

export interface ContentChunksByTopic {
  [key: string]: CourseContent;
}

export interface CourseContent {
  path: string;
}
