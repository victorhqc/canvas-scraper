// import { TPage as Page } from 'foxr';
import { Browser, Page } from 'puppeteer';
import chalk from 'chalk';
import wait from './wait';
import * as inquirer from 'inquirer';
import { MissingElementError, buildGetElementHandle, navigateInNewPage } from './browser';
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

    await wait(1000);
    logger.warn(`Couldn't find courses, will try again (${retriedTimes + 1})`);
    return getAvailableCourses(page, retriedTimes + 1);
  }

  return courses;
}

export async function chooseCourse(courses: Course[]): Promise<ChosenCourse> {
  const chosenCourse = await inquirer.prompt<{ index: number }>([
    {
      type: 'list',
      name: 'index',
      message: 'Cuál curso quieres procesar?',
      choices: courses,
    },
  ]);

  return {
    ...chosenCourse,
    name: courses[chosenCourse.index].name,
  };
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

export interface Course {
  name: string;
  value: number;
}

export interface ChosenCourse {
  index: number;
  name: string;
}

export class NoCoursesError extends Error {
  contextMessage = "Can't fetch courses";
}

export class NoCourseTopicsUrl extends Error {
  contextMessage = "Can't find course topics url";
}
