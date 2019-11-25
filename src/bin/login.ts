import { Command } from 'commander';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { saveAuthInfo, ProvidedAuthInfo, freshLogin } from '../utils/authentication';
import { handleCommand } from '../utils/command-handler';

dotenv.config({});

async function login(program: Command): Promise<string> {
  const authInfo = await freshLogin(program as ProvidedAuthInfo);
  return chalk.blue('Authentication written to ' + saveAuthInfo(authInfo));
}

export function loginOptions(program: Command): Command {
  return program
    .option('-u, --username <username>', 'Canvas username, example: ABCD012345')
    .option('-p, --password <password>', 'Password');
}

export function loginCommand(program: Command): Command {
  return loginOptions(
    program
      .command('login')
      .description(
        "Authenticate with API and store the login token and endpoint locally, so that you don't need to login each time in the future"
      )
      .action(handleCommand(login))
  );
}
