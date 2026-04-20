(function (globalScope) {
  function classifyExportUrl(url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return "unsupported";
      }

      if (isWechatMpBackendParsedUrl(parsed)) {
        return "unsupported";
      }

      if (isFeishuExportUrl(parsed)) {
        return "feishu";
      }

      if (isWechatArticleParsedUrl(parsed)) {
        return "wechat";
      }

      return "generic-web";
    } catch (error) {
      return "unsupported";
    }
  }

  function isSingleExportUrl(url) {
    return classifyExportUrl(url) !== "unsupported";
  }

  function isBatchExportUrl(url) {
    const type = classifyExportUrl(url);
    return type === "feishu" || type === "wechat";
  }

  function isWechatArticleUrl(url) {
    try {
      return isWechatArticleParsedUrl(new URL(url));
    } catch (error) {
      return false;
    }
  }

  function isWechatMpBackendUrl(url) {
    try {
      return isWechatMpBackendParsedUrl(new URL(url));
    } catch (error) {
      return false;
    }
  }

  function isFeishuExportUrl(parsed) {
    return /(^|\.)((feishu\.cn)|(larksuite\.com)|(larkoffice\.com))$/.test(parsed.hostname)
      && /^\/(docx|wiki)\//.test(parsed.pathname);
  }

  function isWechatArticleParsedUrl(parsed) {
    return parsed.hostname === "mp.weixin.qq.com" && /^\/s(?:$|\/)/.test(parsed.pathname);
  }

  function isWechatMpBackendParsedUrl(parsed) {
    return parsed.hostname === "mp.weixin.qq.com" && /^\/cgi-bin\//.test(parsed.pathname);
  }

  const api = {
    classifyExportUrl,
    isSingleExportUrl,
    isBatchExportUrl,
    isWechatArticleUrl,
    isWechatMpBackendUrl
  };

  globalScope.ExportUrlUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
