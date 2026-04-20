const assert = require("node:assert/strict");
const storage = require("../shared/obsidian-vault-storage.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("ensureVaultPermission reuses granted permission without prompting", async () => {
  let requestCount = 0;
  const handle = {
    async queryPermission() {
      return "granted";
    },
    async requestPermission() {
      requestCount += 1;
      return "granted";
    }
  };

  const permission = await storage.ensureVaultPermission(handle, "readwrite");
  assert.equal(permission, "granted");
  assert.equal(requestCount, 0);
});

test("ensureVaultPermission requests permission when current page falls back to prompt", async () => {
  let requestCount = 0;
  const handle = {
    async queryPermission() {
      return "prompt";
    },
    async requestPermission() {
      requestCount += 1;
      return "granted";
    }
  };

  const permission = await storage.ensureVaultPermission(handle, "readwrite");
  assert.equal(permission, "granted");
  assert.equal(requestCount, 1);
});

test("writeTextFiles fails with a clear reauthorization message when permission stays denied", async () => {
  const handle = {
    async queryPermission() {
      return "denied";
    },
    async requestPermission() {
      return "denied";
    }
  };

  await assert.rejects(
    () => storage.writeTextFiles(handle, [{ path: "foo.md", content: "bar" }]),
    /Obsidian 目标目录当前不可写/
  );
});
