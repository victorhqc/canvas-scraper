// import { TPage as Page } from 'foxr';
import { Browser, Page } from 'puppeteer';
import chalk from 'chalk';
import wait from './wait';
import { MissingElementError, buildGetElementHandle, navigateInNewPage } from './browser';
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
}

export async function loadTopicsIframe(browser: Browser, page: Page): Promise<Page> {
  const uri = await page.$eval('input#custom_url', (e: Element) => e.getAttribute('value'));
  if (!uri) {
    throw new NoCourseTopicsUrl();
  }
  return navigateInNewPage(browser, uri);
}

export async function exploreAndTargetTopics(page: Page): Promise<TopicTargetIndexes> {
  const links = await page.$$eval('a[title="Ideas clave"]', links =>
    links.reduce<TopicTargetIndexes>((acc, link, index) => {
      if (link.innerHTML.match(/estudiar este tema/gi)) {
        link.setAttribute('data-topic-target', index.toString());
        return [...acc, index];
      }

      return acc;
    }, [])
  );

  return links;
}

export async function parseTopics(browser: Browser, page: Page): Promise<void> {
  const courseUrl = page.url();
  console.log('URL?', courseUrl);
  const topicIndexes = await exploreAndTargetTopics(page);

  for (const index of topicIndexes) {
    const topicPage = await navigateInNewPage(browser, courseUrl);
    const getElement = buildGetElementHandle(topicPage);
    await topicPage.waitFor('#maintab');
    await exploreAndTargetTopics(topicPage);
    await topicPage.screenshot({ path: `refreshed_${index}.png` });
    const link = await getElement(`a[data-topic-target="${index}"]`);
    await link.click();
    await wait(250);
    await topicPage.screenshot({ path: `topic_${index}.png` });
  }
}

type TopicTargetIndexes = number[];

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
