import { createLogger, format, transports } from 'winston';
import dotenv from 'dotenv';
import config from './config';

dotenv.config({});

const { combine, timestamp, label, prettyPrint } = format;

const logger = createLogger({
  level: config().logLevel,
  format: combine(label({ label: 'canvas-scraper' }), timestamp(), prettyPrint()),
  defaultMeta: { service: 'canvas-scraper' },
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

if (config().log) {
  logger.add(
    new transports.Console({
      format: combine(label({ label: 'canvas-scraper' }), timestamp(), prettyPrint()),
    })
  );
}

export default logger;
