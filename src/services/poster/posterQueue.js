/**
 * 海报任务并发队列
 *  - p-queue 限制最大并发 8
 *  - 单任务超时 120s 熔断
 *  - 异常捕获 + 结构化日志
 */
const PQueue = require('p-queue').default;
const config = require('../../config');
const logger = require('../../utils/logger');

const queue = new PQueue({
  concurrency: config.queue.concurrency,
  timeout: config.queue.timeoutMs,
  throwOnTimeout: true
});

queue.on('error', (err) => {
  logger.error('poster queue error', { msg: err.message, stack: err.stack });
});

queue.on('idle', () => {
  logger.info('poster queue idle');
});

module.exports = queue;
