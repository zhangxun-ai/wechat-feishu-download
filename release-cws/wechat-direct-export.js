(function (globalScope) {
  const stripWechatUiNoiseFromMarkdown = globalScope.WechatMarkdownCleanup?.stripWechatUiNoiseFromMarkdown || ((value) => value);
  const INVISIBLE_TEXT_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
  const WECHAT_REMOVE_SELECTOR = [
    "script",
    "style",
    "noscript",
    ".js_mp_wording_wrp",
    ".js_ad_link",
    ".js_product_container",
    ".js_product_loop_content",
    ".js_minipro_dialog_container",
    ".weapp_display_element",
    ".wx_profile_card_inner",
    ".wx_profile_card",
    ".original_area_primary",
    ".original_primary_card_tips",
    ".js_reward_area",
    ".reward_area",
    ".reward_qrcode_area",
    ".js_like_container",
    ".js_praise_area",
    ".rich_media_area_extra",
    ".reward_wrapper",
    ".discuss_container",
    ".js_comment_area",
    ".js_tags_area",
    ".js_unread_area",
    ".js_related_article",
    ".js_recommend_container",
    ".mp_profile_iframe_wrp",
    ".js_img_loading"
  ].join(",");

  async function exportMarkdownFromHtml({ html, sourceUrl, finalUrl, includeImages = true, fetchAssetAsDataUrl }) {
    const baseUrl = String(finalUrl || sourceUrl || "").trim();
    const doc = parseWechatHtmlDocument(html, baseUrl);
    const meta = getWechatArticleMetaFromDocument(doc);
    const root = getWechatArticleRootFromDocument(doc);
    const clonedRoot = root.cloneNode(true);

    await sanitizeWechatArticle(clonedRoot, {
      includeImages,
      baseUrl,
      fetchAssetAsDataUrl
    });

    let markdownBody = cleanupMarkdown(convertBlock(clonedRoot, 0, {
      baseUrl,
      pageTitle: meta.title
    }));

    if (!includeImages) {
      markdownBody = stripMarkdownImages(markdownBody);
    }
    markdownBody = stripWechatUiNoiseFromMarkdown(markdownBody);

    if (!markdownBody) {
      throw new Error("未提取到公众号正文");
    }

    return {
      filename: buildFilename(meta.title, "md"),
      mimeType: "text/markdown;charset=utf-8",
      content: buildMarkdownDocument(meta, markdownBody, baseUrl)
    };
  }

  function parseWechatHtmlDocument(html, baseUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(String(html || ""), "text/html");
    ensureBaseElement(doc, baseUrl);
    return doc;
  }

  function ensureBaseElement(doc, baseUrl) {
    if (!baseUrl) {
      return;
    }

    const head = doc.head || doc.documentElement.insertBefore(doc.createElement("head"), doc.body || null);
    let base = head.querySelector("base");
    if (!base) {
      base = doc.createElement("base");
      head.prepend(base);
    }
    base.setAttribute("href", baseUrl);
  }

  function getWechatArticleMetaFromDocument(doc) {
    const title = normalizeWechatTitle(
      doc.querySelector("#activity-name .js_title_inner")?.textContent
      || doc.querySelector("#activity-name")?.textContent
      || doc.querySelector('meta[property="og:title"]')?.getAttribute("content")
      || doc.title
    );
    const author = cleanupInline(
      doc.querySelector("#js_name")?.textContent
      || doc.querySelector(".rich_media_meta_nickname")?.textContent
      || ""
    );
    const publishTime = cleanupInline(doc.querySelector("#publish_time")?.textContent || "");

    return {
      pageType: "公众号文章",
      title: title || "未命名文章",
      author,
      publishTime
    };
  }

  function getWechatArticleRootFromDocument(doc) {
    const selectors = [
      "#js_content",
      "#img-content #js_content",
      "#js_article #js_content"
    ];

    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      if (node) {
        return node;
      }
    }

    const blockedReason = detectWechatBlockedPage(doc);
    if (blockedReason) {
      const error = new Error(blockedReason);
      error.code = "WECHAT_VERIFY_PAGE";
      throw error;
    }

    throw new Error("未找到公众号正文节点 #js_content");
  }

  function detectWechatBlockedPage(doc) {
    const title = cleanupInline(
      doc.querySelector(".weui-msg__title")?.textContent
      || doc.querySelector("title")?.textContent
      || ""
    );
    const desc = cleanupInline(doc.querySelector(".weui-msg__desc")?.textContent || "");
    const bodyText = cleanupInline(doc.body?.textContent || "");
    const html = String(doc.documentElement?.innerHTML || "");

    if (/环境异常/.test(title) || /完成验证后即可继续访问/.test(desc)) {
      return "当前环境触发微信验证页";
    }

    if (/secitptpage\/verify/i.test(html) || /去验证/.test(bodyText)) {
      return "当前环境触发微信验证页";
    }

    return "";
  }

  async function sanitizeWechatArticle(root, options) {
    removeWechatNoise(root);
    replaceWechatEmbeds(root, options.baseUrl);
    await hydrateWechatImages(root, options);
    cleanupEmptyWechatNodes(root);
  }

  function removeWechatNoise(root) {
    for (const node of Array.from(root.querySelectorAll(WECHAT_REMOVE_SELECTOR))) {
      node.remove();
    }

    for (const node of Array.from(root.querySelectorAll("[style]"))) {
      const style = node.getAttribute("style") || "";
      if (/display\s*:\s*none/i.test(style)) {
        node.remove();
      }
    }
  }

  function replaceWechatEmbeds(root, baseUrl) {
    const doc = root.ownerDocument || document;
    for (const iframe of Array.from(root.querySelectorAll("iframe"))) {
      const src = iframe.getAttribute("src") || iframe.getAttribute("data-src") || "";
      if (!src) {
        iframe.remove();
        continue;
      }

      const link = doc.createElement("a");
      link.href = toAbsoluteUrl(src, baseUrl);
      link.textContent = "视频/音频链接";
      iframe.replaceWith(link);
    }
  }

  async function hydrateWechatImages(root, options) {
    const includeImages = options.includeImages !== false;
    const images = Array.from(root.querySelectorAll("img"));

    for (const image of images) {
      const resolvedUrl = resolveWechatImageUrl(image, options.baseUrl);

      if (!includeImages || !resolvedUrl) {
        image.remove();
        continue;
      }

      const embeddedUrl = await options.fetchAssetAsDataUrl?.(resolvedUrl);
      image.setAttribute("src", embeddedUrl || resolvedUrl);
      image.setAttribute("alt", buildWechatImageAlt(image));
      image.removeAttribute("data-src");
      image.removeAttribute("data-original");
      image.removeAttribute("data-backsrc");
      image.removeAttribute("data-actualsrc");
      image.removeAttribute("srcset");
      image.className = "";
    }
  }

  function cleanupEmptyWechatNodes(root) {
    const removableSelectors = ["p", "section", "div", "span"];
    let changed = true;

    while (changed) {
      changed = false;
      const nodes = Array.from(root.querySelectorAll(removableSelectors.join(",")));
      for (const node of nodes) {
        const hasMedia = node.querySelector("img, video, audio, iframe, table, pre");
        const text = cleanupInline(node.textContent || "");
        if (!hasMedia && !text && node.children.length === 0) {
          node.remove();
          changed = true;
        }
      }
    }
  }

  function resolveWechatImageUrl(image, baseUrl) {
    const candidates = [
      image.getAttribute("data-src"),
      image.getAttribute("data-original"),
      image.getAttribute("data-backsrc"),
      image.getAttribute("data-actualsrc"),
      image.currentSrc,
      image.getAttribute("src")
    ];

    for (const candidate of candidates) {
      const url = String(candidate || "").trim();
      if (!url || url.startsWith("data:image/svg+xml")) {
        continue;
      }
      return toAbsoluteUrl(url, baseUrl);
    }

    return "";
  }

  function buildWechatImageAlt(image) {
    return cleanupInline(
      image.getAttribute("data-caption")
      || image.getAttribute("data-title")
      || image.getAttribute("alt")
      || "公众号图片"
    ) || "公众号图片";
  }

  function convertBlock(node, depth, context) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeInlineText(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE || shouldSkipNode(node)) {
      return "";
    }

    const tagName = node.tagName.toLowerCase();

    if (tagName === "img") {
      return imageToMarkdown(node, context);
    }

    if (tagName === "br") {
      return "\n";
    }

    if (tagName === "hr") {
      return "---";
    }

    if (tagName === "pre") {
      return codeBlockToMarkdown(node);
    }

    if (tagName === "table") {
      return tableToMarkdown(node, context);
    }

    if (tagName === "ul" || tagName === "ol") {
      return listToMarkdown(node, depth, context);
    }

    if (tagName === "blockquote") {
      const content = cleanupMarkdown(Array.from(node.childNodes).map((child) => convertBlock(child, depth + 1, context)).join("\n"));
      return content
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    const headingLevel = getHeadingLevel(node);
    if (headingLevel) {
      const content = cleanupMarkdown(convertInlineChildren(node, context));
      if (!content || content === cleanupMarkdown(context.pageTitle || "")) {
        return "";
      }
      return `${"#".repeat(headingLevel)} ${content}`;
    }

    if (tagName === "li") {
      return listItemToMarkdown(node, depth, false, 0, context);
    }

    if (isBlockNode(tagName)) {
      const childBlocks = Array.from(node.childNodes)
        .map((child) => convertBlock(child, depth, context))
        .filter(Boolean);

      if (childBlocks.length > 0 && hasMeaningfulBlockChildren(node)) {
        return cleanupMarkdown(childBlocks.join("\n\n"));
      }

      return cleanupMarkdown(convertInlineChildren(node, context));
    }

    return convertInline(node, context);
  }

  function convertInline(node, context) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeInlineText(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE || shouldSkipNode(node)) {
      return "";
    }

    const tagName = node.tagName.toLowerCase();

    if (tagName === "br") {
      return "  \n";
    }

    if (tagName === "img") {
      return imageToMarkdown(node, context);
    }

    if (tagName === "a") {
      const text = cleanupMarkdown(convertInlineChildren(node, context)) || normalizeInlineText(node.textContent || "");
      const href = toAbsoluteUrl(node.getAttribute("href") || "", context.baseUrl);
      return href ? `[${text || href}](${href})` : text;
    }

    if (tagName === "code" && node.parentElement?.tagName.toLowerCase() !== "pre") {
      const content = normalizeInlineText(node.textContent || "");
      return content ? `\`${content}\`` : "";
    }

    const content = convertInlineChildren(node, context);
    if (!content) {
      return "";
    }

    if (["strong", "b"].includes(tagName)) {
      return `**${content}**`;
    }

    if (["em", "i"].includes(tagName)) {
      return `*${content}*`;
    }

    if (tagName === "s" || tagName === "del") {
      return `~~${content}~~`;
    }

    return content;
  }

  function convertInlineChildren(node, context) {
    return cleanupInline(
      Array.from(node.childNodes)
        .map((child) => convertInline(child, context))
        .join("")
    );
  }

  function listToMarkdown(listNode, depth, context) {
    const ordered = listNode.tagName.toLowerCase() === "ol";
    const items = Array.from(listNode.children).filter((child) => child.tagName?.toLowerCase() === "li");

    return items
      .map((item, index) => listItemToMarkdown(item, depth, ordered, index, context))
      .join("\n");
  }

  function listItemToMarkdown(item, depth, ordered, index, context) {
    const indent = "  ".repeat(depth);
    const marker = ordered ? `${index + 1}. ` : "- ";
    const inlineParts = [];
    const nestedLists = [];

    for (const child of Array.from(item.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childTag = child.tagName.toLowerCase();
        if (childTag === "ul" || childTag === "ol") {
          nestedLists.push(child);
          continue;
        }
      }

      inlineParts.push(convertInline(child, context));
    }

    const head = cleanupInline(inlineParts.join("")) || " ";
    const tail = nestedLists
      .map((list) => listToMarkdown(list, depth + 1, context))
      .filter(Boolean)
      .join("\n");

    return `${indent}${marker}${head}${tail ? `\n${tail}` : ""}`;
  }

  function codeBlockToMarkdown(node) {
    const content = (node.textContent || "").replace(/\n+$/, "");
    return `\`\`\`\n${content}\n\`\`\``;
  }

  function imageToMarkdown(node, context) {
    const src = node.currentSrc || node.getAttribute("src") || node.getAttribute("data-src") || "";
    if (!src) {
      return "";
    }

    const alt = normalizeInlineText(node.getAttribute("alt") || "");
    return `![${alt}](${toAbsoluteUrl(src, context.baseUrl)})`;
  }

  function tableToMarkdown(table, context) {
    const rows = Array.from(table.querySelectorAll("tr"))
      .map((row) => Array.from(row.children).map((cell) => cleanupInline(convertInlineChildren(cell, context))))
      .filter((row) => row.length > 0);

    if (rows.length === 0) {
      return "";
    }

    const columnCount = Math.max(...rows.map((row) => row.length));
    const normalizedRows = rows.map((row) => {
      const copy = row.slice();
      while (copy.length < columnCount) {
        copy.push("");
      }
      return copy;
    });

    const header = normalizedRows[0];
    const separator = new Array(columnCount).fill("---");
    const body = normalizedRows.slice(1);
    const lines = [
      `| ${header.join(" | ")} |`,
      `| ${separator.join(" | ")} |`
    ];

    for (const row of body) {
      lines.push(`| ${row.join(" | ")} |`);
    }

    return lines.join("\n");
  }

  function getHeadingLevel(node) {
    const tagName = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) {
      return Number(tagName[1]);
    }

    const ariaLevel = node.getAttribute("aria-level");
    if (node.getAttribute("role") === "heading" && ariaLevel) {
      return Math.min(Math.max(Number(ariaLevel) || 1, 1), 6);
    }

    const style = (node.getAttribute("style") || "").toLowerCase();
    const fontSize = extractCssNumber(style, "font-size");
    const fontWeight = extractCssNumber(style, "font-weight");

    if (fontWeight >= 600 && fontSize >= 28) {
      return 1;
    }

    if (fontWeight >= 600 && fontSize >= 22) {
      return 2;
    }

    if (fontWeight >= 600 && fontSize >= 18) {
      return 3;
    }

    return 0;
  }

  function extractCssNumber(style, property) {
    const match = String(style || "").match(new RegExp(`${property}\\s*:\\s*([\\d.]+)`, "i"));
    return match ? Number(match[1]) : 0;
  }

  function isBlockNode(tagName) {
    return [
      "article",
      "section",
      "main",
      "div",
      "p",
      "header",
      "footer",
      "aside",
      "figure",
      "figcaption"
    ].includes(tagName);
  }

  function hasMeaningfulBlockChildren(node) {
    return Array.from(node.children).some((child) => {
      const tagName = child.tagName.toLowerCase();
      return ["div", "p", "section", "article", "ul", "ol", "table", "pre", "blockquote"].includes(tagName);
    });
  }

  function shouldSkipNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    const tagName = node.tagName.toLowerCase();
    if (["script", "style", "noscript", "textarea", "input", "button", "canvas", "iframe"].includes(tagName)) {
      return true;
    }

    if (node.matches?.(WECHAT_REMOVE_SELECTOR)) {
      return true;
    }

    if (node.hidden) {
      return true;
    }

    const style = node.getAttribute("style") || "";
    if (/display\s*:\s*none/i.test(style) || /visibility\s*:\s*hidden/i.test(style)) {
      return true;
    }

    return false;
  }

  function buildMarkdownDocument(meta, body, sourceUrl) {
    const parts = [
      `# ${meta.title}`,
      "",
      `- 页面类型: ${meta.pageType}`,
      `- 来源: ${sourceUrl}`,
      meta.author ? `- 作者: ${meta.author}` : "",
      meta.publishTime ? `- 发布时间: ${meta.publishTime}` : "",
      `- 导出时间: ${new Date().toLocaleString()}`,
      "",
      "---",
      "",
      body || "_未提取到正文内容_"
    ];

    return cleanupMarkdown(parts.join("\n"));
  }

  function buildFilename(title, extension) {
    return `${sanitizeFilename(title || "local-document")}.${extension}`;
  }

  function sanitizeFilename(value) {
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    let normalized = String(value || "")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "")
      .slice(0, 120);

    if (!normalized) {
      normalized = "local-document";
    }

    if (reserved.test(normalized)) {
      normalized = `file-${normalized}`;
    }

    return normalized;
  }

  function normalizeWechatTitle(value) {
    return stripInvisibleText(String(value || ""))
      .replace(/\s+/g, " ")
      .replace(/\s+-\s+微信公众平台$/, "")
      .trim();
  }

  function toAbsoluteUrl(url, baseUrl) {
    try {
      const parsed = new URL(url, baseUrl || location.href);
      if (/\.qpic\.cn$/i.test(parsed.hostname) && parsed.protocol === "http:") {
        parsed.protocol = "https:";
      }
      if (parsed.hostname === "mp.weixin.qq.com" && parsed.protocol === "http:") {
        parsed.protocol = "https:";
      }
      return parsed.toString();
    } catch (error) {
      return String(url || "");
    }
  }

  function cleanupInline(value) {
    return stripInvisibleText(value).replace(/[ \t]+\n/g, "\n").replace(/\s{2,}/g, " ").trim();
  }

  function cleanupMarkdown(value) {
    return stripInvisibleText(value)
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeInlineText(value) {
    return stripInvisibleText(String(value || "").replace(/\s+/g, " "));
  }

  function stripInvisibleText(value) {
    return String(value || "")
      .replace(INVISIBLE_TEXT_RE, "")
      .replace(/\u00A0/g, " ");
  }

  function stripMarkdownImages(value) {
    return cleanupMarkdown(
      String(value || "")
        .replace(/!\[[^\]]*]\([^)]+\)/g, "")
        .replace(/<img\b[^>]*>/gi, "")
    );
  }

  globalScope.WechatDirectExport = {
    exportMarkdownFromHtml
  };
})(globalThis);
