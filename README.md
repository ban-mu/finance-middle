# finance-middle

理财 BFF 中间层（Node.js + Express）。
- **BFF 接口聚合**：并发调用 `finance-server` 多个接口，按客户端类型（App/PC/H5）做数据裁剪、字段映射、金额格式化、空值兜底
- **海报生成**：Nunjucks 模板 + qrcode + Puppeteer Headless Chromium 截图，输出 PNG / PDF
- **WebSocket 实时消息**：直播弹幕 / IM 聊天室（本地单实例；多实例时通过 Redis pub/sub 广播）
- **并发控制**：p-queue 限制最大并发 8，单任务 120s 超时熔断
- **浏览器管理**：BrowserManager 单例，启动重试、崩溃自动恢复，IncognitoBrowserContext 隔离每个任务
- **图片处理**：sharp 截图后缩放/压缩，colorthief 提取主色调（直播 banner 自动配色）
- **日志**：Winston 结构化日志 + 按天轮转

## 端口
- `7002`

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET  | `/health` | 健康检查 |
| GET  | `/api/home?client=h5&userId=U_10086` | BFF 聚合首页数据（banner+kingkong+hot+assets） |
| GET  | `/api/banner` `/api/kingkong` `/api/hot` `/api/assets` | 透传下游接口 |
| POST | `/api/poster/generate` | 海报生成，返回图片二进制流 |
| GET  | `/api/poster/health` | 海报服务健康检查（含 puppeteer 版本） |
| POST | `/api/user/register`、`/api/user/login`，GET `/api/user/profile` | 用户模块透传到 finance-server（保留下游状态码，透传 Authorization 头） |
| WS   | `/ws?roomId=xxx&userId=xxx&name=xxx` | 直播弹幕 / IM |

### 海报生成接口示例

```bash
curl -X POST http://localhost:7002/api/poster/generate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "banner",
    "format": "png",
    "data": {
      "title": "稳健理财节 最高年化6.8%",
      "subtitle": "严选优质资产",
      "badge": "官方活动",
      "period": "2026.09.17 - 10.17",
      "qrText": "https://example.com/activity/1",
      "primaryColor": "#5B6FED"
    }
  }' --output poster.png
```

支持的海报类型：`banner` / `cover` / `live` / `strategy` / `video` / `charts`。

## 本地运行

```bash
cd finance-middle
npm install
npm run dev                  # http://localhost:7002
```

> `npm install` 时 Puppeteer 的 postinstall 会自动下载与 puppeteer 版本**精确匹配**的
> Chrome for Testing（23.11.1 对应 `131.0.6778.204`），约 255MB。
>
> 官方下载源 `storage.googleapis.com` 国内无法直连，项目根目录 [.puppeteerrc.cjs](./.puppeteerrc.cjs)
> 已把下载源改为 npmmirror 镜像（`https://cdn.npmmirror.com/binaries/chrome-for-testing`），
> 直接 `npm install` 即可自动完成，无需翻墙、不依赖本机安装的 Chrome。
>
> 也可手动安装：
> ```bash
> npx puppeteer browsers install chrome@131.0.6778.204 --base-url=https://cdn.npmmirror.com/binaries/chrome-for-testing
> ```
>
> 浏览器缓存位置：`~/.cache/puppeteer/`。
> Docker 部署时通过环境变量 `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` 改用系统 chromium，
> Puppeteer 检测到该变量会自动跳过下载。

## Docker 部署

```bash
docker build -t finance-middle .
docker run -p 7002:7002 -e FINANCE_SERVER=http://host.docker.internal:7001 finance-middle
```

Docker 镜像预装 Chromium + Noto Sans SC 中文字体，解决 Linux 中文乱码问题。

## 目录结构

```
finance-middle
├── package.json
├── .puppeteerrc.cjs             # Puppeteer 浏览器下载镜像配置（npmmirror）
├── Dockerfile
├── README.md
└── src
    ├── app.js                          # 入口
    ├── config/index.js
    ├── utils/logger.js
    ├── services
    │   ├── downstream.js               # 下游 axios 客户端
    │   ├── aggregationService.js       # BFF 聚合
    │   ├── wsService.js                # WebSocket 直播弹幕
    │   └── poster
    │       ├── BrowserManager.js       # Puppeteer 单例
    │       ├── screenshotService.js    # 截图 + sharp 后处理
    │       ├── posterQueue.js          # p-queue 并发控制
    │       └── posterService.js        # Nunjucks + qrcode 渲染
    ├── routes
    │   ├── aggregate.js                # BFF 聚合路由
    │   └── instPoster.js               # 海报接口
    └── assets/njk/inst
        ├── banner.njk
        ├── cover.njk
        ├── live.njk
        ├── strategy.njk
        ├── video.njk
        └── charts.njk
```
