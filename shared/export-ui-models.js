(function (globalScope) {
  const OUTPUT_TARGET_LABELS = {
    download: "仅下载",
    both: "下载 + Obsidian",
    obsidian: "仅 Obsidian"
  };

  function normalizeOutputTarget(value, fallback = "download") {
    const normalized = String(value || "").trim();
    if (normalized === "download" || normalized === "both" || normalized === "obsidian") {
      return normalized;
    }

    const safeFallback = String(fallback || "").trim();
    if (safeFallback === "download" || safeFallback === "both" || safeFallback === "obsidian") {
      return safeFallback;
    }

    return "download";
  }

  function getOutputTargetState(value) {
    const key = normalizeOutputTarget(value);
    return {
      key,
      wantsDownload: key !== "obsidian",
      wantsObsidian: key !== "download",
      label: OUTPUT_TARGET_LABELS[key]
    };
  }

  function buildPrimaryActionModel(input = {}) {
    const pageInfo = input.pageInfo || null;
    const supportsMarkdown = Array.isArray(pageInfo?.supports) && pageInfo.supports.includes("markdown");

    if (input.isWechatMpBackend) {
      return {
        headline: "公众号后台已就绪",
        summary: "当前页已经是公众号后台，但下载历史文章前还需要先配置种子文章链接和日期范围。",
        primaryAction: {
          key: "open-advanced",
          label: "打开高级工作台"
        },
        secondaryAction: null
      };
    }

    if (!input.isSupportedPage || !supportsMarkdown) {
      return {
        headline: "当前页暂不支持直接导出",
        summary: "请先打开支持导出的页面，或进入高级工作台处理批量下载和公众号后台任务。",
        primaryAction: null,
        secondaryAction: null
      };
    }

    if (input.canExportCourse) {
      return {
        headline: "当前页已就绪",
        summary: "当前是课程章节页。你可以优先导出整个专栏，也可以只导出当前文档。",
        primaryAction: {
          key: "export-course",
          label: "导出当前专栏"
        },
        secondaryAction: {
          key: "export-markdown",
          label: "仅导出当前文档"
        }
      };
    }

    return {
      headline: "当前页已就绪",
      summary: "当前页面支持直接导出 Markdown。",
      primaryAction: {
        key: "export-markdown",
        label: "导出当前文档"
      },
      secondaryAction: null
    };
  }

  const api = {
    normalizeOutputTarget,
    getOutputTargetState,
    buildPrimaryActionModel
  };

  globalScope.ExportUiModels = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
