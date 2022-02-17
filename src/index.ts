import { execFile } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { M3uMedia, M3uParser } from 'm3u-parser-generator';
import { cpus } from 'os';
import promiseLimit from 'promise-limit';
import { promisify } from 'util';
import w from 'winston';

const execFileAsync = promisify(execFile);

async function asyncFilter<T>(
  arr: T[],
  pred: (value: T, index: number, array: T[]) => Promise<boolean>,
) {
  const limit = promiseLimit<boolean>(cpus().length * 4);
  const results = await Promise.all(
    arr.map((value, index, array) => limit(() => pred(value, index, array))),
  );
  return arr.filter((_v, i) => results[i]);
}

const checkMedia = async (item: M3uMedia, index: number, all: M3uMedia[]) => {
  w.verbose(`#${index}/${all.length}: Checking ${item.name ?? item.location}...`);

  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      ['-loglevel', 'quiet', '-hide_banner', '-of', 'json', '-show_format',
        item.location],
      { timeout: 10000 },
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const obj = JSON.parse(stdout);

    if ('format' in obj) {
      w.info(`#${index}/${all.length}: Checking ${item.name ?? item.location}... OK`);
      return true;
    }
  } catch (error) {
    // w.error('Error', error);
  }

  w.warn(`#${index}/${all.length}: Checking ${item.name ?? item.location}... FAILED`);
  return false;
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  w.add(new w.transports.Console({
    format: w.format.cli({ all: true }),
    level: 'verbose',
  }));

  const content = await readFile('R:/index.m3u', { encoding: 'utf-8' });
  const m3u = M3uParser.parse(content);
  m3u.medias = await asyncFilter(m3u.medias, checkMedia);
  await writeFile('R:/online.m3u8', m3u.getM3uString(), { encoding: 'utf-8' });
})();
