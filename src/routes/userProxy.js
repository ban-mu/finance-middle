/**
 * User 模块透传路由（BFF → finance-server）
 *
 * 前端只连 BFF(7002)，登录注册类请求由此原样转发到 finance-server(7001)：
 *   POST /api/user/register
 *   POST /api/user/login
 *   GET  /api/user/profile   （透传 Authorization 头）
 *
 * 透传时保留下游的 HTTP 状态码与响应体，前端无感知。
 */
const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config');
const logger = require('../utils/logger');

async function forward(req, res, path) {
  try {
    const headers = {};
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;

    const resp = await axios({
      method: req.method,
      url: `${config.downstream.base}/api/user${path}`,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      params: req.query,
      headers,
      validateStatus: () => true // 不因 4xx 抛异常，原样透传状态码
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    logger.error('user proxy error', { path, msg: err.message });
    res.status(502).json({ code: 502, msg: '用户服务暂不可用', data: null });
  }
}

router.post('/register', (req, res) => forward(req, res, '/register'));
router.post('/login', (req, res) => forward(req, res, '/login'));
router.get('/profile', (req, res) => forward(req, res, '/profile'));

module.exports = router;
