(function (globalScope) {
  const POPUP_CATEGORIES = Object.freeze([
    { key: "wechat", label: "微信公众号" },
    { key: "feishu", label: "飞书" },
    { key: "scys", label: "生财有术" },
    { key: "other", label: "其它" }
  ]);
  const POPUP_PRESETS = Object.freeze([
    {
      key: "quick-export",
      label: "快速导出",
      description: "下载并保留图片，适合留档"
    },
    {
      key: "ai-ready",
      label: "发给 AI",
      description: "Markdown 无图，适合分析"
    },
    {
      key: "obsidian",
      label: "存到 Obsidian",
      description: "直接写入 Vault"
    }
  ]);
  const OUTPUT_TARGET_LABELS = {
    download: "仅下载",
    both: "下载 + Obsidian",
    obsidian: "仅 Obsidian"
  };

  function getPopupCategories() {
    return POPUP_CATEGORIES.map((item) => ({ ...item }));
  }

  function getPopupPresets() {
    return POPUP_PRESETS.map((item) => ({ ...item }));
  }

  function resolvePopupCategory(input = {}) {
    if (input.isScysCourse || input.isScysPage) {
      return "scys";
    }

    if (input.isWechatMpBackend || input.exportType === "wechat") {
      return "wechat";
    }

    if (input.exportType === "feishu") {
      return "feishu";
    }

    return "other";
  }

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

  function resolvePopupPresetState(input = {}) {
    const outputTarget = normalizeOutputTarget(input.outputTarget, "download");
    const includeImages = input.includeImages !== false;

    if (outputTarget === "obsidian") {
      return { key: "obsidian", label: "存到 Obsidian" };
    }

    if (outputTarget === "download" && includeImages === false) {
      return { key: "ai-ready", label: "发给 AI" };
    }

    if (outputTarget === "download") {
      return { key: "quick-export", label: "快速导出" };
    }

    return { key: "custom", label: "自定义组合" };
  }

  function buildExportCompletionStatus(input = {}) {
    const format = String(input.format || "markdown").toUpperCase();
    const downloadedFilename = String(input.downloadedFilename || "").trim();
    const savedToObsidian = input.savedToObsidian === true;

    if (downloadedFilename && savedToObsidian) {
      return `${format} 下载完成：${downloadedFilename}，并已写入 Obsidian。`;
    }

    if (downloadedFilename) {
      return `${format} 下载完成：${downloadedFilename}。`;
    }

    if (savedToObsidian) {
      return `${format} 已生成，并已写入 Obsidian。`;
    }

    return `${format} 已生成。`;
  }

  function buildPrimaryActionModel(input = {}) {
    const pageInfo = input.pageInfo || null;
    const supportsMarkdown = Array.isArray(pageInfo?.supports) && pageInfo.supports.includes("markdown");
    const detectedCategory = resolvePopupCategory({
      exportType: input.exportType,
      isWechatMpBackend: input.isWechatMpBackend,
      isScysCourse: input.canExportCourse
    });

    if (input.isWechatMpBackend) {
      return {
        headline: "公众号后台已就绪",
        summary: "当前页已经是公众号后台，可直接切到“微信公众号”分类继续按日期范围批量下载。",
        primaryAction: {
          key: "focus-wechat-history",
          label: "打开后台模式"
        },
        secondaryAction: null
      };
    }

    if (!input.isSupportedPage || !supportsMarkdown) {
      return {
        headline: "当前页暂不支持直接导出",
        summary: "请先打开支持导出的页面，或切换顶部分类使用批量下载和后台模式。",
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

    if (detectedCategory === "wechat") {
      return {
        headline: "当前页已就绪",
        summary: "当前页面是公众号文章，可直接导出 Markdown，也可以切到“微信公众号”分类处理批量任务。",
        primaryAction: {
          key: "export-markdown",
          label: "导出当前文章"
        },
        secondaryAction: null
      };
    }

    if (detectedCategory === "feishu") {
      return {
        headline: "当前页已就绪",
        summary: "当前页面支持飞书文档导出。",
        primaryAction: {
          key: "export-markdown",
          label: "导出当前飞书文档"
        },
        secondaryAction: null
      };
    }

    if (detectedCategory === "other") {
      return {
        headline: "当前页已就绪",
        summary: "当前页面支持网页正文导出 Markdown。",
        primaryAction: {
          key: "export-markdown",
          label: "导出当前网页"
        },
        secondaryAction: null
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
    getPopupCategories,
    getPopupPresets,
    resolvePopupCategory,
    resolvePopupPresetState,
    normalizeOutputTarget,
    getOutputTargetState,
    buildExportCompletionStatus,
    buildPrimaryActionModel
  };

  globalScope.ExportUiModels = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
