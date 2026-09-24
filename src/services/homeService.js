/**
 * Home 模块服务（首页聚合）
 *
 * 职责：并发调下游接口、按端裁剪、字段映射、格式化
 * 随着首页业务增长（新增模块、新增端适配），在本文件内扩展即可。
 * 如果未来某个聚合逻辑变得很复杂（如直播页聚合），可拆成独立 service：
 *   services/liveService.js、services/fundService.js ...
 */
const downstream = require('./downstream');
const logger = require('../utils/logger');

// 各端字段裁剪策略
const CLIENT_FIELDS = {
  app: (data) => data,
  pc: (data) => data,
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
  logger.info('home aggregation start', { client });

  // 并发调用下游，单接口失败不阻塞整体（降级为空值）
  const [banner, kingkong, hot, assets] = await Promise.all([
    downstream.get('/api/banner').catch((e) => { logger.error('banner fail', { msg: e.message }); return []; }),
    downstream.get('/api/kingkong').catch((e) => { logger.error('kingkong fail', { msg: e.message }); return []; }),
    downstream.get('/api/hot', { params: { limit: 5 } }).catch((e) => { logger.error('hot fail', { msg: e.message }); return []; }),
    downstream.get('/api/assets').catch((e) => { logger.error('assets fail', { msg: e.message }); return null; })
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

  logger.info('home aggregation done', { client, ms: Date.now() - t0 });
  return data;
}

module.exports = { getHomeData };
