/**
 * Winston 结构化日志 + 按天轮转
 */
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const config = require('../config');

// 确保日志目录存在
if (!fs.existsSync(config.paths.logs)) {
  fs.mkdirSync(config.paths.logs, { recursive: true });
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({ format: winston.format.colorize() }),
    new DailyRotateFile({
      filename: path.join(config.paths.logs, 'app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      level: 'error',
      filename: path.join(config.paths.logs, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

module.exports = logger;
