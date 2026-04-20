const assert = require("node:assert/strict");
const {
  formatElapsedDuration,
  getCourseExportWorkerCount
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

test("recommends low-concurrency stable worker counts", () => {
  assert.equal(getCourseExportWorkerCount(0), 1);
  assert.equal(getCourseExportWorkerCount(8), 1);
  assert.equal(getCourseExportWorkerCount(24), 2);
  assert.equal(getCourseExportWorkerCount(96), 3);
});
