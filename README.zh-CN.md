<div align="center">

# ccr-volcengine-coding-plan-usage

**Claude Code Router 的火山引擎 Coding Plan 用量插件**

把火山引擎 Coding Plan 的 5 小时 / 每周 / 每月余量，显示在 [Claude Code Router](https://github.com/musistudio/claude-code-router) 的 `ark` 供应商账户用量卡片中。

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![CI](https://github.com/jiaquanchou/ccr-volcengine-coding-plan-usage/actions/workflows/test.yml/badge.svg)](https://github.com/jiaquanchou/ccr-volcengine-coding-plan-usage/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/github/license/jiaquanchou/ccr-volcengine-coding-plan-usage)](./LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)
![CCR](https://img.shields.io/badge/CCR-3.1.1%2B-blue)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff4f8b)

<img src="docs/usage-card.png" width="380" alt="ark 供应商账户用量卡片：5 小时 / 每周 / 每月余量" />

</div>

本项目是社区插件，不隶属于火山引擎或 Claude Code Router。插件调用本机官方 **Ark CLI**，自身不保存任何 Key 或登录态。

## 功能

- **三个用量窗口**——5 小时、每周、每月——在一张卡片上显示剩余百分比与重置时间；
- **状态配色**——`ok`、`warning`（最低窗口 ≤ 20%）、`critical`（≤ 5%）；
- **不经手凭据**——认证完全由官方 Ark CLI 的本机登录管理，插件只读取其 JSON 输出；
- **零 npm 依赖**——仅用 Node 内置模块，6 条单元测试；
- **兼容 CCR 的 Electron 网关**——自动适配 CCR 的受限 PATH 环境（见[工作原理](#工作原理)）。

## 环境要求

- [Claude Code Router](https://github.com/musistudio/claude-code-router) 桌面版 **3.1.1+**（支持 provider surface 插件与 `provider-account-connectors` 权限）；
- 安装并登录火山官方 CLI：

  ```bash
  CI=1 npm install -g @volcengine/ark-cli   # CI=1 跳过自动安装 Agent Skills
  arkcli auth login volc-sso
  arkcli auth status                                    # 确认登录态
  arkcli usage plan --product coding-plan --format json # 确认可查询
  ```

## 快速开始

1. 把仓库克隆到本机任意位置：

   ```bash
   git clone https://github.com/jiaquanchou/ccr-volcengine-coding-plan-usage.git
   ```

2. 在 CCR 的「扩展」中安装克隆出的目录，启用插件，然后**完整退出、重新打开 CCR**；
3. 编辑 `ark` 供应商：勾选「获取用量」，将「用量模式」设为「原始连接器 JSON」，填入：

   ```json
   [
     {
       "type": "plugin",
       "pluginId": "volcengine-coding-plan-usage",
       "connectorId": "coding-plan-usage"
     }
   ]
   ```

4. 保存后刷新供应商账户用量，卡片应显示全部三个窗口。

若 `arkcli` 在默认搜索路径之外，在连接器对象中增加 `"options": { "binary": "/arkcli 的绝对路径" }`。

## 工作原理

```text
CCR 网关（Electron，受限 PATH）
  └─ 插件连接器 resolve
      └─ 通过 PATH 与常见安装目录定位 arkcli（/opt/homebrew/bin、/usr/local/bin 等）
          └─ node shebang 脚本 → 用宿主运行时执行（ELECTRON_RUN_AS_NODE=1）
              └─ arkcli usage plan --product coding-plan --format json
```

### PATH 受限的坑

CCR 网关是 GUI 进程，`PATH` 被刻意收窄（只有应用自身 bin 与系统目录，没有 `/opt/homebrew/bin`）。`arkcli` 是带 `#!/usr/bin/env node` shebang 的 Node 脚本，网关里直接 exec 会因找不到 node 而 exit 127——表现为**终端查询一切正常、界面查询必挂**。

插件对此自动处理：先经 `PATH` 与常见安装目录定位 CLI；发现目标是 Node 脚本时，改用网关自己的运行时（`process.execPath` + `ELECTRON_RUN_AS_NODE=1`）执行脚本本体，不依赖 `env node`。

## 更新已安装的插件

仓库目录是源码，CCR 扩展目录是运行副本。拉取更新后同步：

```bash
./install.sh --dry-run   # 预演
./install.sh             # 同步 index.cjs 与 plugin.json，留下带时间戳的备份
```

然后完整退出并重新打开 CCR。

## 开发

```bash
node --test test.cjs
```

| 文件 | 用途 |
| --- | --- |
| `index.cjs` | 连接器：CLI 定位、spawn 策略、用量解析 |
| `test.cjs` | 用量解析与 spawn 策略的单元测试 |
| `install.sh` | 把源码同步到 CCR 扩展目录 |
| `plugin.json` | 插件清单（id、surfaces、permissions） |

## 兼容性

已在 **macOS · CCR 3.1.1 · `@volcengine/ark-cli` 1.0.36**（个人版 Coding Plan）实测。Linux 可经 `PATH` 或 `options.binary` 指定 CLI，但尚未实机验证——欢迎反馈。团队版套餐会被过滤，仅显示个人版。

## FAQ

**卡片显示「Ark CLI 用量查询失败」怎么办？**
先在终端运行 `arkcli auth status` 查登录态，再运行 `arkcli usage plan --product coding-plan --format json` 查询本身。卡片报错带 exit code——`127` 通常是 CLI 或 Node.js 运行时未找到，而非登录失效。

**我的凭据存在哪里？**
在你本机 Ark CLI 自己的配置里。插件不读取、不存储、不传输任何 Key 或 Token。

**会消耗套餐额度吗？**
不会。用量查询走 Ark CLI 的管理接口，不经过模型推理端点。

## 参考资料

- [CCR 扩展配置](https://github.com/musistudio/claude-code-router/blob/75e9e750c134acc389eab00bc131c6cd625ba614/docs/src/content/docs/zh/configuration/extensions.md)
- [CCR 供应商用量连接器](https://github.com/musistudio/claude-code-router/blob/75e9e750c134acc389eab00bc131c6cd625ba614/docs/src/content/docs/zh/configuration/providers.md)
- [Ark CLI 用量查询参考](https://github.com/volcengine/ark-cli/blob/daa24759793f6db7c888bf5bdb61990e0c8e249b/skills/arkcli-usage/references/arkcli-usage-plan.md)

## 参与贡献

欢迎 Issue 与 PR；提交前请运行 `node --test test.cjs`。

## License

[MIT](./LICENSE)
