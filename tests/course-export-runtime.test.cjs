const assert = require("node:assert/strict");
const {
  formatElapsedDuration,
  getCourseExportWorkerCount,
  getCourseExportExecutionProfile
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
