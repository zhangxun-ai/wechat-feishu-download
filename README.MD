# wechat-feishu-download

一个可直接加载到 Chrome 的本地导出插件，当前稳定支持：

- 飞书 `docx/wiki` 单篇导出 `Markdown / JSON`
- 微信公众号单篇文章导出 `Markdown / JSON`
- 飞书 / 微信文章链接列表批量下载
- 微信公众号“种子文章 -> 同号 -> 指定日期范围”批量下载
- 生财课程章节页“一键导出当前专栏”为单个 `Markdown + HTML`

项目定位是 **可用的 MVP**：优先保证成功率、可读性和使用门槛，不追求 100% 样式还原。

## 功能概览

### 1. 单篇导出

支持：

- 飞书 `docx/wiki`
- 微信公众号文章页 `https://mp.weixin.qq.com/s/*`

可选：

- 导出 `Markdown`
- 导出 `JSON`
- 选择是否包含正文图片

### 2. 链接列表批量下载

支持一组飞书 / 微信文章链接批量导出为 Markdown。

当前行为：

- 自动打开独立任务页执行
- 默认串行下载
- 默认带节流和失败重试
- 默认打包为一个 ZIP
- ZIP 内附带：
  - `manifest.json`
  - `articles.txt`
  - `failed.txt`（仅失败时生成）

### 3. 公众号范围批量下载

输入：

- 该公众号任意一篇种子文章链接
- 开始日期
- 结束日期

能力：

- 复用当前 Chrome 里的 `mp.weixin.qq.com` 登录态
- 自动搜索目标公众号
- 自动拉取同号历史文章列表
- 按日期范围过滤后进入批量下载队列

不需要：

- 系统代理
- 手机微信
- mitmproxy
- 手动复制历史文章链接

### 4. 生财课程专栏导出

输入：

- 当前已打开的生财课程章节页，例如 `https://scys.com/deepsea/.../course/...?...chapterId=...`

能力：

- 自动识别当前专栏左侧目录
- 串行导出当前专栏全部可访问章节
- 最终输出两个单文件：
  - `专栏名.md`
  - `专栏名.html`

适合：

- 把整专栏丢给 NotebookLM / 其他 AI
- 导入 Obsidian
- 本地离线浏览

## 快速开始

### 安装

1. 打开 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择本项目目录

如果你更新了代码：

1. 回到 `chrome://extensions/`
2. 点击扩展“刷新”
3. 把对应网页也刷新一次

### 默认下载位置

文件会直接保存到 **Chrome 当前默认下载目录**。

可在这里查看：

- `chrome://downloads/`
- `chrome://settings/downloads`

## 使用说明

### 单篇导出

1. 打开飞书文档页或微信公众号文章页
2. 点击扩展图标
3. 选择是否“Markdown 包含图片”
4. 点击“导出 Markdown”或“导出 JSON”

说明：

- 飞书 `Markdown` 走 `client_vars -> block_map -> Markdown`
- 公众号 `Markdown` 走正文 HTML 提取与清洗
- 公众号带图模式会把图片转成内嵌 `data:` URL

### 生财课程专栏导出

1. 打开任意一个生财课程章节页
2. 点击扩展图标
3. 确认弹窗里出现“导出当前专栏”
4. 点击后扩展会自动打开任务页
5. 任务完成后自动下载：
   - 一个整专栏 `Markdown`
   - 一个带目录导航的 `HTML`

说明：

- 当前只针对 `scys.com/deepsea/.../course/...?...chapterId=...` 页面启用
- 旧的单篇导出和手工批量下载逻辑不变
- 如果某些章节失败，最终文件仍会生成，并附带失败章节列表

### 链接列表批量下载

1. 打开扩展
2. 在“批量下载”里每行粘贴一个链接
3. 点击“批量下载链接列表”
4. 扩展会自动打开独立任务页
5. 任务页完成后，浏览器开始下载 ZIP 或 Markdown 文件

说明：

- 批量任务不再依赖弹窗保持打开
- 不要手动关闭任务页
- 公众号批量下载优先尝试“直接抓 HTML 再解析”
- 如果微信返回“环境异常 / 去验证”页，会自动回退到稳定页面模式

### 公众号范围批量下载

1. 先确保当前 Chrome 已登录 `https://mp.weixin.qq.com/`
2. 如果没登录，在扩展里点击“打开后台登录页”
3. 在“公众号后台模式”里填入：
   - 种子文章链接
   - 开始日期
   - 结束日期
4. 点击“检测后台登录”
5. 点击“按范围批量下载”

## 当前推荐使用方式

### 飞书

最稳妥的使用范围：

- `https://*.feishu.cn/docx/*`
- `https://*.feishu.cn/wiki/*`
- `https://*.larksuite.com/docx/*`
- `https://*.larksuite.com/wiki/*`
- `https://*.larkoffice.com/docx/*`
- `https://*.larkoffice.com/wiki/*`

当前不支持：

- `sheet`
- `bitable/base`
- `minutes`
- `file`
- 回写飞书

### 微信公众号

当前稳定支持：

- 单篇文章导出
- 后台登录态下的范围批量下载

当前不支持：

- 只输入公众号昵称直接抓整号历史
- 评论、阅读量、点赞、分享等后台统计数据

### 生财课程

当前稳定支持：

- 当前课程专栏整包导出
- 单个 `Markdown` 文件输出
- 单个 `HTML` 阅读版输出

当前不支持：

- 整个课程专区全量抓取
- 多专栏批量导出
- PDF 导出

## 已知限制

- 公众号范围下载依赖你自己的 `mp.weixin.qq.com` 登录态
- 微信有时会对直接 HTML 抓取返回验证页，这时会自动回退到页面模式
- 批量下载期间需要保持独立任务页打开
- Markdown 是“可读优先”的本地导出，不追求 100% 样式还原

## 项目结构

当前仓库保留的是 **真正会参与运行的 MVP 源码**。

主要文件：

- `manifest.json`：扩展入口与权限
- `popup.html` / `popup.css` / `popup.js`：扩展弹窗与主交互
- `batch-runner.html` / `batch-runner.css` / `batch-runner.js`：批量任务页
- `background.js`：图片抓取与后台消息
- `wechat-direct-export.js`：公众号 HTML 直抓解析模块
- `content-scripts/feishu-exporter.js`：飞书与公众号内容提取主逻辑
- `icon/`：扩展图标
- `_locales/zh_CN/messages.json`：本地化资源

## 实验性方案

仓库仍保留一个实验性目录 [`helper/`](./helper/)。

它是旧的“微信客户端 + mitmproxy + helper”抓取方案，仅用于研究，不是主流程。

主流程优先使用浏览器里的公众号后台模式。

## 本地校验

当前主要脚本已做过静态检查：

- `node --check popup.js`
- `node --check batch-runner.js`
- `node --check background.js`
- `node --check content-scripts/feishu-exporter.js`
- `node --check wechat-direct-export.js`
- `jq . manifest.json`

## 后续方向

如果继续做产品化，最合理的形态不是“纯网页替代插件”，而是：

- 插件负责本地采集
- 网页负责任务管理、历史记录、AI 分析和计费

这样既保留采集成功率，也更容易扩展功能。
