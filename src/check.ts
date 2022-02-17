import { execFile } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { M3uMedia, M3uParser } from 'm3u-parser-generator';
import promiseLimit from 'promise-limit';
import { promisify } from 'util';
import chalk from 'chalk';

const { log } = console;
const { blue, green, yellow } = chalk;
const execFileAsync = promisify(execFile);

async function asyncFilter<T>(
  arr: T[],
  pred: (value: T, index: number, array: T[]) => Promise<boolean>,
  concurrency?: number,
) {
  const limit = promiseLimit<boolean>(concurrency);
  const results = await Promise.all(
    arr.map((value, index, array) => limit(() => pred(value, index, array))),
  );
  return arr.filter((_v, i) => results[i]);
}

const makeCheckMedia = (timeout: number) => {
  const checkMedia = async (item: M3uMedia, index: number, all: M3uMedia[]) => {
    log(`#${index}/${all.length}: Checking ${item.name ?? item.location}...`);

    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        ['-loglevel', 'quiet', '-hide_banner', '-of', 'json', '-show_streams',
          item.location],
        { timeout },
      );

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const obj = JSON.parse(stdout);

      if ('streams' in obj) {
        log(green(`#${index}/${all.length}: Checking ${item.name ?? item.location}... OK`));
        return true;
      }
    } catch (error) {
      // w.error('Error', error);
    }

    log(yellow(`#${index}/${all.length}: Checking ${item.name ?? item.location}... FAILED`));
    return false;
  };

  return checkMedia;
};

export type CheckOptions = {
  input: string;
  output: string;
  timeout?: number;
  jobs?: number;
};

const check = async (options: CheckOptions) => {
  const {
    input, output, timeout = 10, jobs = 100,
  } = options;
  const content = await readFile(input, { encoding: 'utf-8' });
  const m3u = M3uParser.parse(content);
  const total = m3u.medias.length;
  m3u.medias = await asyncFilter(m3u.medias, makeCheckMedia(timeout * 1000), jobs);
  await writeFile(output, m3u.getM3uString(), { encoding: 'utf-8' });

  log('');
  log(`Total : ${blue(total)}`);
  log(`OK    : ${green(m3u.medias.length)}`);
  log(`Failed: ${yellow(total - m3u.medias.length)}`);
};

export default check;
