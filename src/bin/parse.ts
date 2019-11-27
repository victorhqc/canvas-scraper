import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { launchBrowser, navigateToCanvas } from '../utils/browser';
import { ProvidedAuthInfo, freshLogin } from '../utils/authentication';
import { handleCommand } from '../utils/command-handler';

dotenv.config({});

async function parse(program: Command): Promise<string> {
  const browser = await launchBrowser();
  const page = await navigateToCanvas(browser, '/login/canvas');

  await freshLogin(page, program as ProvidedAuthInfo);
  return chalk.blue('Parsed completed! (shmaybe??)');
}

export function parseOptions(program: Command): Command {
  return program
    .option('-u, --username <username>', 'Canvas username, example: ABCD012345')
    .option('-p, --password <password>', 'Password');
}

export function parseCommand(program: Command): Command {
  return parseOptions(
    program
      .command('parse')
      .description('Parse a Canvas course')
      .action(handleCommand(parse))
  );
}
