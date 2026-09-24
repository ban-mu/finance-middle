/**
 * Chat 模块路由
 *  POST /api/chat/history   透传 finance-server
 *  POST /api/chat/join      透传 finance-server
 *  POST /api/chat/message    透传 finance-server
 */
const express = require('express');
const router = express.Router();
const downstream = require('../services/downstream');
const logger = require('../utils/logger');

async function forward(req, res, path) {
  try {
    const headers = {};
    const auth = req.headers.authorization;
    if (auth) headers.Authorization = auth;

    const resp = await downstream.raw({
      method: 'POST',
      url: `/api/chat/${path}`,
      data: req.body,
      headers,
      timeout: 8000,
      validateStatus: () => true
    });

    res.status(resp.status).json(resp.data);
  } catch (err) {
    logger.error('chat route error', { path, msg: err.message });
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({ code: 500, msg: 'chat service unavailable', resultData: null });
    }
  }
}

router.post('/history', (req, res) => forward(req, res, 'history'));
router.post('/join', (req, res) => forward(req, res, 'join'));
router.post('/message', (req, res) => forward(req, res, 'message'));

module.exports = router;
