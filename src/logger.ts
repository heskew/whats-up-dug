import { SnoopLogg } from 'snooplogg';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dugDir = join(homedir(), '.dug');
const logFile = join(dugDir, 'debug.log');

const logger = new SnoopLogg();

// Enable based on SNOOPLOGG or DEBUG env var, default to 'dug:*'
const pattern = process.env.SNOOPLOGG || process.env.DEBUG;

if (pattern) {
  mkdirSync(dugDir, { recursive: true });
  const stream = createWriteStream(logFile, { flags: 'a' });
  logger.enable(pattern).pipe(stream);
}

// Namespaced loggers
export const api = logger('dug:api');
export const app = logger('dug:app');
export const nav = logger('dug:nav');
export const connect = logger('dug:connect');

export default logger;
