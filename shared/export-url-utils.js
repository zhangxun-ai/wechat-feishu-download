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

  function isScysCourseUrl(url) {
    try {
      const parsed = new URL(url);
      return isScysCourseParsedUrl(parsed) || isScysEmbeddedCourseParsedUrl(parsed);
    } catch (error) {
      return false;
    }
  }

  function isScysEmbeddedCourseUrl(url) {
    try {
      return isScysEmbeddedCourseParsedUrl(new URL(url));
    } catch (error) {
      return false;
    }
  }

  function selectScysCourseFrameTarget(frameResults, outerUrl) {
    let outer = null;
    try {
      outer = new URL(String(outerUrl || ""));
    } catch (error) {
      return null;
    }

    if (!isScysEmbeddedCourseParsedUrl(outer)) {
      return null;
    }

    const outerCourseId = getScysCourseIdFromParsedUrl(outer);
    const outerChapterId = outer.searchParams.get("chapterId") || "";
    for (const entry of Array.isArray(frameResults) ? frameResults : []) {
      const rawUrl = typeof entry?.result === "string"
        ? entry.result
        : typeof entry?.result?.href === "string"
          ? entry.result.href
          : "";
      let candidate = null;
      try {
        candidate = new URL(rawUrl);
      } catch (error) {
        continue;
      }

      if (!isScysCourseParsedUrl(candidate)
        || getScysCourseIdFromParsedUrl(candidate) !== outerCourseId
        || candidate.searchParams.get("chapterId") !== outerChapterId
        || !Number.isInteger(entry?.frameId)) {
        continue;
      }

      return {
        frameId: entry.frameId,
        url: candidate.toString()
      };
    }

    return null;
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

  function isScysCourseParsedUrl(parsed) {
    return parsed.hostname === "scys.com"
      && (
        /^\/deepsea\/\d+\/course\/\d+/.test(parsed.pathname)
        || /^\/course\/detail\/\d+/.test(parsed.pathname)
      )
      && parsed.searchParams.has("chapterId");
  }

  function isScysEmbeddedCourseParsedUrl(parsed) {
    return parsed.hostname === "scys.com"
      && /^\/activity\/\d+\/course\/\d+(?:\/|$)/.test(parsed.pathname)
      && parsed.searchParams.has("chapterId");
  }

  function getScysCourseIdFromParsedUrl(parsed) {
    const activityMatch = parsed.pathname.match(/^\/activity\/\d+\/course\/(\d+)(?:\/|$)/);
    if (activityMatch) {
      return activityMatch[1];
    }

    const detailMatch = parsed.pathname.match(/^\/course\/detail\/(\d+)(?:\/|$)/);
    if (detailMatch) {
      return detailMatch[1];
    }

    const deepseaMatch = parsed.pathname.match(/^\/deepsea\/\d+\/course\/(\d+)(?:\/|$)/);
    return deepseaMatch ? deepseaMatch[1] : "";
  }

  const api = {
    classifyExportUrl,
    isSingleExportUrl,
    isBatchExportUrl,
    isWechatArticleUrl,
    isWechatMpBackendUrl,
    isScysCourseUrl,
    isScysEmbeddedCourseUrl,
    selectScysCourseFrameTarget
  };

  globalScope.ExportUrlUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
