import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { launchBrowser, navigateToCanvas } from '../utils/browser';
import { ProvidedAuthInfo, freshLogin } from '../utils/authentication';
import {
  getAvailableCourses,
  chooseCourse,
  navigateToCourse,
  loadTopicsIframeFromCoursePage,
  parseTopics,
} from '../utils/courses';
import { handleCommand } from '../utils/command-handler';

dotenv.config({});

async function parse(command: Command): Promise<void> {
  const browser = await launchBrowser();
  const page = await navigateToCanvas(browser, '/login/canvas');

  await freshLogin(page, command as ProvidedAuthInfo);

  const courses = await getAvailableCourses(page);
  const chosenCourse = await chooseCourse(courses);
  await navigateToCourse(page, courses, chosenCourse);

  const iframePage = await loadTopicsIframeFromCoursePage(browser, page);
  await parseTopics(browser, iframePage);

  chalk.blue('Parsed completed! (shmaybe??)');

  process.exit(0);
}

export function parseOptions(command: Command): Command {
  return command
    .option('-u, --username <username>', 'Canvas username, example: ABCD012345')
    .option('-p, --password <password>', 'Password');
}

export function parseCommand(command: Command): Command {
  return parseOptions(
    command
      .command('parse')
      .description('Parse a Canvas course')
      .action(handleCommand(parse))
  );
}
