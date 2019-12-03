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
      console.log('FAIL', error);
      const errorMessage = error.contextMessage || 'Some error occurred';
      logger.error(errorMessage);
      logger.error(error);
      process.exit(1);
    }
  };
}
