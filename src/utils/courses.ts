// import { TPage as Page } from 'foxr';
import { Page } from 'puppeteer';
import { Command } from 'commander';
import { MissingElementError } from './browser';
import * as inquirer from 'inquirer';

interface ChosenCourse {
  chooseCourse: string;
}

export async function chooseCourse(page: Page, program: Command): Promise<void> {
  const boxHandle = await page.$('.ic-DashboardCard__box');
  if (!boxHandle) {
    throw new MissingElementError('.ic-DashboardCard__box');
  }

  const courseNames = await boxHandle.$$eval(
    '.ic-DashboardCard__header-title span',
    (nodes: Element[]) => nodes.map(n => n.innerHTML)
  );

  const chosenCourse = await inquirer.prompt<ChosenCourse>([
    {
      type: 'list',
      name: 'chosenCourse',
      message: 'Which course do you want to parse?',
      choices: courseNames,
    },
  ]);
  console.log('YOU CHOSE', chosenCourse);

  // const courseElements = await page.$$('.ic-DashboardCard');
  // const courseNames = await page.$$eval('.ic-DashboardCard', (nodes: HTMLElement[]) =>
  //   nodes.map(n => n.innerText)
  // );

  // const courseNames: string[] = [];
  // for (const courseElement of courseElements) {
  //   const name = await courseElement.getProperty('aria-label');
  //   console.log('NAME', await name.jsonValue());
  // }
  // console.log('COURSENAMES', courseNames);
}
