/**
 * BFF 聚合接口
 *  GET /api/home?client=h5&userId=U_10086
 *  并发调用 banner/kingkong/hot/assets 并按 client 类型裁剪
 */
const express = require('express');
const router = express.Router();
const aggregationService = require('../services/aggregationService');
const logger = require('../utils/logger');

router.get('/home', async (req, res, next) => {
  try {
    const { client = 'h5', userId } = req.query;
    const data = await aggregationService.getHomeData({ client, userId });
    res.json({ code: 0, msg: 'ok', data });
  } catch (err) {
    logger.error('home aggregate error', { msg: err.message, stack: err.stack });
    next(err);
  }
});

// 透传单接口（便于前端按需调用）
const downstream = require('../services/downstream');
router.get('/banner',   async (req, res, next) => { try { res.json({ code: 0, msg: 'ok', data: await downstream.getBanner() }); } catch (e) { next(e); } });
router.get('/kingkong', async (req, res, next) => { try { res.json({ code: 0, msg: 'ok', data: await downstream.getKingkong() }); } catch (e) { next(e); } });
router.get('/hot',      async (req, res, next) => { try { res.json({ code: 0, msg: 'ok', data: await downstream.getHot(req.query.limit) }); } catch (e) { next(e); } });
router.get('/assets',   async (req, res, next) => { try { res.json({ code: 0, msg: 'ok', data: await downstream.getAssets() }); } catch (e) { next(e); } });

module.exports = router;
