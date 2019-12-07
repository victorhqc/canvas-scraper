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
  Picture,
  getTopicTabs,
  getTopics,
  clickTopicByIndex,
  topicPath,
  parseTopicTitles,
  replacePictures,
  forgePictureUrl,
  forgePictureTargetPath,
  getPictureName,
  downloadPicture,
  saveMarkdownFile,
} from '../utils/content';

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

export default class CourseParser {
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
  ): Promise<CourseContent> {
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

    return this.extractTopicContent(page, topicNumber);
  }

  async extractTopicContent(page: Page, topicNumber: number): Promise<CourseContent> {
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
  ): Promise<CourseContent> {
    try {
      const dom = new JSDOM();
      const converter = new showdown.Converter();

      const markdownChunksPromises = chunks.map(async chunk => {
        const pictures = await this.downloadPictures(chunk, pageUrl, topicNumber);
        const markdownChunk = converter.makeMarkdown(chunk, dom.window.document);
        const chunkWithPictures = replacePictures(markdownChunk, pictures);
        return chunkWithPictures;
      });

      const parsedChunks = await Promise.all(markdownChunksPromises);
      const filePath = await saveMarkdownFile(parsedChunks, topicNumber);

      return {
        path: filePath,
      };
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

export class FailedParseContent extends Error {
  contextMessage = 'Parsing content failed';
}

export interface ContentChunksByTopic {
  [key: string]: CourseContent;
}

export interface CourseContent {
  path: string;
}
