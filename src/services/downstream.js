/**
 * 下游服务调用客户端：基于 axios
 *  - 集中管理 finance-server 各接口地址
 *  - 统一超时、错误处理
 */
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const http = axios.create({
  baseURL: config.downstream.base,
  timeout: 8000
});

// 简单请求日志
http.interceptors.request.use((cfg) => {
  logger.info('downstream request', { method: cfg.method, url: cfg.url });
  return cfg;
});
http.interceptors.response.use(
  (res) => res,
  (err) => {
    logger.error('downstream error', { url: err.config && err.config.url, msg: err.message });
    return Promise.reject(err);
  }
);

const downstream = {
  async getBanner() {
    const { data } = await http.get('/api/banner');
    return data && data.data;
  },
  async getKingkong() {
    const { data } = await http.get('/api/kingkong');
    return data && data.data;
  },
  async getHot(limit) {
    const { data } = await http.get('/api/hot', { params: { limit } });
    return data && data.data;
  },
  async getAssets() {
    const { data } = await http.get('/api/assets');
    return data && data.data;
  }
};

module.exports = downstream;
