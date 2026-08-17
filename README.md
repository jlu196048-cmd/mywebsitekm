# mywebsite

一个**极简、中英双语**的个人网站 / 小博客，自带后台管理，支持一键部署到 **Cloudflare Pages**。

参考了 [nicknow.net](https://nicknow.net/) 的版式和 PaperMod 主题的配色：白底、衬线标题、清晰的卡片式文章列表、顶部水平导航。

---

## 功能一览

- **公开页面**：首页（简介 + 最新文章）、博客列表、文章详情、关于、联系
- **中英双语**：每篇文章、简介、关于都有 `{ zh, en }` 两个版本，顶部一键切换
- **暗色模式**：跟随系统，也可手动切换（记忆到 localStorage）
- **响应式**：在手机 / 平板 / 桌面上都能正常阅读
- **管理后台**（`/admin`）：
  - 账号 + 密码登录（bcrypt + JWT，token 存 localStorage）
  - 文章：新建、编辑、删除、隐藏/显示（草稿 ↔ 已发布 ↔ 隐藏）
  - 图片：拖拽上传 / 删除 / 复制链接，自动用作文章封面
  - 个人信息：站点名称、头像、首页介绍、关于页内容、联系方式
  - 修改密码
- **数据存储**：本地用 `data/*.json`；Cloudflare 用 KV（内容）+ R2（图片）
- **零数据库**：纯文件存储，单机能跑，云端一份 KV 也能撑起来
- **内置 4 篇演示文章**（中英双语）

---

## 目录结构

```
mywebsite/
├── package.json
├── wrangler.toml                 # Cloudflare Pages 配置
├── web.config                    # IIS + iisnode 配置
├── deploy-iis.ps1                # 一键注册 IIS 站点
├── server.js                     # iisnode 入口（同一份代码兼容 iis / npm）
├── README.md
├── web.config                    # IIS 配置（站点根直接放进去即用）
├── start-mywebsite.cmd            # 后端 Node 启动脚本（端口 3001）
├── setup-iis-site.ps1             # 一键把当前目录注册成 IIS 站点
├── setup-iis-site.cmd             # 同上的 .cmd 版（更通用）
├── setup-autostart.ps1            # 后端 Node 开机自启动（计划任务）
├── enable-arr.ps1                 # 安装 + 启用 ARR 代理
├── server/                        # 本地 Node.js (Express) 后端
│   ├── index.js
│   ├── auth.js                   # bcrypt + JWT
│   ├── posts.js                  # 文章业务逻辑
│   ├── store.js                  # JSON 文件持久化
│   └── seed.js                   # 4 篇演示文章 + 演示 profile
├── functions/                    # Cloudflare Pages Functions (Worker)
│   ├── _shared.js
│   ├── _posts.js
│   └── api/
│       ├── profile.js
│       ├── posts/
│       │   ├── index.js          # GET 列表 / POST 新建
│       │   ├── [id].js           # GET / PUT / DELETE
│       │   └── [id]/toggle.js    # POST 切换状态
│       ├── contact.js
│       ├── images.js             # 列表 / 上传 (走 R2)
│       ├── images/[name].js      # 读 / 删除
│       └── admin/
│           ├── login.js
│           ├── logout.js
│           ├── status.js
│           └── password.js
├── data/                         # 本地持久化（JSON）
│   ├── posts.json
│   ├── profile.json
│   ├── admin.json
│   └── messages.json
└── public/                       # 前端静态文件 (HTML + CSS + JS + 图片)
    ├── _redirects                # Cloudflare Pages 重写规则
    ├── _headers                  # Cloudflare Pages 缓存/安全头
    ├── index.html                # 首页
    ├── about.html
    ├── blog.html
    ├── post.html
    ├── contact.html
    ├── css/style.css
    ├── js/
    │   ├── i18n.js               # 中英英翻译字典
    │   ├── app.js                # fetch 帮助 + Markdown 渲染 + toast
    │   └── layout.js             # 导航 / 页脚 / 主题切换
    ├── images/
    │   ├── favicon.svg
    │   └── cover-*.svg           # 演示文章封面
    └── admin/
        ├── index.html            # 登录页
        └── dashboard.html        # 后台主面板
```

---

## 快速开始 (本地)

要求：**Node.js 18+**

```bash
cd mywebsite
npm install
npm run seed     # 写入 4 篇演示文章 + 演示 profile
npm start        # 启动 Express 服务，访问 http://localhost:3000
```

打开：

- 公开站点：**http://localhost:3000**
- 后台登录：**http://localhost:3000/admin**
  - 默认账号：`admin`
  - 默认密码：`admin123`
  - 登录后请立即到 **Account → Change Password** 修改

### 自定义账号 / 端口

通过环境变量即可：

```bash
PORT=8080 \
ADMIN_USERNAME=alice \
ADMIN_PASSWORD='your-strong-password' \
FORCE_ADMIN_RESET=1 \
npm start
```

`FORCE_ADMIN_RESET=1` 会用新的账号覆盖 `data/admin.json`。

---

## 在本机 IIS 上发布（**双架构**，前后端不耦合）

适用：把 `C:\My-workspace\mywebsite\public` 设成 IIS 站点根，就能跑完整功能。**不再需要任何额外 IIS 模块**（iisnode / URL Rewrite / ARR 都不需要）。

**架构（默认 - 跨端口直连）**：

```
浏览器 → IIS 8080（站点根 = public/，仅做静态 + 清洁 URL）
        ↓
        ↓ fetch('/api/...')
        ↓
        ✗（跨源，因端口不同）→ Node 3001（start-mywebsite.cmd，CORS 已开启）
        ↘ 浏览器自动跨端口访问 Node，IIS 完全不参与 /api/*
```

**架构 A（同源，纯净 - 装了 ARR 后可选）**：

```
浏览器 → IIS 8080 → 静态（直出）/api/* → ARR 反代 → Node 3001（同源 fetch）
```

**两种工作方式都被应用层自动适配**：前端 `public/js/app.js` 启动时**先试同源**，失败则 fallback 到 `http://127.0.0.1:3001`。所以 IIS 配置可以做到**完全干净**，不需要任何代理模块。

### 一次性环境准备

1. **启用 IIS**（如未启用）
   - 控制面板 → 程序与功能 → 启用或关闭 Windows 功能
   - 勾选「Internet Information Services」全部展开项；至少：Web 管理工具 + 万维网服务（常见 HTTP 功能、静态内容、HTTP 重定向）

2. **Node.js 18+** 推荐装到 `C:\Program Files\nodejs\`

> **本方案不再依赖任何额外 IIS 模块**——iisnode / URL Rewrite / ARR 都不需要。

### 一键部署

打开**管理员 PowerShell**，跑：

```powershell
cd C:\My-workspace\mywebsite

# 1. 注册 IIS 站点
.\setup-iis-site.ps1

# 2. 启动后端 Node
.\start-mywebsite.cmd
```

`setup-iis-site.ps1` 会：
- 删除已有的同名 IIS 站点（如有）
- 创建名为 **mywebsite** 的站点，监听 `8080`（可用 `-Port 9000` 改）
- 物理路径 = `.\public`（不是项目根）
- 创建配套 AppPool，开启 AlwaysRunning
- 给 `.\public\images\` 和 `.\data\` 加 `IIS_IUSRS` 读写权限
- 自动打开浏览器到后台登录页

启动后端可选：
```powershell
# 前台窗口（保持开着）
.\start-mywebsite.cmd

# 或：要后台 + 开机自启
.\setup-autostart.ps1
```

卸载：
```powershell
.\setup-iis-site.ps1 -Uninstall   # 删除 IIS 站点
.\setup-autostart.ps1 -Uninstall  # 删计划任务
```

### 在 IIS 管理器里手动添加

1. 打开 IIS 管理器 → 服务器根节点 → "Add Website..."
2. Site name：`mywebsite`
3. Physical path：**`C:\My-workspace\mywebsite\public`**（注意是 `public` 子目录）
4. Port：`8080`
5. 确认 → 完成
6. 验证 `C:\My-workspace\mywebsite\public\web.config` 存在

> 物理路径必须是 `public\`，不是项目根。理由：`index.html`、`about.html`、`blog.html` 都在 `public/` 里，IIS 默认文档机制需要直接看到它们。

### 访问地址

| URL | 内容 |
|---|---|
| `http://localhost:8080/`        | 公开首页（IIS 服务） |
| `http://localhost:8080/about`   | About（清洁 URL） |
| `http://localhost:8080/blog`    | 博客列表 |
| `http://localhost:8080/post?id=...` | 文章详情 |
| `http://localhost:8080/contact` | 联系页 |
| `http://localhost:8080/admin`   | 后台登录（默认 `admin / admin123`） |
| `http://localhost:3001/api/...` | JSON API 直连（跨端口；前端会自动跳到这里） |

### 工作机制详解

`public/web.config` 里的 rewrite 规则（按顺序匹配）：

| # | 规则 | 作用 |
|---|---|---|
| 1 | BlockCloudflareOnly | 拦截对 `_redirects`、`_headers` 等 Cloudflare-only 文件的访问 |
| 2 | StaticFiles | 已经在磁盘上的文件（CSS/JS/HTML/图片）直接由 IIS 返回 |
| 3 | PrettyUrls | `/about` → `about.html`，`/blog` → `blog.html` 等 |
| 4 | AdminSpa | `/admin/*` → `admin/dashboard.html` |

`/api/*` 请求**不进 web.config**，由前端 JS 自动判断访问源：
- 试 `http://localhost:8080/api/...`（IIS 同源代理，要求 ARR）
- 网络错误或 5xx → 改 `http://127.0.0.1:3001/api/...`（Node 直连，无需任何额外模块）

后端的 CORS 已配置允许 `http://127.0.0.1:8080` 等同主机跨端口访问（`ALLOW_ORIGIN` 环境变量可调）。

### 可选：装上 ARR 后启用同源模式

如果你以后 `enable-arr.ps1` 装上了 ARR 并启用，主脚本会自动改用同源路径（前端 fetch 试 `/api/...` 成功就用它，跨端口 fallback 永远存在不影响）。也就是说：

- **没装 ARR** → 跨端口 fallback 工作正常
- **装了 ARR** → 同源优先，跨端口 fallback 仅做兜底

### 调试

- **Node 后端日志**：`start-mywebsite.cmd` 那个窗口（前台），或计划任务模式下查看任务计划程序 → `mywebsite-backend` → "Last Run Result"
- **IIS 访问日志**：默认位置 `C:\inetpub\logs\LogFiles\`
- **后端 API 直连**：直接访问 `http://127.0.0.1:3001/api/profile`（绕过 IIS）
- **检查 Node 端口**：`netstat -ano | findstr :3001`

### 上传目录

后台"Images"标签上传写盘到 `public\images\`。`setup-iis-site.ps1` 已自动给 `IIS_IUSRS` 该目录的 modify 权限。如果上传仍失败：

```powershell
icacls "C:\My-workspace\mywebsite\public\images" /grant IIS_IUSRS:(OI)(CI)M
```

### 注意事项

- 这个方案**同时支持 Cloudflare Pages**：跨端口 CORS fallback 仅在 IIS 上触发；Cloudflare 上前端访问的是 `https://your-site.pages.dev/api/...`，由 Cloudflare Functions 处理，根本不需要 fallback
- 后端 Node 进程和 IIS 是两个独立进程。IIS 出问题不会影响 Node；Node 没启起来时，前端 fetch 会从 8080 退回 3001 后报错
- 默认账号：`admin / admin123`。登录后请立即到 **Account → Change Password** 修改




---

## 部署到 Cloudflare Pages

> 这套设计同时满足「Cloudflare 个人网站条款」：纯静态前端 + 仅必要的后端能力（KV 存储 + R2 图片）。零专有服务、易于迁移、可随时导出 JSON 数据。

### 一次性设置（约 10 分钟）

#### 1) 创建 Cloudflare 资源

在 [dash.cloudflare.com](https://dash.cloudflare.com) 上：

| 资源 | 在哪里创建 | 命名建议 | 用途 |
|---|---|---|---|
| **Pages 项目** | Workers & Pages → Create application → Pages | `mywebsite` | 托管整个站点 |
| **KV namespace** | Workers & Pages → KV → Create a namespace | `mywebsite-kv` | 存文章 / 留言 / profile / 管理员凭据 |
| **R2 bucket** | R2 → Create bucket | `mywebsite-images` | 存图片 |
| **Turnstile widget** *(推荐)* | Turnstile → Add widget | 任意名 | 联系页防灌水 |

创建完 KV 后，**记下页面上的 `id` 值**（一串十六进制），等会要填。

#### 2) 创建 Turnstile widget

1. Turnstile → Add widget
2. **Widget name**：随便起（如 `mywebsite`）
3. **Hostnames**：`your-project.pages.dev`（首次可填 `*.pages.dev` 通配；自定义域名以后再加）
4. Widget mode 选 **Managed**（最不打扰用户）
5. 创建后复制两个值：
   - **Site Key**（公开，会嵌到页面）
   - **Secret Key**（私密，只放在 Pages 后台）

#### 3) 把仓库连上 Pages

- **方式 A（推荐）** — 推到 GitHub → Pages → Connect to Git
- **方式 B** — Direct Upload：`npm run deploy` （脚本调用 `wrangler pages deploy public`）

新建 Pages 项目时：
- **Framework preset**：None
- **Build command**：留空
- **Build output directory**：`public`
- **Root directory**：(留空)
- **Compatibility flags**：不用设
- **Compatibility date**：默认即可

#### 4) 绑定 KV 和 R2

进入 Pages 项目 → **Settings → Functions**：

- **KV namespace bindings**：
  - Variable name：`MYWEBSITE_KV`
  - KV namespace：选你刚创建的那个
- **R2 bucket bindings**：
  - Variable name：`MYWEBSITE_R2`
  - R2 bucket：选你刚创建的那个

> 图片功能（拖拽上传 / 删除）必须 R2。其他功能不依赖 R2。

#### 5) 设置环境变量

进入 **Settings → Environment variables**，至少加这两项：

| Variable name | Value | 适用 |
|---|---|---|
| `JWT_SECRET` | `openssl rand -hex 48` 的输出 | Production + Preview |
| `TURNSTILE_SITE_KEY` | Turnstile 拿到的 site key | Production + Preview |
| `TURNSTILE_SECRET_KEY` | Turnstile 拿到的 secret key | Production + Preview |

> ⚠️ **必须设 `JWT_SECRET`**——没设的话所有 admin 端点会返回 503，并拒绝使用公开的 dev fallback。生产切勿留空。
>
> Turnstile 三个变量**不设也行**：联系表单在没有 captcha 验证的情况下仍可提交，但建议生产环境开启。

#### 6) 第一次部署 + 改默认密码

- 触发一次部署（push 一次 commit，或者 Direct Upload）
- 访问 `https://<your-project>.pages.dev/admin`
- 用 **`admin` / `admin123`** 登录
- **第一件事**：进入 Account 标签改密码

#### 7) 故障排查 checklist

| 症状 | 大概率原因 |
|---|---|
| `/admin/` 一直刷新 / 重定向 | KV 没绑 → KV 读不到 admin.json → 登录后 token 验证不通过 |
| `/api/admin/login` 返回 503 | `JWT_SECRET` 没设 |
| `/api/admin/images` 返回 503 | `MYWEBSITE_R2` 没绑（图片上传会拒绝，其他功能正常） |
| 联系表单提交失败 | `TURNSTILE_SECRET_KEY` 设了但 `TURNSTILE_SITE_KEY` 没设（或反之） |

### 部署

- **Direct Upload**：`npm run deploy` （脚本里调用 `wrangler pages deploy public`）
- **Git 连接**：每次 `git push` 自动构建

### 注意事项

- `functions/api/posts/[id].js` 等动态路由文件名要用方括号 + `.js`（Pages Functions 的约定）
- 如果不想用 R2，可以不绑定 `MYWEBSITE_R2`——后台「Images」标签会提示「R2 not bound」，其他功能照常工作
- 这套架构是「同构」的：`server/index.js` 和 `functions/` 是两份独立实现，做到了"前端一份代码、两种环境都能跑"。改 API 时两边要同步
- 本地数据可随时通过 Cloudflare 仪表台 → KV → Manage 导入/导出 JSON 备份
- **IIS 和 Cloudflare 二选一即可**：两份实现用了同一份前端资源（`public/`），互不干扰。开发预览走 IIS，生产部署走 Cloudflare，几乎不需要改任何代码

---

## 后台使用指南

### Posts 标签
- 默认显示全部文章（包含草稿/隐藏），按日期倒序
- 列表里的 **Status 徽章** 实时反映当前状态
- 操作：
  - **Edit**：载入到编辑器，可改全部字段
  - **Show / Hide**：循环切换 `published → hidden → draft → published`
  - **Delete**：弹确认框后删除

### New Post 标签
- 顶上一对标签按钮在 **中文 / English** 之间切换；标题、摘要、正文都支持双语
- **Cover Image URL**：直接填路径，或者到 Images 标签上传完后点 "Copy URL"
- **Status**：新建时默认是 `published`
- **Category / Tags**：分类影响前端显示风格，标签只是元数据

### Images 标签
- 拖拽或点选上传（≤8 MB，jpg/png/gif/webp/svg）
- 鼠标悬停：复制 URL / 删除

### Profile 标签
- **Display Name / Avatar**：站点名 + 头像
- **Homepage intro**：1-3 句话（中英双版本），显示在首页顶部
- **About**：用 Markdown 写（中英双版本），渲染到 About 页面
- **Contacts**：一行一个 `Label: URL` 形式，自动出现在 About、Contact 页

### Account 标签
- 改密码
- 当前密码错误时返回明确提示

---

## 安全建议

1. **默认 admin / admin123 必须改**，在第一次登录后立即改
2. 设置强 `JWT_SECRET`（Cloudflare 环境变量里）
3. Cloudflare Pages 默认会缓存 `*.html`；如果你需要确保 `/admin/*` 不被缓存，可以参考 `public/_headers` 里的 `noindex` 头
4. 后台接口只接受 `Bearer` token，没有 cookie 反而避免 CSRF
5. 联系表单提交后只是把留言存进 `data/messages.json`（本地）或 KV key `messages.json`（Cloudflare）。你可以在 `functions/api/contact.js` / `server/index.js` 里改成 SMTP、MailChannels、Telegram Bot 等

---

## 与 Cloudflare 个人网站条款的兼容性

> 本项目有意做成 **「静态优先 + 文件型数据」**，最大限度符合 Cloudflare Personal Website 套餐的精神：

| 条款约束 | 本项目处理方式 |
|---|---|
| 内容必须由你本人撰写 | 后台登录只支持单管理员 |
| 不得托管"非个人内容" | 整个站点提供的是文章 / 联系 / 关于 |
| 不得用于商业用途 | 脚本里未引入任何广告 / 追踪 |
| 静态内容为主 | 前端是纯 HTML / CSS / JS，无框架运行时 |
| 不得大量消耗资源 | 后端只是读写 JSON + 一次性图片上传，单实例就能撑起个人站 |

如果 Cloudflare Pages 免费层额度（500 MB 存储 / 100 GB 流量）不够了，可以很自然地迁到 Workers Paid、Workers KV 限额升级或自托管。

---

## 自定义

- **配色 / 字体**：改 `public/css/style.css` 顶部的 CSS 变量
- **添加新页面**：在 `public/` 加 `.html`、在 `public/js/i18n.js` 加字典、在 `public/js/layout.js` 加导航入口
- **加新语言**：在 `I18N[key].zh/.en` 后增加 `I18N[key].ja` 之类的语言字段，再在 `i18n.js` 的 switch 里扩
- **文章 Markdown 扩展**：`public/js/app.js` 里的 `renderMarkdown` 是刻意精简的，可换 `marked` / `markdown-it`

---

## License

MIT
