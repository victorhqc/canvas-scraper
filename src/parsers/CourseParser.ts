// import { TPage as Page } from 'foxr';
import { promisify } from 'util';
import fs from 'fs';
import { Browser, Page } from 'puppeteer';
import { Ora } from 'ora';
import { navigateInNewPage } from '../utils/browser';
import logger from '../utils/logger';
import { ChosenCourse } from '../utils/courses';
import {
  ContentChunk,
  Image,
  getTopicTabs,
  getTopics,
  getTopicsLength,
  clickTopicByIndex,
  topicPath,
  getDefaultPath,
  parseTopicTitles,
  replaceImages,
  findImages,
  forgeImageUrl,
  fixImagesInMarkdown,
  forgeImageTargetPath,
  getImageName,
  downloadImage,
  saveMarkdownFile,
  sanitizeHTML,
} from '../utils/content';

import { sanitizeMarkdown, replaceTableForText, cleanupDefinitionTables } from '../utils/markdown';
import { compose } from '../utils/compose';

const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);

export default class CourseParser {
  private browser: Browser;
  private coursePage: Page;
  private chosenCourse: ChosenCourse;
  private spinner: Ora;
  private rootPath: string;
  private topic: number | null;

  private topicsIterationLength: number;

  constructor(browser: Browser, config: CourseParserConfig) {
    this.browser = browser;
    this.coursePage = config.page;
    this.spinner = config.spinner;
    this.chosenCourse = config.chosenCourse;
    this.topic = config.topic;
    this.rootPath = getDefaultPath(config.path, this.chosenCourse.name);

    this.topicsIterationLength = 0;
  }

  async getContentFromCourse(): Promise<ContentParseResult> {
    if (!(await exists(this.rootPath))) {
      await mkdir(this.rootPath);
    }

    const topicsLength = await getTopicsLength(this.coursePage);
    this.spinner.text = `Obteniendo información de ${topicsLength} temas`;

    const tabs = await getTopicTabs(this.coursePage);
    let result: ContentParseResult = {};
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
  async getContentFromTopicsTab(activeTabIndex: number): Promise<ContentParseResult> {
    const page = await navigateInNewPage(this.browser, this.coursePage.url());

    await clickTopicByIndex(page, activeTabIndex);
    await parseTopicTitles(page, activeTabIndex);

    const topics = await getTopics(page);

    const courseChunks: ContentParseResult = {};
    for (const [index] of topics.entries()) {
      const topicNumber = activeTabIndex * this.topicsIterationLength + (index + 1);

      if (this.topic && this.topic !== topicNumber) continue;

      courseChunks[`topic_${topicNumber}`] = await this.getContentFromTopic(
        activeTabIndex,
        index,
        topicNumber
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
    topicNumber: number
  ): Promise<CourseContent> {
    logger.debug(`Parsing topic: (${topicNumber})`);
    this.spinner.text = `Obteniendo información del tema ${topicNumber}`;

    const page = await navigateInNewPage(this.browser, this.coursePage.url());
    await parseTopicTitles(page, activeTabIndex);

    await Promise.all([
      page.click(`[data-topic-index="${activeTopicIndex}"]`),
      page.waitForNavigation(),
    ]);

    if (!(await exists(topicPath(this.rootPath, topicNumber)))) {
      await mkdir(topicPath(this.rootPath, topicNumber));
      await mkdir(`${topicPath(this.rootPath, topicNumber)}/images`);
    }

    return this.extractTopicContent(page, topicNumber);
  }

  async extractTopicContent(page: Page, topicNumber: number): Promise<CourseContent> {
    await page.waitFor('.virtualpage');
    logger.debug(`Extracting course content from topic ${topicNumber}`);
    const contentChunks = await page.$$eval('.virtualpage', (elements: Element[]) => {
      return elements.map(element => {
        const sanitized = new DOMParser().parseFromString(element.innerHTML, 'text/html');
        return sanitized.body.innerHTML;
      });
    });
    const sanitizedChunks = contentChunks.map(chunk => sanitizeHTML(chunk));

    logger.debug(`Found ${sanitizedChunks.length} content chunks for topic ${topicNumber}`);

    return this.parseContentChunks(contentChunks, page.url(), topicNumber);
  }

  async parseContentChunks(
    chunks: ContentChunk[],
    pageUrl: string,
    topicNumber: number
  ): Promise<CourseContent> {
    try {
      const markdownChunksPromises = chunks.map(async chunk => {
        const images = await this.downloadImages(chunk, pageUrl, topicNumber);
        logger.debug(`Downloaded ${images.length} images`);

        logger.debug('Replaced images in Markdown');
        const chunkWithImages = replaceImages(chunk, images);

        logger.debug('Converted chunks to Markdown');
        const markdownChunk = compose(
          // 3. Sanitize Markdown.
          sanitizeMarkdown,
          // 2. Replace any table, as they're difficult to cleanup.
          replaceTableForText,
          // 1. First cleanup definitions
          cleanupDefinitionTables
        )(chunkWithImages);

        // Fix broken images in markdown
        const sanitizedChunk = fixImagesInMarkdown(markdownChunk, images);

        return {
          chunks: sanitizedChunk,
          images: images.length,
        };
      });

      const results = await Promise.all(markdownChunksPromises);
      const { chunks: parsedChunks, images } = results.reduce<{ chunks: string[]; images: number }>(
        (acc, result) => ({
          ...acc,
          chunks: [...acc.chunks, result.chunks],
          images: acc.images + result.images,
        }),
        { chunks: [], images: 0 }
      );

      const filePath = await saveMarkdownFile(parsedChunks, this.rootPath, topicNumber);
      logger.debug('Saved markdown File');

      return {
        path: filePath,
        topicNumber,
        images,
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
    const images = findImages(chunk);

    const imagePromises: Promise<Image>[] = images.map(async img => {
      const picUrl = forgeImageUrl(img.originalPath, pageUrl);
      const picPath = forgeImageTargetPath(img.originalPath, this.rootPath, topicNumber);

      await downloadImage(this.browser, picUrl, picPath);

      return {
        description: img.description,
        originalPath: img.originalPath,
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

export interface CourseParserConfig {
  path: string;
  topic: number | null;
  page: Page;
  spinner: Ora;
  chosenCourse: ChosenCourse;
}

export interface ContentParseResult {
  [key: string]: CourseContent;
}

export interface CourseContent {
  path: string;
  images: number;
  topicNumber: number;
}
