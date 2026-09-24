/**
 * finance-middle 入口
 *  - BFF 聚合接口：/api/home, /api/banner, /api/kingkong, /api/hot, /api/assets
 *  - 海报接口：    /api/poster/generate (POST), /api/poster/health
 *  - 用户接口：    /api/user/register|login|profile（透传 finance-server）
 *  - WebSocket：    /ws?roomId=xxx&userId=xxx&name=xxx
 *
 * 端口：7002
 */
const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const config = require('./config');
const logger = require('./utils/logger');
const aggregateRouter = require('./routes/aggregate');
const instPosterRouter = require('./routes/instPoster');
const userProxyRouter = require('./routes/userProxy');
const fundProxyRouter = require('./routes/fundProxy');
const fundSyncProxyRouter = require('./routes/fundSyncProxy');
const wsService = require('./services/wsService');

const app = express();
const server = http.createServer(app);

// ===== 中间件 =====
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// 静态：海报预览页等（可选）
app.use('/static', express.static(path.join(__dirname, 'public')));

// 健康检查
app.get('/health', (req, res) => res.json({ code: 0, msg: 'ok', data: { service: 'finance-middle', ts: Date.now() } }));

// ===== 业务路由 =====
app.use('/api', aggregateRouter);
app.use('/api/poster', instPosterRouter);
app.use('/api/user', userProxyRouter);         // 登录/注册/个人信息透传到 finance-server
app.use('/api/fund', fundProxyRouter);         // 基金查询透传到 finance-server
app.use('/api/fundSync', fundSyncProxyRouter); // 基金同步透传到 finance-server

// ===== 全局异常捕获 =====
app.use((err, req, res, next) => {
  logger.error('uncaught error', { msg: err.message, stack: err.stack });
  res.status(500).json({ code: 500, msg: 'server error', error: err.message });
});

// ===== WebSocket =====
wsService.setup(server);

// 优雅退出：关闭浏览器、关闭 server
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  const browserManager = require('./services/poster/BrowserManager');
  await browserManager.destroy();
  server.close(() => process.exit(0));
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  const browserManager = require('./services/poster/BrowserManager');
  await browserManager.destroy();
  server.close(() => process.exit(0));
});

server.listen(config.port, () => {
  logger.info(`finance-middle listening on http://localhost:${config.port}`);
  logger.info(`websocket endpoint: ws://localhost:${config.port}/ws`);
});
