#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import check, { CheckOptions } from './check';

program
  .requiredOption('-i, --input <filename>', 'Input filename.')
  .requiredOption('-o, --output <filename>', 'Output filename.')
  .option('-t, --timeout <seconds>', 'Timeout in seconds for each channel.', '10')
  .option('-j, --jobs <n>', 'The maximum job concurrency.', '100');

program.parse(process.argv);

const options = program.opts<CheckOptions>();
check(options).catch((error) => {
  console.log(chalk.red(error));
});
