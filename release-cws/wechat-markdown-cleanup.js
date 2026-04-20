(function (globalScope, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalScope.WechatMarkdownCleanup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const STRONG_NOISE_PATTERNS = [
    /微信扫一扫赞赏作者/i,
    /\blike the author\b/i,
    /赞赏金额/,
    /最低赞赏/,
    /赞赏后展示我的头像/,
    /我也喜欢你哦/,
    /^other amount$/i,
    /^name cleared$/i,
    /^loading(?:\.\.\.)?$/i,
    /^\d+\s*人喜欢$/,
    /^暂无作品$/
  ];
  const LIGHT_NOISE_PATTERNS = [
    /^close$/i,
    /^back$/i,
    /^作品$/,
    /^[¥$]$/,
    /^[0-9.\s¥$]+$/
  ];
  const TRAILING_LOCATION_TIME_RE = /^[^0-9,，\n]{1,20}[,，]\s*\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{2})?$/;
  const SIGNATURE_BLOCK_RE = /^[\p{Script=Han}A-Za-z0-9·_\- ]{2,20}$/u;

  function stripWechatUiNoiseFromMarkdown(markdown) {
    const blocks = splitMarkdownBlocks(markdown);
    if (blocks.length === 0) {
      return "";
    }

    let end = blocks.length;
    let removedCount = 0;
    let removedStrongRewardNoise = false;

    while (end > 0) {
      const block = blocks[end - 1];
      if (!isTrailingWechatNoiseBlock(block)) {
        break;
      }

      if (hasStrongRewardSignal(block)) {
        removedStrongRewardNoise = true;
      }

      end -= 1;
      removedCount += 1;
    }

    if (removedCount > 0 && removedStrongRewardNoise && end > 0 && isLikelySignatureBlock(blocks[end - 1])) {
      end -= 1;
    }

    return cleanupMarkdown(blocks.slice(0, end).join("\n\n"));
  }

  function maybeStripWechatUiNoiseFromMarkdown(markdown) {
    const value = String(markdown || "");
    if (!looksLikeWechatArticleMarkdown(value)) {
      return value;
    }

    return stripWechatUiNoiseFromMarkdown(value);
  }

  function splitMarkdownBlocks(markdown) {
    return cleanupMarkdown(markdown)
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  function isTrailingWechatNoiseBlock(block) {
    const normalized = normalizeBlock(block);
    const comparable = normalizeBlockForMatching(block);
    if (!normalized) {
      return false;
    }

    if (TRAILING_LOCATION_TIME_RE.test(comparable)) {
      return true;
    }

    if (STRONG_NOISE_PATTERNS.some((pattern) => pattern.test(comparable))) {
      return true;
    }

    if (LIGHT_NOISE_PATTERNS.some((pattern) => pattern.test(comparable))) {
      return comparable.length <= 30;
    }

    return false;
  }

  function hasStrongRewardSignal(block) {
    const comparable = normalizeBlockForMatching(block);
    return STRONG_NOISE_PATTERNS.some((pattern) => pattern.test(comparable));
  }

  function isLikelySignatureBlock(block) {
    const normalized = normalizeBlockForMatching(block);
    if (!normalized || normalized.length > 20) {
      return false;
    }

    if (/[，。！？,.!?:：]/.test(normalized) || /\d{4}年/.test(normalized)) {
      return false;
    }

    if (!SIGNATURE_BLOCK_RE.test(normalized)) {
      return false;
    }

    if (/^[\p{Script=Han}]+$/u.test(normalized)) {
      return normalized.length >= 2 && normalized.length <= 4;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    return words.length >= 1 && words.length <= 3 && normalized.length <= 20;
  }

  function normalizeBlock(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeBlockForMatching(value) {
    return normalizeBlock(value)
      .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanupMarkdown(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function looksLikeWechatArticleMarkdown(value) {
    const normalized = String(value || "");
    return /- 页面类型:\s*公众号文章/.test(normalized)
      || /- 来源:\s*https:\/\/mp\.weixin\.qq\.com\/s/i.test(normalized)
      || /微信扫一扫赞赏作者/.test(normalized)
      || /Like the Author/i.test(normalized);
  }

  return {
    stripWechatUiNoiseFromMarkdown,
    maybeStripWechatUiNoiseFromMarkdown
  };
});
