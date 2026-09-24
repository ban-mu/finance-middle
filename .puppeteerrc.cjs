/**
 * Puppeteer 浏览器下载配置
 *
 * 默认下载源是 https://storage.googleapis.com/chrome-for-testing-public，
 * 国内网络无法直连会导致 postinstall 下载失败。
 * 这里改为 npmmirror（阿里）镜像，目录结构与官方完全一致。
 *
 * 下载版本由 puppeteer 包内部锁定（23.11.1 -> Chrome for Testing 131.0.6778.204），
 * npm install 的 postinstall 会自动读取本配置。
 *
 * Docker 构建时通过环境变量 PUPPETEER_EXECUTABLE_PATH 指向系统 chromium，
 * puppeteer 检测到该变量会自动跳过下载，不受本配置影响。
 */
module.exports = {
  chrome: {
    downloadBaseUrl: 'https://cdn.npmmirror.com/binaries/chrome-for-testing'
  },
  'chrome-headless-shell': {
    downloadBaseUrl: 'https://cdn.npmmirror.com/binaries/chrome-for-testing'
  }
};
