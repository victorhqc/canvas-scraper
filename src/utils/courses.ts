// import { TPage as Page } from 'foxr';
import { Browser, Page, JSHandle } from 'puppeteer';
import chalk from 'chalk';
import wait from './wait';
import * as inquirer from 'inquirer';
import { MissingElementError, buildGetElementHandle, navigateInNewPage } from './browser';
import { parseContentChunks, ContentChunk } from './content';
import logger from './logger';

export async function getAvailableCourses(page: Page, retriedTimes = 0): Promise<Course[]> {
  const boxHandle = await page.$('.ic-DashboardCard__box');
  if (!boxHandle) {
    throw new MissingElementError('.ic-DashboardCard__box');
  }

  const courses: Course[] = await boxHandle.$$eval(
    '.ic-DashboardCard__header-title span',
    (nodes: Element[]) => nodes.map((n, index) => ({ name: n.innerHTML, value: index }))
  );

  if (courses.length == 0) {
    if (retriedTimes >= 3) {
      throw new NoCoursesError();
    }

    await wait(100);
    logger.warn(`Couldn't find courses, will try again (${retriedTimes + 1})`);
    return getAvailableCourses(page, retriedTimes + 1);
  }

  return courses;
}

export async function chooseCourse(courses: Course[]): Promise<ChosenCourse> {
  const chosenCourse = await inquirer.prompt<ChosenCourse>([
    {
      type: 'list',
      name: 'index',
      message: 'Which course do you want to parse?',
      choices: courses,
    },
  ]);

  return chosenCourse;
}

export async function navigateToCourse(
  page: Page,
  courses: Course[],
  chosenCourse: ChosenCourse
): Promise<void> {
  const getElement = buildGetElementHandle(page);

  const course = courses[chosenCourse.index];
  chalk.blue(`Parsing ${chalk.bold.blue(course.name)} course`);

  const courseCard = await getElement(
    `.ic-DashboardCard__box .ic-DashboardCard:nth-child(${chosenCourse.index + 1})`
  );
  await courseCard.click();
  await page.waitForNavigation();

  const topicsListElement = await getElement('li.section a[title="Temas"]');
  await topicsListElement.click();
  await page.waitForNavigation();
}

export async function loadTopicsIframeFromCoursePage(browser: Browser, page: Page): Promise<Page> {
  const uri = await page.$eval('input#custom_url', (e: Element) => e.getAttribute('value'));
  if (!uri) {
    throw new NoCourseTopicsUrl();
  }
  return navigateInNewPage(browser, uri);
}

export async function parseTopics(browser: Browser, page: Page): Promise<ContentChunksByTopic> {
  const tabs = await getTopicTabs(page);
  let result: ContentChunksByTopic = {};
  for (const [tabIndex] of tabs.entries()) {
    logger.debug(`Parsing topic tab: (${tabIndex + 1})`);
    const chunks = await navigateToCourseByIndex(browser, page.url(), tabIndex);
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
async function navigateToCourseByIndex(
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
    courseChunks[`topic_${activeTabIndex}_${index}`] = await navigateToTopicByIndex(
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
async function navigateToTopicByIndex(
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

  return parseTopicContent(page);
}

async function parseTopicContent(page: Page): Promise<ContentChunk[]> {
  await page.waitFor('.virtualpage');
  const contentChunks = await page.$$eval('.virtualpage', (elements: Element[]) => {
    return elements.map(element => element.innerHTML);
  });

  const chunks = await parseContentChunks(contentChunks);
  return chunks;
}

export interface ContentChunksByTopic {
  [key: string]: ContentChunk[];
}

interface Course {
  name: string;
  value: number;
}

interface ChosenCourse {
  index: number;
}

export class NoCoursesError extends Error {
  contextMessage = "Can't fetch courses";
}

export class NoCourseTopicsUrl extends Error {
  contextMessage = "Can't find course topics url";
}
