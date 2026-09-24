/**
 * posterService
 *  - 用 Nunjucks 把业务参数渲染到模板 HTML
 *  - qrcode 生成 DataURL 嵌入模板
 *  - 调用 screenshotService 截图
 *  - colorthief 提取主色调（用于直播 banner 自动配色，可选）
 */
const nunjucks = require('nunjucks');
const QRCode = require('qrcode');
const ColorThief = require('colorthief');
const path = require('path');
const config = require('../../config');
const logger = require('../../utils/logger');
const screenshotService = require('./screenshotService');

// 配置 Nunjucks：从 app/assets/njk/inst/ 读取模板
const njkEnv = nunjucks.configure(path.join(config.paths.njk, 'inst'), {
  autoescape: false,
  watch: false,
  noCache: true
});

/**
 * 支持的海报类型 -> 模板文件名
 */
const TEMPLATE_MAP = {
  banner:   'banner.njk',
  cover:    'cover.njk',
  live:     'live.njk',
  strategy: 'strategy.njk',
  video:    'video.njk',
  charts:   'charts.njk'
};

// 各类型默认尺寸（设计稿）
const DEFAULT_SIZE = {
  banner:   { width: 750, height: 350 },
  cover:    { width: 750, height: 1000 },
  live:     { width: 750, height: 1334 },
  strategy: { width: 750, height: 1200 },
  video:    { width: 750, height: 1000 },
  charts:   { width: 750, height: 1000 }
};

/**
 * 生成二维码 DataURL
 */
async function genQrDataUrl(text) {
  if (!text) return '';
  return QRCode.toDataURL(text, { margin: 1, width: 240 });
}

/**
 * 提取主色调（异步，失败回退默认色）
 */
async function extractPrimary(rgbFallback) {
  try {
    // colorthief 需要图片路径/URL，这里直接返回 fallback
    // 实际项目可对 live banner 主图提取
    return rgbFallback || '#FF6B6B';
  } catch (e) {
    return rgbFallback || '#FF6B6B';
  }
}

/**
 * 生成海报
 * @param {Object} params
 * @param {string} params.type       banner/cover/live/...
 * @param {Object} params.data       业务数据（标题、副标题、价格、二维码内容等）
 * @param {('png'|'pdf')} [params.format]
 * @returns {Promise<Buffer>}
 */
async function generate(params) {
  const { type, data = {}, format = 'png' } = params;
  const templateFile = TEMPLATE_MAP[type];
  if (!templateFile) {
    const err = new Error(`unsupported poster type: ${type}`);
    err.code = 'BAD_TYPE';
    throw err;
  }
  const size = DEFAULT_SIZE[type] || { width: 750, height: 1000 };

  // 生成二维码
  const qrText = data.qrText || data.link || 'https://example.com';
  const qrDataUrl = await genQrDataUrl(qrText);

  // 直播 banner 自动配色
  const primaryColor = await extractPrimary(data.primaryColor);

  // 渲染模板
  const html = njkEnv.render(templateFile, {
    ...data,
    qrDataUrl,
    primaryColor,
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false })
  });

  logger.info('poster render', { type, bytes: html.length, format });

  // 截图
  const buffer = await screenshotService.takeScreenshot({
    html,
    width: size.width,
    height: size.height,
    format
  });

  return buffer;
}

module.exports = { generate };
