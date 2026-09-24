/**
 * instPoster 海报接口
 *  POST /api/poster/generate
 *  body: { type, data, format }
 *  返回：图片二进制流（Content-Type: image/png 或 application/pdf）
 *
 *  返回二进制而不是 base64，避免并发下 base64 字符串过长 / 图片残缺。
 */
const express = require('express');
const router = express.Router();
const posterService = require('../services/poster/posterService');
const posterQueue = require('../services/poster/posterQueue');
const logger = require('../utils/logger');

router.post('/generate', async (req, res, next) => {
  const { type, data = {}, format = 'png' } = req.body || {};
  if (!type) {
    return res.status(400).json({ code: 400, msg: 'type is required' });
  }
  try {
    // 入队：并发控制 + 超时熔断
    const buffer = await posterQueue.add(() =>
      posterService.generate({ type, data, format })
    );

    const contentType = format === 'pdf' ? 'application/pdf' : 'image/png';
    const ext = format === 'pdf' ? 'pdf' : 'png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="poster-${type}-${Date.now()}.${ext}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.end(buffer);
  } catch (err) {
    logger.error('poster generate error', { type, msg: err.message, stack: err.stack });
    if (err.code === 'BAD_TYPE') return res.status(400).json({ code: 400, msg: err.message });
    next(err);
  }
});

// 健康检查：检查 puppeteer 是否可用
const browserManager = require('../services/poster/BrowserManager');
router.get('/health', async (req, res) => {
  try {
    const browser = await browserManager.launch();
    const version = await browser.version();
    res.json({ code: 0, msg: 'ok', resultData: { browser: version, queueSize: posterQueue.size, pending: posterQueue.pending } });
  } catch (e) {
    res.status(500).json({ code: 500, msg: e.message });
  }
});

module.exports = router;
