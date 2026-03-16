#!/usr/bin/env python3
"""Local helper for WeChat history range resolution.

This helper does not download article content itself. It stores and serves
same-account history article links captured from WeChat client traffic, then
lets the Chrome extension reuse its existing Markdown export flow.
"""

from __future__ import annotations

import argparse
import json
import shlex
import subprocess
import sys
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse


VERSION = "0.1.0"
DATA_DIR = Path(__file__).resolve().parent / "data"
STATE_FILE = DATA_DIR / "state.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def safe_int(value: Any) -> Optional[int]:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_iso_date(value: str) -> Optional[datetime.date]:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def normalize_article_url(value: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    if raw.startswith("//"):
        raw = f"https:{raw}"
    elif raw.startswith("/"):
        raw = f"https://mp.weixin.qq.com{raw}"

    try:
        parsed = urlparse(raw)
    except ValueError:
        return ""

    if parsed.scheme not in {"http", "https"}:
        return ""
    if parsed.netloc != "mp.weixin.qq.com":
        return ""
    if not parsed.path.startswith("/s"):
        return ""

    return raw


def article_date(article: Dict[str, Any]) -> Optional[str]:
    timestamp = safe_int(article.get("publishTimestamp"))
    if timestamp:
        return datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d")

    publish_date = str(article.get("publishDate") or "").strip()
    return publish_date or None


def build_profile_url(biz: str) -> str:
    return f"https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz={biz}#wechat_redirect"


def run_networksetup(*args: str) -> str:
    command = ["networksetup", *args]
    result = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
    )
    output = (result.stdout or "").strip() or (result.stderr or "").strip()

    if result.returncode != 0:
        raise RuntimeError(output or f"networksetup 执行失败: {' '.join(command)}")

    return output


def run_networksetup_batch(commands: List[List[str]], allow_prompt: bool = False) -> None:
    last_error = ""

    for command in commands:
        result = subprocess.run(
            command,
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            continue
        last_error = (result.stdout or "").strip() or (result.stderr or "").strip()
        break
    else:
        return

    if not allow_prompt or sys.platform != "darwin":
        raise RuntimeError(last_error or "networksetup 批量执行失败")

    shell_command = " && ".join(shlex.join(command) for command in commands)
    apple_script = f"do shell script {json.dumps(shell_command)} with administrator privileges"
    prompted = subprocess.run(
        ["osascript", "-e", apple_script],
        check=False,
        capture_output=True,
        text=True,
    )
    if prompted.returncode != 0:
        output = (prompted.stdout or "").strip() or (prompted.stderr or "").strip()
        raise RuntimeError(output or last_error or "代理切换失败，请确认你允许了管理员授权")


def list_network_services() -> List[str]:
    output = run_networksetup("-listallnetworkservices")
    services = []

    for line in output.splitlines():
        value = line.strip()
        if not value or value.startswith("An asterisk") or value.startswith("*"):
            continue
        services.append(value)

    return services


def parse_proxy_settings(output: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "enabled": False,
        "server": "",
        "port": 0,
        "authenticated": False,
    }

    for line in output.splitlines():
        if ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        value = raw_value.strip()
        lowered = key.strip().lower()

        if lowered == "enabled":
            result["enabled"] = value.lower() == "yes"
        elif lowered == "server":
            result["server"] = value
        elif lowered == "port":
            result["port"] = safe_int(value) or 0
        elif lowered == "authenticated proxy enabled":
            result["authenticated"] = value.lower() == "yes"
        elif lowered == "username":
            result["username"] = value

    return result


def get_proxy_settings(service: str, proxy_type: str) -> Dict[str, Any]:
    command_map = {
        "web": "-getwebproxy",
        "secureweb": "-getsecurewebproxy",
        "socksfirewall": "-getsocksfirewallproxy",
    }

    flag = command_map.get(proxy_type)
    if not flag:
        raise ValueError(f"不支持的代理类型: {proxy_type}")

    output = run_networksetup(flag, service)
    return parse_proxy_settings(output)


def set_proxy(service: str, proxy_type: str, server: str, port: int, enabled: bool) -> None:
    set_command_map = {
        "web": "-setwebproxy",
        "secureweb": "-setsecurewebproxy",
        "socksfirewall": "-setsocksfirewallproxy",
    }
    state_command_map = {
        "web": "-setwebproxystate",
        "secureweb": "-setsecurewebproxystate",
        "socksfirewall": "-setsocksfirewallproxystate",
    }

    set_flag = set_command_map.get(proxy_type)
    state_flag = state_command_map.get(proxy_type)
    if not set_flag or not state_flag:
        raise ValueError(f"不支持的代理类型: {proxy_type}")

    if enabled:
        run_networksetup_batch(
            [
                ["networksetup", set_flag, service, server, str(port)],
                ["networksetup", state_flag, service, "on"],
            ],
            allow_prompt=True,
        )
        return

    if proxy_type == "socksfirewall":
        run_networksetup_batch(
            [["networksetup", state_flag, service, "off"]],
            allow_prompt=True,
        )
        return

    commands: List[List[str]] = []
    if server and port:
        commands.append(["networksetup", set_flag, service, server, str(port)])
    commands.append(["networksetup", state_flag, service, "off"])
    run_networksetup_batch(commands, allow_prompt=True)


def restore_proxy_settings(service: str, proxy_type: str, backup: Optional[Dict[str, Any]]) -> None:
    if not backup:
        set_proxy(service, proxy_type, "", 0, False)
        return

    enabled = bool(backup.get("enabled"))
    server = str(backup.get("server") or "")
    port = safe_int(backup.get("port")) or 0

    if enabled and server and port:
        set_proxy(service, proxy_type, server, port, True)
    else:
        set_proxy(service, proxy_type, server, port, False)


@dataclass
class FilteredArticles:
    links: List[str]
    matched_count: int


class HistoryStore:
    def __init__(self, state_file: Path) -> None:
        self.state_file = state_file
        self.lock = threading.Lock()
        self.state = {
            "captures": {},
            "jobs": {},
            "proxy": {
                "service": "Wi-Fi",
                "captureHost": "127.0.0.1",
                "capturePort": 8080,
                "backup": {},
            },
        }
        self._load()

    def _load(self) -> None:
        if not self.state_file.exists():
            return

        try:
            self.state = json.loads(self.state_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            self.state = {
                "captures": {},
                "jobs": {},
                "proxy": {
                    "service": "Wi-Fi",
                    "captureHost": "127.0.0.1",
                    "capturePort": 8080,
                    "backup": {},
                },
            }
        self.state.setdefault("proxy", {
            "service": "Wi-Fi",
            "captureHost": "127.0.0.1",
            "capturePort": 8080,
            "backup": {},
        })

    def _save(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(
            json.dumps(self.state, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def health(self) -> Dict[str, Any]:
        with self.lock:
            pending_jobs = sum(
                1
                for job in self.state["jobs"].values()
                if job.get("status") == "waiting_capture"
            )
            return {
                "captureMode": "mitmproxy-addon",
                "cachedBizCount": len(self.state["captures"]),
                "pendingJobs": pending_jobs,
                "proxy": self.proxy_status(),
            }

    def proxy_status(self) -> Dict[str, Any]:
        proxy = self.state.get("proxy", {})
        service = proxy.get("service", "Wi-Fi")
        result = {
            "supported": sys.platform == "darwin",
            "service": service,
            "captureHost": proxy.get("captureHost", "127.0.0.1"),
            "capturePort": proxy.get("capturePort", 8080),
            "http": {},
            "https": {},
            "socks": {},
            "backup": proxy.get("backup", {}),
        }

        if sys.platform != "darwin":
            result["error"] = "当前 helper 仅实现了 macOS 系统代理切换"
            return result

        try:
            result["services"] = list_network_services()
            result["http"] = get_proxy_settings(service, "web")
            result["https"] = get_proxy_settings(service, "secureweb")
            result["socks"] = get_proxy_settings(service, "socksfirewall")
        except Exception as error:
            result["error"] = str(error)

        return result

    def configure_capture_proxy(
        self,
        service: str,
        capture_host: str,
        capture_port: int,
    ) -> Dict[str, Any]:
        if sys.platform != "darwin":
            raise RuntimeError("当前 helper 仅实现了 macOS 系统代理切换")

        with self.lock:
            backup = {
                "http": get_proxy_settings(service, "web"),
                "https": get_proxy_settings(service, "secureweb"),
                "socks": get_proxy_settings(service, "socksfirewall"),
            }

            proxy = self.state.setdefault("proxy", {})
            proxy["service"] = service
            proxy["captureHost"] = capture_host
            proxy["capturePort"] = capture_port
            proxy["backup"] = backup

            set_proxy(service, "web", capture_host, capture_port, True)
            set_proxy(service, "secureweb", capture_host, capture_port, True)
            set_proxy(service, "socksfirewall", "", 0, False)
            self._save()

            return self.proxy_status()

    def restore_proxy(self, service: Optional[str] = None) -> Dict[str, Any]:
        if sys.platform != "darwin":
            raise RuntimeError("当前 helper 仅实现了 macOS 系统代理切换")

        with self.lock:
            proxy = self.state.setdefault("proxy", {})
            target_service = service or proxy.get("service", "Wi-Fi")
            backup = proxy.get("backup") or {}

            restore_proxy_settings(target_service, "web", backup.get("http"))
            restore_proxy_settings(target_service, "secureweb", backup.get("https"))
            restore_proxy_settings(target_service, "socksfirewall", backup.get("socks"))
            proxy["service"] = target_service
            self._save()

            return self.proxy_status()

    def upsert_capture(
        self,
        biz: str,
        nickname: str,
        articles: List[Dict[str, Any]],
        source: str,
    ) -> Dict[str, Any]:
        normalized_articles = []

        for article in articles:
            url = normalize_article_url(article.get("url", ""))
            if not url:
                continue

            normalized_articles.append(
                {
                    "title": str(article.get("title") or "未命名文章").strip() or "未命名文章",
                    "url": url,
                    "publishTimestamp": safe_int(article.get("publishTimestamp")),
                    "publishDate": article_date(article),
                }
            )

        if not normalized_articles:
            raise ValueError("没有可用的公众号文章链接")

        with self.lock:
            capture = self.state["captures"].setdefault(
                biz,
                {
                    "biz": biz,
                    "nickname": nickname or "",
                    "source": source or "unknown",
                    "updatedAt": utc_now_iso(),
                    "articles": [],
                },
            )

            merged: Dict[str, Dict[str, Any]] = {
                item["url"]: item for item in capture.get("articles", [])
            }
            for article in normalized_articles:
                merged[article["url"]] = article

            capture["nickname"] = nickname or capture.get("nickname", "")
            capture["source"] = source or capture.get("source", "unknown")
            capture["updatedAt"] = utc_now_iso()
            capture["articles"] = sorted(
                merged.values(),
                key=lambda item: (
                    safe_int(item.get("publishTimestamp")) or 0,
                    item.get("title") or "",
                ),
                reverse=True,
            )

            updated_job_ids = []
            for job in self.state["jobs"].values():
                if job.get("biz") != biz:
                    continue
                if job.get("status") not in {"waiting_capture", "ready", "empty"}:
                    continue
                self._refresh_job(job)
                updated_job_ids.append(job["id"])

            self._save()

            return {
                "biz": biz,
                "nickname": capture.get("nickname", ""),
                "articleCount": len(capture["articles"]),
                "updatedAt": capture["updatedAt"],
                "updatedJobIds": updated_job_ids,
            }

    def create_job(
        self,
        seed_url: str,
        biz: str,
        nickname: str,
        start_date: str,
        end_date: str,
    ) -> Dict[str, Any]:
        with self.lock:
            job_id = uuid.uuid4().hex
            job = {
                "id": job_id,
                "seedUrl": seed_url,
                "biz": biz,
                "nickname": nickname or "",
                "startDate": start_date,
                "endDate": end_date,
                "status": "waiting_capture",
                "message": "",
                "profileUrl": build_profile_url(biz),
                "links": [],
                "count": 0,
                "createdAt": utc_now_iso(),
                "updatedAt": utc_now_iso(),
            }
            self.state["jobs"][job_id] = job
            self._refresh_job(job)
            self._save()
            return self._serialize_job(job)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            job = self.state["jobs"].get(job_id)
            if not job:
                return None

            self._refresh_job(job)
            self._save()
            return self._serialize_job(job)

    def _refresh_job(self, job: Dict[str, Any]) -> None:
        capture = self.state["captures"].get(job["biz"])
        job["updatedAt"] = utc_now_iso()
        job["profileUrl"] = build_profile_url(job["biz"])

        if not capture:
            job["status"] = "waiting_capture"
            job["links"] = []
            job["count"] = 0
            job["message"] = (
                f"还没有捕获到公众号 {job.get('nickname') or job['biz']} 的历史文章列表。"
                "请启动 mitmproxy 抓取插件，并在微信客户端打开该公众号历史页。"
            )
            return

        filtered = self._filter_capture(
            capture.get("articles", []),
            job["startDate"],
            job["endDate"],
        )
        job["links"] = filtered.links
        job["count"] = filtered.matched_count
        job["nickname"] = job.get("nickname") or capture.get("nickname", "")

        if filtered.matched_count > 0:
            job["status"] = "ready"
            job["message"] = (
                f"已命中 {filtered.matched_count} 篇历史文章，扩展可以开始自动下载。"
            )
        else:
            job["status"] = "empty"
            job["message"] = (
                f"已拿到历史文章列表，但 {job['startDate']} 到 {job['endDate']} 没有命中文章。"
            )

    def _filter_capture(
        self,
        articles: List[Dict[str, Any]],
        start_date: str,
        end_date: str,
    ) -> FilteredArticles:
        start = parse_iso_date(start_date)
        end = parse_iso_date(end_date)
        if not start or not end:
            return FilteredArticles(links=[], matched_count=0)

        matched_links: List[str] = []
        seen = set()

        for article in articles:
            current_date = parse_iso_date(article.get("publishDate") or "")
            if not current_date:
                continue
            if current_date < start or current_date > end:
                continue

            url = normalize_article_url(article.get("url", ""))
            if not url or url in seen:
                continue

            seen.add(url)
            matched_links.append(url)

        return FilteredArticles(links=matched_links, matched_count=len(matched_links))

    def _serialize_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": job["id"],
            "seedUrl": job["seedUrl"],
            "biz": job["biz"],
            "nickname": job.get("nickname", ""),
            "startDate": job["startDate"],
            "endDate": job["endDate"],
            "status": job["status"],
            "message": job.get("message", ""),
            "profileUrl": job.get("profileUrl", ""),
            "count": job.get("count", 0),
            "links": list(job.get("links", [])),
            "createdAt": job["createdAt"],
            "updatedAt": job["updatedAt"],
        }


STORE = HistoryStore(STATE_FILE)


class HelperHandler(BaseHTTPRequestHandler):
    server_version = "WechatHistoryHelper/0.1"

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:
        if self.path == "/" or self.path == "":
            self._send_html()
            return

        if self.path == "/v1/health":
            self._send_json(
                200,
                {
                    "ok": True,
                    "version": VERSION,
                    "helper": STORE.health(),
                },
            )
            return

        if self.path == "/v1/system-proxy/status":
            self._send_json(
                200,
                {
                    "ok": True,
                    "proxy": STORE.proxy_status(),
                },
            )
            return

        if self.path.startswith("/v1/wechat/history/jobs/"):
            job_id = self.path.rsplit("/", 1)[-1]
            job = STORE.get_job(job_id)
            if not job:
                self._send_json(404, {"ok": False, "error": "任务不存在"})
                return

            self._send_json(200, {"ok": True, "job": job})
            return

        self._send_json(404, {"ok": False, "error": "未找到接口"})

    def do_POST(self) -> None:
        try:
            payload = self._read_json()
        except ValueError as error:
            self._send_json(400, {"ok": False, "error": str(error)})
            return

        if self.path == "/v1/wechat/history/resolve":
            seed_url = str(payload.get("seedUrl") or "").strip()
            biz = str(payload.get("biz") or "").strip()
            nickname = str(payload.get("nickname") or "").strip()
            start_date = str(payload.get("startDate") or "").strip()
            end_date = str(payload.get("endDate") or "").strip()

            if not seed_url:
                self._send_json(400, {"ok": False, "error": "缺少 seedUrl"})
                return
            if not biz:
                self._send_json(400, {"ok": False, "error": "缺少 biz"})
                return
            if not parse_iso_date(start_date) or not parse_iso_date(end_date):
                self._send_json(400, {"ok": False, "error": "日期格式必须是 YYYY-MM-DD"})
                return
            if start_date > end_date:
                self._send_json(400, {"ok": False, "error": "开始日期不能晚于结束日期"})
                return

            job = STORE.create_job(seed_url, biz, nickname, start_date, end_date)
            self._send_json(200, {"ok": True, "job": job})
            return

        if self.path == "/v1/system-proxy/enable":
            payload = self._read_json()
            service = str(payload.get("service") or "Wi-Fi").strip() or "Wi-Fi"
            capture_host = str(payload.get("captureHost") or "127.0.0.1").strip() or "127.0.0.1"
            capture_port = safe_int(payload.get("capturePort")) or 8080

            try:
                proxy = STORE.configure_capture_proxy(
                    service,
                    capture_host,
                    capture_port,
                )
            except Exception as error:
                self._send_json(400, {"ok": False, "error": str(error)})
                return

            self._send_json(
                200,
                {
                    "ok": True,
                    "proxy": proxy,
                    "message": "已切换到抓取代理模式。系统可能会弹出 macOS 管理员授权框；授权后 HTTP/HTTPS 会切到 mitmproxy，请确认你已经关闭了其他代理工具。",
                },
            )
            return

        if self.path == "/v1/system-proxy/restore":
            payload = self._read_json()
            service = str(payload.get("service") or "").strip() or None

            try:
                proxy = STORE.restore_proxy(service)
            except Exception as error:
                self._send_json(400, {"ok": False, "error": str(error)})
                return

            self._send_json(
                200,
                {
                    "ok": True,
                    "proxy": proxy,
                    "message": "已恢复抓取前的系统代理设置。",
                },
            )
            return

        if self.path == "/v1/wechat/history/capture":
            biz = str(payload.get("biz") or "").strip()
            nickname = str(payload.get("nickname") or "").strip()
            source = str(payload.get("source") or "mitmproxy").strip()
            articles = payload.get("articles") or []

            if not biz:
                self._send_json(400, {"ok": False, "error": "缺少 biz"})
                return
            if not isinstance(articles, list):
                self._send_json(400, {"ok": False, "error": "articles 必须是数组"})
                return

            try:
                capture = STORE.upsert_capture(biz, nickname, articles, source)
            except ValueError as error:
                self._send_json(400, {"ok": False, "error": str(error)})
                return

            self._send_json(200, {"ok": True, "capture": capture})
            return

        self._send_json(404, {"ok": False, "error": "未找到接口"})

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _read_json(self) -> Dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            return {}

        raw = self.rfile.read(content_length)
        if not raw:
            return {}

        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError("请求体不是合法 JSON") from error

    def _send_json(self, status: int, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self) -> None:
        body = f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>公众号历史 helper</title>
    <style>
      body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #f6f2eb; color: #241d14; }}
      main {{ max-width: 780px; margin: 0 auto; padding: 32px 20px 48px; }}
      .card {{ background: #fffaf4; border: 1px solid rgba(80, 58, 24, 0.1); border-radius: 16px; padding: 20px; box-shadow: 0 16px 40px rgba(80, 58, 24, 0.08); }}
      code {{ background: rgba(198, 110, 15, 0.08); padding: 2px 6px; border-radius: 6px; }}
      pre {{ background: #1e1e1e; color: #f3f3f3; padding: 14px; border-radius: 12px; overflow: auto; }}
      h1 {{ margin-top: 0; }}
      li {{ line-height: 1.7; }}
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>公众号历史 helper</h1>
        <p>服务已启动，当前版本 <code>{VERSION}</code>。</p>
        <p>这个 helper 只负责缓存和返回同公众号历史文章链接，不负责正文导出。正文下载仍由 Chrome 扩展完成。</p>
        <ol>
          <li>启动本服务：<code>python3 helper/wechat_history_helper.py</code></li>
          <li>启动 mitmproxy 插件：<code>mitmdump -s helper/mitm_wechat_history_addon.py</code></li>
          <li>在微信客户端中打开公众号历史页，让插件捕获 <code>profile_ext?action=getmsg</code> 响应</li>
          <li>回到扩展里执行“按范围批量下载”</li>
        </ol>
        <p>健康检查接口：</p>
        <pre>GET /v1/health</pre>
      </div>
    </main>
  </body>
</html>""".encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run WeChat history helper")
    parser.add_argument("--host", default="127.0.0.1", help="bind host")
    parser.add_argument("--port", type=int, default=17866, help="bind port")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), HelperHandler)
    print(f"[helper] listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
