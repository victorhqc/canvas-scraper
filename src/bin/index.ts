require('dotenv').config();

import { Command } from 'commander';
import { loginCommand } from './login';

const packageJson = require('../../package.json') as PackageJson;

const program = new Command();

program
  .name('Canvas Scraper CLI')
  .description('Generate Markdown file from courses.')
  .version(packageJson.version);

loginCommand(program);
program.parse(process.argv);

interface PackageJson {
  version: string;
}
