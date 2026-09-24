/**
 * wsService
 *  - WebSocket 实时消息：直播弹幕 / IM 聊天室
 *  - 本地单实例：使用 Map 维护在线用户
 *  - 多实例扩展时，把消息 publish 到 Redis，每个实例订阅并广播给本机连接
 *
 * 简化的 Redis pub/sub 设计（伪代码）：
 *   const redis = require('redis');
 *   const pub = redis.createClient(); const sub = redis.createClient();
 *   await sub.subscribe('im:broadcast', (msg) => broadcastLocal(JSON.parse(msg)));
 *   function broadcast(msg) { pub.publish('im:broadcast', JSON.stringify(msg)); }
 *
 * 本地开发先不依赖 Redis，使用 in-process 广播。
 */
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const rooms = new Map();      // roomId -> Set<WebSocket>
const userMap = new Map();    // ws -> { roomId, userId, name }

function heartbeat(ws) {
  ws.isAlive = true;
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

function setup(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    ws.id = uuidv4();
    ws.isAlive = true;
    ws.on('pong', () => heartbeat(ws));

    // 简化鉴权：从 url query 取 roomId/userId/name
    const url = new URL(req.url, 'http://localhost');
    const roomId = url.searchParams.get('roomId') || 'default';
    const userId = url.searchParams.get('userId') || ('anon_' + ws.id.slice(0, 6));
    const name = url.searchParams.get('name') || '匿名用户';

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(ws);
    userMap.set(ws, { roomId, userId, name });

    logger.info('ws connected', { roomId, userId, name });
    // 进入房间通知
    broadcast(roomId, { type: 'system', content: `${name} 进入直播间`, ts: Date.now() }, ws);

    ws.send(JSON.stringify({ type: 'hello', content: '欢迎来到直播间', ts: Date.now() }));

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) {
        ws.send(JSON.stringify({ type: 'error', content: 'invalid json' }));
        return;
      }
      const meta = userMap.get(ws);
      if (!meta) return;

      const payload = {
        type: msg.type || 'chat',
        roomId: meta.roomId,
        userId: meta.userId,
        name: meta.name,
        content: String(msg.content || '').slice(0, 500),
        ts: Date.now()
      };
      // 广播给房间内所有人（含发送者）
      broadcast(meta.roomId, payload);
    });

    ws.on('close', () => {
      const meta = userMap.get(ws);
      if (meta) {
        const set = rooms.get(meta.roomId);
        if (set) {
          set.delete(ws);
          if (set.size === 0) rooms.delete(meta.roomId);
        }
        userMap.delete(ws);
        broadcast(meta.roomId, { type: 'system', content: `${meta.name} 离开直播间`, ts: Date.now() });
        logger.info('ws closed', { roomId: meta.roomId, userId: meta.userId });
      }
    });
  });

  // 心跳检测
  const pingTimer = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(pingTimer));

  logger.info('websocket server ready at /ws');
  return wss;
}

module.exports = { setup };
