/**
 * 全局配置
 *  - 端口
 *  - 下游 finance-server 地址
 *  - puppeteer / 队列参数
 */
const path = require('path');

module.exports = {
  port: process.env.PORT || 7002,
  // 下游后端服务
  downstream: {
    base: process.env.FINANCE_SERVER || 'http://localhost:7001'
  },
  // puppeteer 配置
  puppeteer: {
    /**
     * 浏览器可执行文件路径：
     *  - 本地/裸机服务器：不设置（undefined），由 puppeteer 自动使用
     *    npm install 时下载到缓存目录的、与 puppeteer 版本精确匹配的
     *    Chrome for Testing（见项目根目录 .puppeteerrc.cjs，走国内镜像）
     *  - Docker：通过环境变量 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
     *    指定系统安装的 chromium（Dockerfile 已设置）
     *
     * 不做本机已安装 Chrome 的探测，保证本地开发与服务器部署行为一致。
     */
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    // 启动重试
    maxLaunchRetries: 3,
    // 截图任务超时
    shotTimeoutMs: 120000
  },
  // 并发队列
  queue: {
    concurrency: 8,
    timeoutMs: 120000
  },
  // 路径
  paths: {
    root: path.resolve(__dirname, '..', '..'),
    njk: path.resolve(__dirname, '..', 'assets', 'njk'),
    logs: path.resolve(__dirname, '..', 'logs')
  }
};
