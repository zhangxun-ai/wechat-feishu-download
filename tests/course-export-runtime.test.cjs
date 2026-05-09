const assert = require("node:assert/strict");
const {
  buildCourseStoppedMessage,
  extractScysCourseApiMarkdown,
  formatElapsedDuration,
  getScysCourseIdFromUrl,
  getCourseExportWorkerCount,
  getCourseExportExecutionProfile,
  isScysCourseApiRateLimited
} = require("../shared/course-export-runtime.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("formats elapsed duration for short and long runs", () => {
  assert.equal(formatElapsedDuration(0), "00:00");
  assert.equal(formatElapsedDuration(12_000), "00:12");
  assert.equal(formatElapsedDuration(65_000), "01:05");
  assert.equal(formatElapsedDuration(3_726_000), "1:02:06");
});

test("recommends accelerated browser-render worker counts for course exports", () => {
  assert.equal(getCourseExportWorkerCount(0), 1);
  assert.equal(getCourseExportWorkerCount(8), 2);
  assert.equal(getCourseExportWorkerCount(24), 4);
  assert.equal(getCourseExportWorkerCount(96), 5);
});

test("builds a fast SCYS execution profile without fixed settle waits", () => {
  const profile = getCourseExportExecutionProfile(45);

  assert.equal(profile.mode, "browser-fast");
  assert.equal(profile.label, "浏览器加速模式");
  assert.equal(profile.workerCount, 4);
  assert.equal(profile.settleDelayMs, 0);
  assert.equal(profile.skipInitialSettle, true);
  assert.ok(profile.interTaskDelayMs <= 160);
  assert.ok(profile.workerStaggerMs <= 220);
  assert.equal(profile.maxRetries, 2);
  assert.ok(profile.retryBaseDelayMs >= 900);
});

test("builds a stopped course export summary", () => {
  assert.equal(
    buildCourseStoppedMessage({
      successCount: 2,
      failureCount: 3,
      skippedCount: 4,
      elapsed: "00:42"
    }),
    "专栏导出已停止，成功 2 章，失败 3 章，未处理 4 章，总耗时 00:42。"
  );
});

test("extracts course id from current and deepsea SCYS urls", () => {
  assert.equal(getScysCourseIdFromUrl("https://scys.com/course/detail/172?chapterId=11403"), "172");
  assert.equal(getScysCourseIdFromUrl("https://scys.com/deepsea/abc/course/172?chapterId=11403"), "172");
  assert.equal(getScysCourseIdFromUrl("https://example.com/course/detail/172"), "");
});

test("extracts readable markdown from SCYS chapter API payloads", () => {
  const markdown = extractScysCourseApiMarkdown({
    status: 0,
    data: {
      content: "<h1>章节标题</h1><p>第一段&nbsp;内容</p><ul><li>要点 A</li><li>要点 B</li></ul>"
    }
  });

  assert.match(markdown, /章节标题/);
  assert.match(markdown, /第一段 内容/);
  assert.match(markdown, /- 要点 A/);
  assert.match(markdown, /- 要点 B/);
});

test("extracts SCYS Feishu block trees without metadata noise", () => {
  const markdown = extractScysCourseApiMarkdown({
    status: 0,
    data: {
      chapter: {
        content: [
          {
            block_id: "R1l0d0PIsoluA1xcqQXc4AYFnpd",
            parent_id: "EmSWd2RSBoLS6sx7A7IcblkUnTh",
            document_id: "EmSWd2RSBoLS6sx7A7IcblkUnTh",
            block_type: 2,
            text: {
              elements: [
                { text_run: { content: "亦仁说：想法至富的时代来了，前提是用好 AI。" } }
              ]
            }
          },
          {
            block_id: "BVdsdCVlvoW3DsxdIrTcGNcnnAb",
            parent_id: "EmSWd2RSBoLS6sx7A7IcblkUnTh",
            document_id: "EmSWd2RSBoLS6sx7A7IcblkUnTh",
            block_type: 34,
            quote_container: {},
            children_blocks: [
              {
                block_id: "Cy3NdINgEovzsbxTKUfcIgAKnGg",
                parent_id: "BVdsdCVlvoW3DsxdIrTcGNcnnAb",
                document_id: "EmSWd2RSBoLS6sx7A7IcblkUnTh",
                block_type: 2,
                text: {
                  elements: [
                    { text_run: { content: "AI 没替他思考，只是把他的思考放大了。" } },
                    { mention_user: { user_id: "392" } }
                  ]
                }
              }
            ]
          },
          {
            block_id: "VjWodIiPMo2clfxlDIVcfmIcnsf",
            block_type: 12,
            bullet: {
              elements: [
                { text_run: { content: "研究怎么把一句指令写得更准" } }
              ]
            }
          },
          {
            block_id: "MynPbfrzqo4wMLxZwClcdwaYnwf",
            block_type: 27,
            image: { token: "MynPbfrzqo4wMLxZwClcdwaYnwf" },
            file_url: "https://example.com/image.png"
          }
        ]
      },
      recent_users: [
        {
          id: 7974452,
          name: "愿景成",
          xq_group_number: 165230,
          avatar: "https://search01.shengcaiyoushu.com/upload/avatar/noise"
        }
      ]
    }
  });

  assert.match(markdown, /亦仁说：想法至富的时代来了，前提是用好 AI。/);
  assert.match(markdown, /> AI 没替他思考，只是把他的思考放大了。/);
  assert.match(markdown, /- 研究怎么把一句指令写得更准/);
  assert.match(markdown, /!\[]\(https:\/\/example\.com\/image\.png\)/);
  assert.doesNotMatch(markdown, /R1l0d0PIsoluA1xcqQXc4AYFnpd/);
  assert.doesNotMatch(markdown, /EmSWd2RSBoLS6sx7A7IcblkUnTh/);
  assert.doesNotMatch(markdown, /愿景成/);
  assert.doesNotMatch(markdown, /search01\.shengcaiyoushu\.com/);
  assert.doesNotMatch(markdown, /^392$/m);
});

test("detects SCYS API rate limit responses", () => {
  assert.equal(isScysCourseApiRateLimited({ status: 1, message: "操作过于频繁，请稍后再试" }), true);
  assert.equal(isScysCourseApiRateLimited({ status: 0, message: "ok" }), false);
});
