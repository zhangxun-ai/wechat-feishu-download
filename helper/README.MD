# helper（实验性）

这个目录保留的是旧的“微信客户端历史页抓取”实验方案。

当前主流程已经切到：

- 浏览器公众号后台登录态
- 无系统代理
- 无 mitmproxy
- 无手机 / 桌面微信抓包

所以这里的内容 **不是主路径**，只建议在明确做技术研究时使用。

## 包含内容

- [`wechat_history_helper.py`](./wechat_history_helper.py)
  - 本地 HTTP 服务
  - 保存公众号历史文章缓存
  - 接收日期范围任务并返回链接列表

- [`mitm_wechat_history_addon.py`](./mitm_wechat_history_addon.py)
  - `mitmproxy` 插件
  - 监听微信客户端中的公众号历史列表请求

- [`requirements.txt`](./requirements.txt)
  - helper 依赖

## 启动方式

启动 helper：

```bash
python3 helper/wechat_history_helper.py
```

安装依赖：

```bash
python3 -m pip install -r helper/requirements.txt
```

启动 mitmproxy 插件：

```bash
mitmdump -s helper/mitm_wechat_history_addon.py
```

## 当前边界

- 不负责正文导出
- 不负责 Markdown 转换
- 不负责图片处理
- 依赖系统代理和证书配置
- 容易受其他代理工具干扰

如果你的目标只是稳定下载公众号文章，优先使用主仓库 README 里的“公众号后台模式”。
