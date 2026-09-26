"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const CONNECTOR_ID = "coding-plan-usage";
const DEFAULT_BINARY = "arkcli";
const QUERY_ARGS = ["usage", "plan", "--product", "coding-plan", "--format", "json"];
const FALLBACK_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
const WINDOW_LABELS = {
  session: ["5h", "5 小时"],
  weekly: ["weekly", "每周"],
  monthly: ["monthly", "每月"]
};

module.exports = {
  setup() {
    return {
      providerAccountConnectors: [{ id: CONNECTOR_ID, resolve: resolveUsage }]
    };
  },
  __testing: { parseUsage, planSpawn, locateBinary, searchPath }
};

async function resolveUsage(request) {
  const options = isRecord(request.connector?.options) ? request.connector.options : {};
  const configuredBinary = typeof options.binary === "string" && options.binary.trim()
    ? options.binary.trim()
    : DEFAULT_BINARY;
  const pathForChild = searchPath();
  const binary = locateBinary(configuredBinary, pathForChild);
  const stdout = await runArkCli(binary, pathForChild);
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error("Ark CLI 未返回有效 JSON；请在终端运行 arkcli usage plan --product coding-plan 检查登录态。");
  }
  return parseUsage(payload);
}

function searchPath() {
  return [...new Set([
    ...(process.env.PATH || "").split(path.delimiter),
    ...FALLBACK_DIRS
  ].filter(Boolean))].join(path.delimiter);
}

function locateBinary(binary, pathForChild) {
  if (binary.includes(path.sep)) return binary;
  for (const dir of pathForChild.split(path.delimiter)) {
    const candidate = path.join(dir, binary);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Continue through the PATH before reporting the missing CLI.
    }
  }
  return binary;
}

// CCR 网关是受控 PATH 的 Electron 进程（无 /opt/homebrew/bin），带 node shebang 的
// CLI 直接 exec 会因 env 找不到解释器而失败；改用宿主运行时执行脚本本体。
function planSpawn(binary) {
  const base = { file: binary, args: [...QUERY_ARGS], env: {} };
  try {
    const real = fs.realpathSync(binary);
    const fd = fs.openSync(real, "r");
    try {
      const buf = Buffer.alloc(512);
      const { bytesRead } = fs.readSync(fd, buf, 0, 512, 0);
      const head = buf.toString("utf8", 0, bytesRead);
      if (!head.startsWith("#!")) return { ...base, file: real };
      if (!head.split("\n", 1)[0].includes("node")) return { ...base, file: real };
      return { file: process.execPath, args: [real, ...QUERY_ARGS], env: { ELECTRON_RUN_AS_NODE: "1" } };
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return base;
  }
}

function runArkCli(binary, pathForChild) {
  const plan = planSpawn(binary);
  const env = {
    ...process.env,
    NO_COLOR: "1",
    PATH: pathForChild,
    ...plan.env
  };
  return new Promise((resolve, reject) => {
    execFile(plan.file, plan.args, {
      encoding: "utf8",
      env,
      maxBuffer: 1024 * 1024,
      timeout: 30000
    }, (error, stdout) => {
      if (!error) {
        resolve(stdout);
      } else if (error.code === "ENOENT") {
        reject(new Error("未找到火山 Ark CLI，请安装 @volcengine/ark-cli 或检查连接器 options.binary。"));
      } else if (error.killed) {
        reject(new Error("查询火山 Coding Plan 用量超时。"));
      } else {
        reject(new Error(`Ark CLI 用量查询失败（exit ${error.code ?? "unknown"}）；请在终端运行 arkcli auth status 检查登录态。`));
      }
    });
  });
}

function parseUsage(payload) {
  if (payload?.error) {
    throw new Error("火山 Coding Plan 用量查询失败，请检查 Ark CLI 登录态及套餐权限。");
  }
  if (!Array.isArray(payload?.items)) {
    throw new Error("Ark CLI 用量响应缺少 items 列表，请检查 CLI 版本或返回格式。");
  }
  const items = payload.items;
  const personalItems = items.filter((entry) => entry?.product === "coding-plan" && entry?.edition !== "team");
  const item = personalItems.find((entry) => entry.subscribed !== false && !entry.error);
  if (!item && personalItems.some((entry) => entry.error)) {
    throw new Error("火山 Coding Plan 用量查询失败，请检查当前 Ark CLI 身份及套餐权限。");
  }
  if (!item) {
    return { meters: [], message: "当前身份下没有有效的个人版 Coding Plan 订阅。", status: "warning" };
  }
  const periods = Array.isArray(item.periods) ? item.periods : [];
  const meters = periods.map(mapPeriod).filter(Boolean);
  if (meters.length === 0) {
    throw new Error("火山 Coding Plan 没有返回可识别的用量窗口。");
  }
  const lowestRemaining = Math.min(...meters.map((meter) => meter.remaining));
  return {
    meters,
    message: "火山 Coding Plan（官方 Ark CLI）",
    status: lowestRemaining <= 5 ? "critical" : lowestRemaining <= 20 ? "warning" : "ok"
  };
}

function mapPeriod(period) {
  if (!isRecord(period)) return undefined;
  const window = WINDOW_LABELS[period.label];
  const percent = period.percent;
  if (typeof percent !== "number" && (typeof percent !== "string" || percent.trim() === "")) {
    return undefined;
  }
  const used = Number(percent);
  if (!window || !Number.isFinite(used) || used < 0 || used > 100) return undefined;
  const reset = period.reset_at ? new Date(period.reset_at) : undefined;
  return {
    id: `volcengine_coding_plan_${period.label}`,
    kind: "subscription",
    label: window[1],
    limit: 100,
    remaining: Math.round((100 - used) * 10) / 10,
    ...(reset && !Number.isNaN(reset.getTime()) ? { resetAt: reset.toISOString() } : {}),
    unit: "%",
    used: Math.round(used * 10) / 10,
    window: window[0]
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
