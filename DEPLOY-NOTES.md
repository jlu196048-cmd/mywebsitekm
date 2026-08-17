# Direct Upload 部署清单 — Mywebsitekm

> 这一份是**只针对 Direct Upload 方式**的精简步骤。
> 完整版部署 + 故障排查见 `README.md`。

---

## 你已完成的（在 Cloudflare 后台）

- [x] 创建了 KV 命名空间：`mywebsite-kv`（ID: `53a2a823f41a48ce9b8d4ea179c9088e`）
- [x] 决定了项目名：`Mywebsitekm`
- [x] 决定部署方式：**Direct Upload**
- [ ] 待办：创建 Pages 项目 + 设置环境变量 + 上传文件（下面）

---

## 接下来 4 步（约 10 分钟）

### 第 1 步：在 Cloudflare 创建 Pages 项目（空壳，不构建）

1. 打开 https://dash.cloudflare.com/
2. 左侧 **计算** → **Workers 和 Pages** → **创建应用程序** → 选 **Pages** 标签 → **直接上传**（Direct Upload）→ **选择项目**
3. **项目名称**（Project name）填：**`Mywebsitekm`**
4. **不要选** "为项目附加自定义域"（先不上）
5. 点 **创建项目**（会进入上传页，先不要上传）

### 第 2 步：设置环境变量（在上传之前）

进入 **Mywebsitekm** 项目 → **设置**（Settings）→ **环境变量**（Environment variables）：

| Variable name | Value | Environment |
|---|---|---|
| `JWT_SECRET` | `51931e51b72f37d3057b4d5cc3232816b63be1b7f1cc66f46be82a9ae1f1a9c11048a839e2316dd00c5d3e6dbf62d5e5` | ✅ Production + ✅ Preview |
| `TURNSTILE_SITE_KEY` | （留空 — 你以后再加） | Production + Preview |
| `TURNSTILE_SECRET_KEY` | （留空） | Production + Preview |

> **重要**：JWT_SECRET 必须设置。否则登录会 503。
> Turnstile 三个变量**留空**也完全 OK——联系表单仍可提交，只是不验 captcha。

### 第 3 步：绑定 KV

同一个 **设置** 页 → 左侧 **函数**（Functions）→ **KV 命名空间绑定**：

- 变量名称：`MYWEBSITE_KV`
- KV 命名空间：选 **`mywebsite-kv`**
- 点 **保存**

### 第 4 步：上传 public/

返回到 Pages 项目主页（Deployments 标签）：

- 滚动到 **创建部署**（Create a deployment）或 **上传资产**（Upload assets）
- 把整个 `public/` 文件夹的内容**作为 zip 包**上传（不能用文件夹直接拖，得打包）
- 或者拖拽整个解压后的 `public/` 文件夹
- 部署后等 30 秒

---

## 📦 部署用的 public/ 已打包在仓库

打开 `C:\My-workspace\mywebsite\public` 文件夹，把**里面的所有内容**（不是 public 本身，是 public 下面的 `index.html`、`_redirects`、`_headers`、`admin/`、`css/`、`images/`、`js/` 等）打包成 zip，名字随便（如 `mywebsite-upload.zip`），然后上传。

**不要把 public/ 这个文件夹本身压缩进去**——Cloudflare Pages 需要的是 public/ 里面的内容，不是 public/ 文件夹。

---

## ✅ 部署完成后必做的两件事

### A. 验证 5 个 URL（建议用浏览器开无痕窗口）

| URL | 期望 |
|---|---|
| `https://Mywebsitekm.pages.dev/` | 首页 200，能看到双语标题 |
| `https://Mywebsitekm.pages.dev/admin/` | 登录页（不是死循环！） |
| `https://Mywebsitekm.pages.dev/api/profile` | 返回 JSON `{"name":"我的小角落",...}` |
| `https://Mywebsitekm.pages.dev/api/config` | 返回 `{"turnstileSiteKey":""}`（空字符串说明没配 Turnstile） |
| `https://Mywebsitekm.pages.dev/api/admin/status` | 返回 `{"authenticated":false}` |

**如果 `/admin/` 还在循环**：KV 没绑定 → 检查第 3 步。

### B. 登录后台 + 立即改密码

1. 访问 `https://Mywebsitekm.pages.dev/admin/`
2. 用户名：**`admin`**，密码：**`admin123`**
3. 登录后，**第一件事**：点 **Account** 标签 → 输入旧密码 + 新密码（≥ 6 位）→ **更新密码**

---

## 🚨 故障排查

| 现象 | 原因 | 修法 |
|---|---|---|
| `/admin/` 死循环刷新 | KV 没绑或绑错了 namespace | 重做第 3 步 |
| `/api/admin/login` 返回 503 | `JWT_SECRET` 没设 | 重做第 2 步 |
| 登录提示 "Invalid credentials" | KV 正常但 admin 数据丢了（极少） | 用 curl 看 `/api/admin/status` 是否返回 `{authenticated:false}`；正常 |
| `/api/admin/images` 返回 503 | R2 没绑（**预期内**，不影响其他功能） | 忽略；以后想用图片上传再绑 R2 |
| 联系表单提交报 "Captcha is required" | 你设了 `TURNSTILE_SECRET_KEY` 但没设 `TURNSTILE_SITE_KEY` | 把 SECRET 也清空（当前不验 captcha） |

---

## 📝 以后再加的东西（不影响当前部署）

### 想加图片上传（R2）
- 办张信用卡后在 Cloudflare 激活 R2
- 创建 `mywebsite-images` 存储桶
- 在 Pages Functions 设置里加 R2 binding：`MYWEBSITE_R2` → `mywebsite-images`
- 重新上传 `public/`

### 想加 Turnstile 防联系页灌水
- 在 dash.cloudflare.com 创建 Turnstile widget
- 在 Pages 环境变量加 `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
- 重新上传 `public/`