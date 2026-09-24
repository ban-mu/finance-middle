/**
 * BrowserManager
 *  - 单例管理 Puppeteer Chromium 生命周期
 *  - 启动重试
 *  - 崩溃自动恢复
 *  - 使用 IncognitoBrowserContext 做页面隔离（每个任务独立 context，避免相互污染）
 */
const puppeteer = require('puppeteer');
const config = require('../../config');
const logger = require('../../utils/logger');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.launching = null;       // 进行中的 launch Promise（防止重复启动）
    this.retryCount = 0;
  }

  static getInstance() {
    if (!BrowserManager._instance) {
      BrowserManager._instance = new BrowserManager();
    }
    return BrowserManager._instance;
  }

  /**
   * 启动浏览器（带重试）
   */
  async launch() {
    if (this.browser && this.browser.isConnected()) return this.browser;
    if (this.launching) return this.launching;

    this.launching = this._launchWithRetry();
    try {
      this.browser = await this.launching;
      // 监听崩溃 -> 自动恢复
      this.browser.on('disconnected', () => {
        logger.warn('browser disconnected, will relaunch on next task');
        this.browser = null;
        this.launching = null;
      });
      logger.info('puppeteer browser launched');
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  async _launchWithRetry() {
    let lastErr;
    for (let i = 0; i < config.puppeteer.maxLaunchRetries; i++) {
      try {
        const browser = await puppeteer.launch({
          headless: config.puppeteer.headless,
          args: config.puppeteer.args,
          executablePath: config.puppeteer.executablePath // undefined 时使用内置 chromium
        });
        this.retryCount = 0;
        return browser;
      } catch (err) {
        lastErr = err;
        this.retryCount += 1;
        logger.error('puppeteer launch failed', { attempt: i + 1, msg: err.message });
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
    throw lastErr;
  }

  /**
   * 创建独立 BrowserContext + Page（Puppeteer 23+ 已更名为 createBrowserContext，
   * 早期版本叫 createIncognitoBrowserContext，做兼容处理）
   * 任务结束后由调用方 close context
   */
  async newPage() {
    const browser = await this.launch();
    const createContext = browser.createBrowserContext || browser.createIncognitoBrowserContext;
    const context = await createContext.call(browser);
    const page = await context.newPage();
    page._posterContext = context; // 标记，便于释放
    return page;
  }

  /**
   * 关闭 page（同时关闭其 incognito context）
   */
  async closePage(page) {
    try {
      if (page && page._posterContext) {
        await page._posterContext.close();
      } else if (page) {
        await page.close();
      }
    } catch (err) {
      logger.warn('close page failed', { msg: err.message });
    }
  }

  async destroy() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) { /* noop */ }
      this.browser = null;
    }
  }
}

module.exports = BrowserManager.getInstance();
