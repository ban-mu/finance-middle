# Dockerfile for finance-middle
# 预装 Chromium + Noto Sans SC 中文字体，解决 Linux 中文乱码
FROM node:20-bookworm-slim

# 安装 Chromium 依赖 + 中文字体
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# 告诉 puppeteer 使用系统 chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# 已设置 PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium，
# puppeteer 检测到该变量后 postinstall 会自动跳过浏览器下载
COPY package.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 7002
CMD ["node", "src/app.js"]
