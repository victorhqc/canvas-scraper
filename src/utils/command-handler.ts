import chalk from 'chalk';
import { Command } from 'commander';

export function handleCommand(commandAction: (program: Command) => Promise<string | void>) {
  return async (program: Command) => {
    try {
      const result = await commandAction(program);
      if (result) {
        console.log(result);
      }
    } catch (error) {
      console.log(chalk.bold.red(error.contextMessage || 'Some error occurred'));
      console.log(chalk.red(error));
    }
  };
}
