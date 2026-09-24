/**
 * Home 模块路由
 *  GET /api/home          首页聚合数据（并发调 banner/kingkong/hot/assets，按端裁剪）
 *  GET /api/banner         透传单接口
 *  GET /api/kingkong       透传单接口
 *  GET /api/hot            透传单接口
 *  GET /api/assets         透传单接口
 */
const express = require('express');
const router = express.Router();
const homeService = require('../services/homeService');
const downstream = require('../services/downstream');
const logger = require('../utils/logger');

// 首页聚合
router.get('/home', async (req, res, next) => {
  try {
    const { client = 'h5', userId } = req.query;
    const data = await homeService.getHomeData({ client, userId });
    res.json({ code: 0, msg: 'ok', resultData: data });
  } catch (err) {
    logger.error('home aggregate error', { msg: err.message, stack: err.stack });
    next(err);
  }
});

// 透传单接口（便于前端按需调用）—— 纯透明转发，保留 server 原始状态码 + 响应体
async function forward(req, res, path) {
  try {
    const headers = {};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;

    const resp = await downstream.raw({
      method: req.method,
      url: `/api${path}`,
      params: req.query,
      headers,
      validateStatus: () => true
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    logger.error('home route error', { path, msg: err.message });
    res.status(502).json({ code: 502, msg: '首页服务暂不可用', resultData: null });
  }
}

router.get('/banner',   (req, res) => forward(req, res, '/banner'));
router.get('/kingkong', (req, res) => forward(req, res, '/kingkong'));
router.get('/hot',      (req, res) => forward(req, res, '/hot'));
router.get('/assets',   (req, res) => forward(req, res, '/assets'));

module.exports = router;
