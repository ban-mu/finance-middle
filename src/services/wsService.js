/**
 * wsService — BFF 层 WebSocket 直播间聊天
 *
 * 职责：实时收发 + 广播（内存）
 * 不碰数据库：消息持久化/历史查询走 finance-server REST API
 *
 * 协议（JSON 文本帧，与前端 useChat.js 对齐）：
 *  客户端 → 服务端：{ type: 'join', activityId }     加入直播间
 *  服务端 → 客户端：{ type: 'joined', activityId, username }
 *  客户端 → 服务端：{ type: 'chat', activityId, content }
 *  服务端 → 客户端：{ type: 'chat', id, activityId, from, content, sentAt }
 *  客户端 → 服务端：{ type: 'ping' }
 *  服务端 → 客户端：{ type: 'pong', ts }
 *  服务端 → 客户端：{ type: 'error', msg }
 *
 * 鉴权：浏览器 WS 不支持自定义 header，token 放 query（与 finance-server 的 /im 一致）
 *
 * 心跳（服务端协议层）：30s ping，浏览器自动回 pong，连续无 pong → terminate
 *
 * 多实例扩展：把 broadcast 改成 Redis Pub/Sub（见底部注释）
 */
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const downstream = require('./downstream');

const HEARTBEAT_INTERVAL = 30 * 1000;
const MAX_PER_SECOND = 20;

// activityId -> Set<WebSocket>（房间登记表，纯内存，服务重启即清空）
const rooms = new Map();
// ws -> { activityId, uid, username, sendTimes }（连接元信息）
const userMap = new Map();

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function broadcast(roomId, payload, exceptWs) {
  const set = rooms.get(roomId);
  if (!set) return;
  const text = JSON.stringify(payload);
  set.forEach((client) => {
    if (client !== exceptWs && client.readyState === 1 /* OPEN */) {
      client.send(text);
    }
  });
}

// 从 query 解析并验证 JWT，成功返回 { uid, username }
function verifyToken(url) {
  const token = url.searchParams.get('token') || '';
  if (!token) return null;
  try {
    return jwt.verify(token, config.jwt?.secret || process.env.JWT_SECRET || 'finance-secret');
  } catch {
    return null;
  }
}

// 退出当前直播间
function leaveRoom(ws) {
  const meta = userMap.get(ws);
  if (!meta) return;
  const { activityId, username } = meta;
  const set = rooms.get(activityId);
  if (set) {
    set.delete(ws);
    if (!set.size) rooms.delete(activityId);
  }
  userMap.delete(ws);
  if (activityId) {
    broadcast(activityId, { type: 'system', content: `${username} 离开直播间`, ts: Date.now() });
  }
  logger.info('ws closed', { activityId, username });
}

// 加入直播间：调 server API 落库（upsert room），本地登记广播
async function handleJoin(ws, meta, data) {
  const activityId = String(data.activityId || '').trim();
  if (!activityId) return send(ws, { type: 'error', msg: 'activityId 不能为空' });

  // 调 finance-server 持久化（room upsert），不直接操作 MongoDB
  try {
    await downstream.post('/api/chat/join', { activityId }, {
      headers: { Authorization: `Bearer ${meta.token}` }
    });
  } catch (err) {
    logger.error('chat/join downstream error', { msg: err.message });
    return send(ws, { type: 'error', msg: '加入直播间失败' });
  }

  // 本地房间登记
  meta.activityId = activityId;
  if (!rooms.has(activityId)) rooms.set(activityId, new Set());
  rooms.get(activityId).add(ws);

  send(ws, { type: 'joined', activityId, username: meta.username });
  broadcast(activityId, { type: 'system', content: `${meta.username} 进入直播间`, ts: Date.now() }, ws);
  logger.info('ws joined', { activityId, username: meta.username, online: rooms.get(activityId).size });
}

// 发言：调 server API 落库（message create），服务端返回 id/sentAt 后广播
async function handleChat(ws, meta, data) {
  const activityId = String(data.activityId || meta.activityId || '').trim();
  const content = String(data.content || '').trim().slice(0, 2000);
  if (!activityId) return send(ws, { type: 'error', msg: '请先 join 直播间' });
  if (activityId !== meta.activityId) return send(ws, { type: 'error', msg: '请先 join 该直播间' });
  if (!content) return send(ws, { type: 'error', msg: 'content 不能为空' });

  // 限频：滑动窗口 1 秒最多 20 条
  const now = Date.now();
  meta.sendTimes = (meta.sendTimes || []).filter((t) => now - t < 1000);
  if (meta.sendTimes.length >= MAX_PER_SECOND) {
    return send(ws, { type: 'error', msg: '发送太频繁，请稍后再试' });
  }
  meta.sendTimes.push(now);

  // 调 finance-server 持久化消息，拿回 id + sentAt
  let saved;
  try {
    const res = await downstream.post('/api/chat/message', { activityId, content }, {
      headers: { Authorization: `Bearer ${meta.token}` }
    });
    if (res.code !== 0) return send(ws, { type: 'error', msg: res.msg || '消息入库失败' });
    saved = res.resultData;
  } catch (err) {
    logger.error('chat/message downstream error', { msg: err.message });
    return send(ws, { type: 'error', msg: '消息发送失败' });
  }

  // 广播给房间内所有人（含发送者）
  const payload = {
    type: 'chat',
    id: saved.id,
    activityId,
    from: saved.from,
    content: saved.content,
    sentAt: saved.sentAt
  };
  broadcast(activityId, payload);
}

function setup(server) {
  const wss = new WebSocketServer({ noServer: true });

  // HTTP 服务收到升级请求时触发 —— WS 入口
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/im') {
      socket.destroy();
      return;
    }

    const payload = verifyToken(url);
    if (!payload) {
      // 握手阶段拒绝：此时还是 HTTP 语义
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // 完成协议升级
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, { uid: payload.uid, username: payload.username, token: url.searchParams.get('token') });
    });
  });

  wss.on('connection', (ws, user) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    const meta = { activityId: null, uid: user.uid, username: user.username, token: user.token, sendTimes: [] };
    userMap.set(ws, meta);

    send(ws, { type: 'connected', username: user.username });
    logger.info('ws connected', { username: user.username });

    ws.on('message', async (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return send(ws, { type: 'error', msg: '消息格式必须是 JSON' });
      }

      const m = userMap.get(ws);
      if (!m) return;

      // 应用层心跳
      if (data.type === 'ping') {
        return send(ws, { type: 'pong', ts: Date.now() });
      }

      try {
        if (data.type === 'join') await handleJoin(ws, m, data);
        else if (data.type === 'chat') await handleChat(ws, m, data);
        else send(ws, { type: 'error', msg: `不支持的 type: ${data.type}` });
      } catch (err) {
        logger.error('ws message handler error', { msg: err.message, stack: err.stack });
        send(ws, { type: 'error', msg: '消息处理失败' });
      }
    });

    ws.on('close', () => leaveRoom(ws));
  });

  // 心跳检测（服务端协议层）
  const pingTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('close', () => clearInterval(pingTimer));

  logger.info('websocket server ready at /im');
  return wss;

  /*
   * 多实例扩展（Redis Pub/Sub）：
   *   本地 broadcast 只能推到本机连接，多实例部署时需要跨机转发。
   *   const redis = require('redis');
   *   const pub = redis.createClient(); const sub = redis.createClient();
   *   await sub.subscribe('im:broadcast', (msg) => {
   *     const { activityId, payload } = JSON.parse(msg);
   *     broadcastLocal(activityId, payload);  // 只广播本机的连接
   *   });
   *   function broadcast(activityId, payload) {
   *     pub.publish('im:broadcast', JSON.stringify({ activityId, payload }));
   *   }
   */
}

module.exports = { setup };
