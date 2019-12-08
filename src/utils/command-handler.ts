import { Command } from 'commander';
import logger from './logger';

export function handleCommand(commandAction: (program: Command) => Promise<string | void>) {
  return async (program: Command) => {
    try {
      const result = await commandAction(program);
      if (result) {
        console.log(result);
      }
    } catch (error) {
      const errorMessage = error.contextMessage || 'Some error occurred';
      logger.error(`${errorMessage}: ${error.message}`);
      process.exit(1);
    }
  };
}
