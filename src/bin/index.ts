import { Command } from 'commander';
import { parseCommand } from './parse';

const packageJson = require('../../package.json') as PackageJson;
const program = new Command();

program
  .name('Canvas Scraper CLI')
  .description('Generate Markdown file from courses.')
  .version(packageJson.version);

parseCommand(program);
program.parse(process.argv);

interface PackageJson {
  version: string;
}
