/**
 * User 模块路由
 *  POST /api/user/register   透传 finance-server
 *  POST /api/user/login      透传 finance-server
 *  GET  /api/user/profile    透传 finance-server（需 Authorization）
 */
const express = require('express');
const router = express.Router();
const downstream = require('../services/downstream');
const logger = require('../utils/logger');

async function forward(req, res, path) {
  try {
    const headers = {};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;

    const resp = await downstream.raw({
      method: req.method,
      url: `/api/user${path}`,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      params: req.query,
      headers,
      validateStatus: () => true
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    logger.error('user route error', { path, msg: err.message });
    res.status(502).json({ code: 502, msg: '用户服务暂不可用', resultData: null });
  }
}

router.post('/register', (req, res) => forward(req, res, '/register'));
router.post('/login', (req, res) => forward(req, res, '/login'));
router.get('/profile', (req, res) => forward(req, res, '/profile'));

module.exports = router;
