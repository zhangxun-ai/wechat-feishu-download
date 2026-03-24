# Chrome Web Store 上架清单

## 一、先准备发布包

上传到 Chrome Web Store 的是扩展运行文件组成的 `zip`，不要直接上传整个仓库。

建议只包含这些文件：

- `manifest.json`
- `popup.html`
- `popup.css`
- `popup.js`
- `background.js`
- `batch-runner.html`
- `batch-runner.css`
- `batch-runner.js`
- `wechat-direct-export.js`
- `content-scripts/`
- `icon/`
- `_locales/`

不要包含这些内容：

- `.git/`
- `helper/`
- `assets/`、`chunks/` 中与当前扩展实际运行无关的旧文件
- 本地测试脚本
- README 和开发文档
- `.DS_Store`

## 二、必须准备的商店资料

### 1. Store listing

- 插件名称
- 简短说明
- 详细描述
- 分类
- 语言
- 128x128 图标
- 至少 1 张截图，建议 3-5 张

### 2. Privacy

- 隐私政策 URL
- 数据使用披露

建议使用：

- GitHub Pages
- 你自己的官网
- Vercel / Cloudflare Pages 静态页

## 三、建议的可见性

第一版建议：

- `Unlisted`

原因：

- 可以先发给种子用户测试
- 不会被公开搜索到
- 审核通过后再决定是否公开

## 四、测试说明要写什么

建议在 Chrome Web Store 的 `Test instructions` 里写清楚：

1. 插件用途：
   - 导出飞书文档和微信公众号文章到本地
2. 如何测试飞书单篇导出：
   - 打开任意飞书 `docx/wiki`
   - 点击扩展
   - 点击“导出 Markdown”
3. 如何测试微信公众号单篇导出：
   - 打开任意公众号文章页
   - 点击扩展
   - 点击“导出 Markdown”
4. 如何测试公众号历史范围下载：
   - 先在当前 Chrome 登录 `https://mp.weixin.qq.com/`
   - 再打开一篇公众号文章作为种子链接
   - 在扩展中填写开始和结束日期
   - 点击“按范围批量下载”

## 五、建议的发布顺序

1. 先启用 GitHub Pages，得到隐私政策 URL
2. 打包扩展 zip
3. 上传 zip 到 Chrome Web Store
4. 填写 Listing / Privacy / Distribution / Test instructions
5. 选择 `Unlisted`
6. 提交审核

## 六、审核前最后自查

- [ ] `manifest.json` 没有 `localhost` 或 `127.0.0.1` 权限
- [ ] 没有远程脚本执行或动态拉取 JS
- [ ] 隐私政策 URL 可公开访问
- [ ] 截图与实际功能一致
- [ ] 描述中没有夸大承诺
- [ ] 发布包只包含扩展实际运行所需文件
