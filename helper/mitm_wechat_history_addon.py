"""mitmproxy addon for capturing WeChat official account history traffic.

Run with:
  mitmdump -s helper/mitm_wechat_history_addon.py

The addon watches mp.weixin.qq.com profile_ext?action=getmsg responses, extracts
article URLs, and pushes them into the local helper.
"""

from __future__ import annotations

import html
import json
import os
import urllib.request
from typing import Any, Dict, List

from mitmproxy import ctx, http


HELPER_CAPTURE_URL = os.environ.get(
    "WECHAT_HISTORY_HELPER_CAPTURE_URL",
    "http://127.0.0.1:17866/v1/wechat/history/capture",
)
DEBUG_ALL_WECHAT = os.environ.get("WECHAT_HISTORY_DEBUG_ALL", "0") == "1"


def load_json_loose(text: str) -> Dict[str, Any]:
    raw = text.strip()
    if raw.startswith("for (;;);"):
        raw = raw[len("for (;;);") :].lstrip()
    return json.loads(raw)


def safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_url(value: str) -> str:
    raw = html.unescape(str(value or "").strip())
    if not raw:
        return ""
    if raw.startswith("//"):
        return f"https:{raw}"
    if raw.startswith("/"):
        return f"https://mp.weixin.qq.com{raw}"
    return raw


def extract_article(item: Dict[str, Any], timestamp: int | None) -> Dict[str, Any] | None:
    title = str(item.get("title") or "").strip()
    url = normalize_url(item.get("content_url") or item.get("url") or "")
    if not title or not url:
        return None

    return {
        "title": title,
        "url": url,
        "publishTimestamp": timestamp,
    }


def extract_articles(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    general_msg_list = payload.get("general_msg_list")
    if not general_msg_list:
        return []

    if isinstance(general_msg_list, str):
        general_msg_list = json.loads(general_msg_list)

    results: List[Dict[str, Any]] = []
    for item in general_msg_list.get("list", []):
        base_timestamp = safe_int((item.get("comm_msg_info") or {}).get("datetime"))
        ext = item.get("app_msg_ext_info") or {}
        main_article = extract_article(ext, base_timestamp)
        if main_article:
            results.append(main_article)

        for child in ext.get("multi_app_msg_item_list") or []:
            child_article = extract_article(child, base_timestamp)
            if child_article:
                results.append(child_article)

    deduped = {}
    for article in results:
        deduped[article["url"]] = article
    return list(deduped.values())


def post_capture(payload: Dict[str, Any]) -> None:
    request = urllib.request.Request(
        HELPER_CAPTURE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        response.read()


class WechatHistoryCaptureAddon:
    def load(self, loader) -> None:
        ctx.log.info(
            "[wechat-history] addon loaded, waiting for mp.weixin.qq.com /mp/profile_ext traffic"
        )

    def request(self, flow: http.HTTPFlow) -> None:
        if flow.request.pretty_host != "mp.weixin.qq.com":
            return

        if DEBUG_ALL_WECHAT:
            ctx.log.info(
                f"[wechat-history] request host={flow.request.pretty_host} path={flow.request.path} "
                f"action={flow.request.query.get('action', '')}"
            )

        if flow.request.path == "/mp/profile_ext":
            ctx.log.info(
                f"[wechat-history] profile_ext request action={flow.request.query.get('action', '')} "
                f"biz={flow.request.query.get('__biz', '')}"
            )

    def response(self, flow: http.HTTPFlow) -> None:
        if flow.request.pretty_host != "mp.weixin.qq.com":
            return
        if flow.request.path != "/mp/profile_ext":
            return
        action = flow.request.query.get("action") or ""
        biz = flow.request.query.get("__biz") or ""

        ctx.log.info(
            f"[wechat-history] profile_ext response action={action} status={flow.response.status_code} biz={biz}"
        )

        if action != "getmsg":
            return

        try:
            payload = load_json_loose(flow.response.get_text(strict=False))
            articles = extract_articles(payload)
            biz = biz or payload.get("__biz") or ""
            nickname = (
                payload.get("nickname")
                or payload.get("account_name")
                or flow.request.query.get("nickname")
                or ""
            )

            if not biz or not articles:
                payload_keys = ",".join(sorted(payload.keys()))
                ctx.log.warn(
                    "[wechat-history] getmsg seen but no usable articles "
                    f"(biz={biz}, nickname={nickname}, keys={payload_keys})"
                )
                return

            post_capture(
                {
                    "biz": biz,
                    "nickname": nickname,
                    "source": "mitmproxy",
                    "articles": articles,
                }
            )
            ctx.log.info(
                f"[wechat-history] captured {len(articles)} articles for biz={biz} nickname={nickname}"
            )
        except Exception as error:  # pragma: no cover - mitm runtime logging
            ctx.log.warn(f"[wechat-history] capture failed: {error}")


addons = [WechatHistoryCaptureAddon()]
