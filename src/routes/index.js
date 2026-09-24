/**
 * 路由总入口（唯一暴露给 app.js 的路由文件）
 *
 * app.js 只需要：
 *   const routes = require('./routes');
 *   app.use('/api', routes);
 *
 * 新增业务模块只需：
 *   1. 新建 routes/xxx.js
 *   2. 在本文件加一行：router.use('/xxx', xxxRouter)
 */
const express = require('express');
const router = express.Router();

const homeRouter = require('./home');
const instPosterRouter = require('./instPoster');
const userRouter = require('./user');
const fundRouter = require('./fund');
const fundSyncRouter = require('./fundSync');
const chatRouter = require('./chat');

// 首页聚合：/api/home、/api/banner、/api/kingkong、/api/hot、/api/assets
router.use('/', homeRouter);

// 海报：/api/poster/generate、/api/poster/health
router.use('/poster', instPosterRouter);

// 用户：/api/user/register、/api/user/login、/api/user/profile
router.use('/user', userRouter);

// 基金查询：/api/fund/list、/api/fund/company、/api/fund/manager
router.use('/fund', fundRouter);

// 基金同步：/api/fundSync/list、/api/fundSync/company、/api/fundSync/manager
router.use('/fundSync', fundSyncRouter);

// 聊天：/api/chat/history、/api/chat/join、/api/chat/message
// 实时收发走 WebSocket（见 wsService），持久化/查询走 REST 透传
router.use('/chat', chatRouter);

module.exports = router;
