/**
 * aggregationService
 *  - 并发调用多个下游接口
 *  - 根据客户端类型做数据裁剪、字段映射、金额时间格式化、空值兜底
 */
const downstream = require('./downstream');
const logger = require('../utils/logger');

const CLIENT_FIELDS = {
  // App 端：完整字段
  app: (data) => data,
  // PC 端：去掉一些只给 App 用的字段（示意）
  pc: (data) => data,
  // H5 端：精简字段
  h5: (banner) => (banner || []).map((b) => ({ id: b.id, title: b.title, imageUrl: b.imageUrl, link: b.link }))
};

function fmtMoney(n) {
  if (n === null || n === undefined) return '0.00';
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 聚合首页数据：banner + kingkong + hot + assets
 * @param {Object} ctx { client: 'app'|'pc'|'h5', userId }
 */
async function getHomeData(ctx = {}) {
  const client = (ctx.client || 'h5').toLowerCase();
  const t0 = Date.now();
  logger.info('aggregation start', { client });

  // 并发调用下游
  const [banner, kingkong, hot, assets] = await Promise.all([
    downstream.getBanner().catch((e) => { logger.error('banner fail', { msg: e.message }); return []; }),
    downstream.getKingkong().catch((e) => { logger.error('kingkong fail', { msg: e.message }); return []; }),
    downstream.getHot(5).catch((e) => { logger.error('hot fail', { msg: e.message }); return []; }),
    downstream.getAssets().catch((e) => { logger.error('assets fail', { msg: e.message }); return null; })
  ]);

  // 字段映射 + 格式化
  const trimBanner = (CLIENT_FIELDS[client] || CLIENT_FIELDS.h5)(banner);
  const trimAssets = assets && {
    ...assets,
    totalAssetsText: '¥' + fmtMoney(assets.totalAssets),
    yesterdayProfitText: (assets.yesterdayProfit >= 0 ? '+' : '-') + '¥' + fmtMoney(Math.abs(assets.yesterdayProfit)),
    cumulativeProfitText: '+¥' + fmtMoney(assets.cumulativeProfit),
    breakdown: (assets.breakdown || []).map((b) => ({ ...b, amountText: '¥' + fmtMoney(b.amount) }))
  };

  const data = {
    banner: trimBanner || [],
    kingkong: kingkong || [],
    hot: hot || [],
    assets: trimAssets || null
  };

  logger.info('aggregation done', { client, ms: Date.now() - t0 });
  return data;
}

module.exports = { getHomeData };
