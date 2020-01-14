import { Command } from 'commander';
import ora from 'ora';
import { launchBrowser, navigateToCanvas } from '../utils/browser';
import { handleCommand } from '../utils/command-handler';
import { freshLogin } from '../utils/authentication';
import {
  getAvailableCourses,
  chooseCourse,
  navigateToCourse,
  loadTopicsIframeFromCoursePage,
} from '../utils/courses';
import { getPath, displayParsedContentResult } from '../utils/content';
import { getTopic } from '../utils/topic';
import CourseParser from '../parsers/CourseParser';
import logger from '../utils/logger';

async function parse(command: Command): Promise<void> {
  const browser = await launchBrowser();
  logger.info('Browser initialized');
  const page = await navigateToCanvas(browser, '/login/canvas');
  logger.info('Navigated to login page');

  await freshLogin(page, command);
  logger.info('Authentication succeeded');

  const path = await getPath(command);
  logger.info('Got path');

  const courses = await getAvailableCourses(page);
  logger.info('Found available courses');
  const chosenCourse = await chooseCourse(courses);
  await navigateToCourse(page, courses, chosenCourse);
  logger.info('Navigated to chosen course');

  const topic = await getTopic(command);
  logger.info('Got desired topic');

  const iframePage = await loadTopicsIframeFromCoursePage(browser, page);
  logger.info('Navigated to course topics (iframe)');

  const spinner = ora(`Obteniendo información del curso: ${chosenCourse.name}`).start();

  const contentParser = new CourseParser(browser, {
    page: iframePage,
    path,
    topic,
    spinner,
    chosenCourse,
  });

  const courseContent = await contentParser.getContentFromCourse();
  spinner.stop();
  logger.info('Successfully found Course content');
  displayParsedContentResult(chosenCourse, courseContent);

  logger.info('Parsing succeeded');
  process.exit(0);
}

export function parseOptions(command: Command): Command {
  return command
    .option('-u, --username <username>', 'Canvas username, example: ABCD012345')
    .option('--password <password>', 'Password')
    .option('-p, --path <path>', 'Target path, i.e. "~/Desktop/"')
    .option('t, --topic <topic>', 'Desired topic to parse, i.e "5"');
}

export function parseCommand(command: Command): Command {
  return parseOptions(
    command
      .command('parse')
      .description('Parse a Canvas course')
      .action(handleCommand(parse))
  );
}
