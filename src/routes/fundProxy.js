/**
 * Fund 模块透传路由（BFF → finance-server）
 *   POST /api/fund/list
 *   POST /api/fund/company
 *   POST /api/fund/manager
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
      url: `${config.downstream.base}/api/fund${path}`,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      params: req.query,
      headers,
      validateStatus: () => true
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    logger.error('fund proxy error', { path, msg: err.message });
    res.status(502).json({ code: 502, msg: '基金服务暂不可用', data: null });
  }
}

router.post('/list',    (req, res) => forward(req, res, '/list'));
router.post('/company', (req, res) => forward(req, res, '/company'));
router.post('/manager', (req, res) => forward(req, res, '/manager'));

module.exports = router;
