import { Command } from 'commander';
import dotenv from 'dotenv';
import { launchBrowser, navigateToCanvas } from '../utils/browser';
import { handleCommand } from '../utils/command-handler';
import { ProvidedAuthInfo, freshLogin } from '../utils/authentication';
import {
  getAvailableCourses,
  chooseCourse,
  navigateToCourse,
  loadTopicsIframeFromCoursePage,
} from '../utils/courses';
import { parseContentFromCouse } from '../utils/content';
import logger from '../utils/logger';

dotenv.config({});

async function parse(command: Command): Promise<void> {
  const browser = await launchBrowser();
  logger.info('Browser initialized');
  const page = await navigateToCanvas(browser, '/login/canvas');
  logger.info('Navigated to login page');

  await freshLogin(page, command as ProvidedAuthInfo);
  logger.info('Authentication succeeded');

  const courses = await getAvailableCourses(page);
  logger.info('Found available courses');
  const chosenCourse = await chooseCourse(courses);
  await navigateToCourse(page, courses, chosenCourse);
  logger.info('Navigated to chosen course');

  const iframePage = await loadTopicsIframeFromCoursePage(browser, page);
  logger.info('Navigated to course topics (iframe)');
  const courseChunks = await parseContentFromCouse(browser, iframePage);
  console.log(courseChunks);

  logger.info('Parsing succeeded');
  process.exit(0);
}

export function parseOptions(command: Command): Command {
  return command
    .option('-u, --username <username>', 'Canvas username, example: ABCD012345')
    .option('-p, --password <password>', 'Password')
    .option('t, --target <target>', 'Target path, i.e. "~/Desktop/"');
}

export function parseCommand(command: Command): Command {
  return parseOptions(
    command
      .command('parse')
      .description('Parse a Canvas course')
      .action(handleCommand(parse))
  );
}
