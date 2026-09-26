"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { __testing } = require("./index.cjs");

test("maps official Coding Plan percentages to three remaining quota windows", () => {
  const result = __testing.parseUsage({
    items: [{
      product: "coding-plan",
      edition: "personal",
      subscribed: true,
      periods: [
        { label: "session", percent: 15, reset_at: "2026-09-26T12:00:00+08:00" },
        { label: "weekly", percent: 80, reset_at: "2026-09-29T00:00:00+08:00" },
        { label: "monthly", percent: 35, reset_at: "2026-10-01T00:00:00+08:00" }
      ]
    }]
  });
  assert.equal(result.meters.length, 3);
  assert.deepEqual(result.meters.map((meter) => meter.remaining), [85, 20, 65]);
  assert.deepEqual(result.meters.map((meter) => meter.window), ["5h", "weekly", "monthly"]);
  assert.equal(result.status, "warning");
  assert.equal(result.meters[0].resetAt, "2026-09-26T04:00:00.000Z");
});

test("rejects missing plan and malformed percentages", () => {
  const missing = __testing.parseUsage({ items: [] });
  assert.equal(missing.status, "warning");
  assert.equal(missing.meters.length, 0);
  for (const percent of [null, "", "  ", 150]) {
    assert.throws(() => __testing.parseUsage({
      items: [{ product: "coding-plan", subscribed: true, periods: [{ label: "session", percent }] }]
    }), /没有返回可识别/);
  }
});

test("reports API errors before treating a plan as unsubscribed", () => {
  assert.throws(() => __testing.parseUsage({ error: { code: "failed" }, items: [] }), /查询失败/);
  assert.throws(() => __testing.parseUsage({}), /缺少 items/);
  assert.throws(() => __testing.parseUsage({
    items: [{ product: "coding-plan", subscribed: false, error: { code: "failed" } }]
  }), /查询失败/);
  const result = __testing.parseUsage({
    items: [
      { product: "coding-plan", subscribed: false },
      { product: "coding-plan", subscribed: true, periods: [{ label: "session", percent: 25 }] }
    ]
  });
  assert.equal(result.meters[0].remaining, 75);
});

test("locates Ark CLI through PATH without a machine-specific default", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ark-plugin-path-test-"));
  try {
    const binary = path.join(dir, "arkcli");
    fs.writeFileSync(binary, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    assert.equal(__testing.locateBinary("arkcli", dir), binary);
    assert.equal(__testing.locateBinary(binary, "/nonexistent"), binary);
    assert.equal(__testing.locateBinary("missing-arkcli", dir), "missing-arkcli");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rounds usage and remaining quota to one decimal place", () => {
  const result = __testing.parseUsage({
    items: [{
      product: "coding-plan", subscribed: true,
      periods: [{ label: "weekly", percent: 53.456974 }]
    }]
  });
  assert.equal(result.meters[0].used, 53.5);
  assert.equal(result.meters[0].remaining, 46.5);
});

test("spawns node-shebang CLI through the host runtime", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ark-plugin-test-"));
  try {
    const nodeCli = path.join(dir, "fake-arkcli");
    fs.writeFileSync(nodeCli, "#!/usr/bin/env node\nconsole.log('hi');\n");
    fs.chmodSync(nodeCli, 0o755);
    const plan = __testing.planSpawn(nodeCli);
    assert.equal(plan.file, process.execPath);
    assert.ok(plan.args[0].endsWith("fake-arkcli"));
    assert.equal(plan.env.ELECTRON_RUN_AS_NODE, "1");

    const shellCli = path.join(dir, "plain.sh");
    fs.writeFileSync(shellCli, "#!/bin/sh\necho hi\n");
    fs.chmodSync(shellCli, 0o755);
    const shellPlan = __testing.planSpawn(shellCli);
    assert.equal(shellPlan.file, fs.realpathSync(shellCli));
    assert.deepEqual(shellPlan.env, {});

    const missingPlan = __testing.planSpawn(path.join(dir, "missing"));
    assert.equal(missingPlan.file, path.join(dir, "missing"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
