/**
 * 下游服务调用客户端（finance-server）
 *
 * 职责：只提供 HTTP 调用能力，不含业务逻辑
 *  - get(url, config)         GET 请求，返回 data.data
 *  - post(url, data, config)  POST 请求，返回 res.data（完整响应体）
 *  - raw(config)              原始 axios 调用，返回完整 axios response（路由透传用）
 *
 * 业务聚合逻辑放在各模块 service 文件里（homeService.js 等），
 * 不在这里堆业务方法，便于按模块扩展。
 */
const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

const http = axios.create({
  baseURL: config.downstream.base,
  timeout: 8000
});

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
  /** GET 请求，返回业务 resultData 字段 */
  async get(url, axiosConfig = {}) {
    const { data } = await http.get(url, axiosConfig);
    return data && data.resultData;
  },

  /** POST 请求，返回完整业务响应体 */
  async post(url, body, axiosConfig = {}) {
    const { data } = await http.post(url, body, axiosConfig);
    return data;
  },

  /** 原始 axios 调用，返回完整 response（路由透传用，需要拿到 status code） */
  async raw(axiosConfig) {
    return http(axiosConfig);
  }
};

module.exports = downstream;
