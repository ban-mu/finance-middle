/**
 * FundSync 模块路由
 *  POST /api/fundSync/list      透传 finance-server
 *  POST /api/fundSync/company   透传 finance-server
 *  POST /api/fundSync/manager    透传 finance-server
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
      url: `/api/fundSync${path}`,
      data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
      params: req.query,
      headers,
      validateStatus: () => true
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    logger.error('fundSync route error', { path, msg: err.message });
    res.status(502).json({ code: 502, msg: '基金同步服务暂不可用', resultData: null });
  }
}

router.post('/list', (req, res) => forward(req, res, '/list'));
router.post('/company', (req, res) => forward(req, res, '/company'));
router.post('/manager', (req, res) => forward(req, res, '/manager'));

module.exports = router;
