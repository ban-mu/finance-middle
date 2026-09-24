/**
 * finance-middle 入口
 *  - BFF 聚合接口：/api/home, /api/banner, /api/kingkong, /api/hot, /api/assets
 *  - 海报接口：    /api/poster/generate (POST), /api/poster/health
 *  - 用户接口：    /api/user/register|login|profile（透传 finance-server）
 *  - 基金接口：    /api/fund/*, /api/fundSync/*（透传 finance-server）
 *  - 聊天接口：    /api/chat/join|message|history（透传 finance-server）
 *  - WebSocket：    /im?token=xxx（BFF 层承载长连接，消息持久化走 server API）
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
const routes = require('./routes');
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
app.get('/health', (req, res) => res.json({ code: 0, msg: 'ok', resultData: { service: 'finance-middle', ts: Date.now() } }));

// ===== 业务路由（统一入口） =====
app.use('/api', routes);

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
  logger.info(`websocket endpoint: ws://localhost:${config.port}/im`);
});
