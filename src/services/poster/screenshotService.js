/**
 * screenshotService
 *  - 基于 BrowserManager 创建 page
 *  - 加载 HTML 字符串
 *  - 截图 PNG / PDF
 *  - 可选 sharp 后处理：缩放、压缩
 */
const browserManager = require('./BrowserManager');
const config = require('../../config');
const logger = require('../../utils/logger');
const sharp = require('sharp');

const screenshotService = {
  /**
   * 截图
   * @param {Object} opts
   * @param {string} opts.html       完整 HTML 字符串
   * @param {number} opts.width      视口宽
   * @param {number} opts.height     视口高（PDF 时可省略）
   * @param {('png'|'pdf')} opts.format
   * @param {Object} [opts.sharp]    sharp 后处理 { resize:{width,height}, quality }
   * @returns {Promise<Buffer>}
   */
  async takeScreenshot(opts) {
    const { html, width = 750, height = 1334, format = 'png', sharp: sharpOpts } = opts;
    const page = await browserManager.newPage();

    try {
      await page.setViewport({ width, height, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: config.puppeteer.shotTimeoutMs });
      // 等字体/网络稳定
      await page.evaluateHandle('document.fonts && document.fonts.ready');

      let buffer;
      if (format === 'pdf') {
        buffer = await page.pdf({ width: `${width}px`, height: `${height}px`, printBackground: true });
      } else {
        buffer = await page.screenshot({ type: 'png', fullPage: false, omitBackground: false });
      }

      // sharp 后处理：缩放 + 压缩
      if (sharpOpts && sharpOpts.resize) {
        buffer = await sharp(buffer)
          .resize(sharpOpts.resize.width, sharpOpts.resize.height, { fit: sharpOpts.fit || 'cover' })
          .png({ quality: sharpOpts.quality || 80 })
          .toBuffer();
      } else if (format === 'png') {
        // 默认做一次压缩
        buffer = await sharp(buffer).png({ quality: 85 }).toBuffer();
      }

      logger.info('screenshot done', { format, width, height, bytes: buffer.length });
      return buffer;
    } finally {
      await browserManager.closePage(page);
    }
  }
};

module.exports = screenshotService;
