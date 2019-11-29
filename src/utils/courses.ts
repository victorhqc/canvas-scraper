// import { TPage as Page } from 'foxr';
import { Page } from 'puppeteer';
import chalk from 'chalk';
import wait from './wait';
import { MissingElementError, buildGetElementHandle } from './browser';
import * as inquirer from 'inquirer';

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

  await page.waitFor('[aria-label="Menú de navegación de cursos"]');

  const topicsListElement = await getElement('li.section a[title="Temas"]');
  await topicsListElement.click();

  await page.waitFor('iframe#tool_content');

  // Damn iframes
  await wait();

  await page.screenshot({ path: 'example.png' });
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
