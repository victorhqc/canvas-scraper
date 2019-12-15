import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import logger from './logger';
import config from './config';

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
      if (config().log) {
        console.log(chalk.bold.red(error.contextMessage));
        console.log(chalk.red(error.message));
      }
      process.exit(1);
    }
  };
}

export async function gatherInfo<T extends Question[]>(
  questions: RequiredQuestion<T>[],
  providedInfo?: ProvidedInfo<T>
): Promise<Answers<T>> {
  const getOption = (parameter: RequiredParameter<T>): string | undefined =>
    providedInfo && providedInfo[parameter];

  const missingQuestions = questions.filter(({ name }) => !getOption(name));
  const answers = await inquirer.prompt<Answers<T>>(missingQuestions);

  const entries = questions.map(({ name }) => {
    const value = getOption(name) || answers[name];
    return [name, value] as const;
  });

  // Not sure about this...
  return (Object.fromEntries(entries) as unknown) as Answers<T>;
}

export type RequiredParameter<T extends Question[]> = T[number]['name'];

export type RequiredQuestion<T extends Question[]> = {
  name: RequiredParameter<T>;
  message: string;
  type?: string;
};

export type ProvidedInfo<T extends Question[]> = {
  [key in RequiredParameter<T>]?: string;
};

export type Answers<T extends Question[]> = {
  [key in RequiredParameter<T>]: string;
};

export interface Question {
  name: string;
  message: string;
  type?: string;
}
