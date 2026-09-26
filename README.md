# CCR 火山 Coding Plan 用量插件

将火山 Coding Plan 的 5 小时、每周、每月余量显示在 Claude Code Router（CCR）的 `ark` 供应商账户用量中。插件调用火山官方 Ark CLI；认证信息由 Ark CLI 在本机管理，插件源码不保存 Key 或登录态。本项目是社区插件，不隶属于火山引擎或 CCR。

已在 macOS、CCR 3.1.1、`@volcengine/ark-cli` 1.0.36 上实测。Linux 可通过 `PATH` 或 `options.binary` 指定 CLI，但尚未实机验证。

## 获取代码

```bash
git clone https://github.com/jiaquanchou/ccr-volcengine-coding-plan-usage.git
```

下文中的「本目录」均指克隆出的仓库目录。

## 依赖与安装

1. 安装官方 CLI：`CI=1 npm install -g @volcengine/ark-cli`。`CI=1` 使其安装脚本只安装 CLI，避免默认向其他 Agent 自动安装 Skills；如需这些 Skills，可按 Ark CLI 官方文档单独安装。
2. 在本机完成登录：`arkcli auth login volc-sso`；用 `arkcli auth status` 检查状态，并用 `arkcli usage plan --product coding-plan --format json` 验证套餐可查询。
3. 在 CCR 的“扩展”中安装**本目录**，启用插件并**完整退出、重新打开 CCR**。
4. 编辑 `ark` 供应商，勾选“获取用量”，将“用量模式”设为“原始连接器 JSON”，填写：

   ```json
   [
     {
       "type": "plugin",
       "pluginId": "volcengine-coding-plan-usage",
       "connectorId": "coding-plan-usage"
     }
   ]
   ```

5. 保存后刷新供应商账户用量。插件会搜索 CCR 进程的 `PATH`，并补查 `/opt/homebrew/bin`、`/usr/local/bin` 等常见目录。若 CLI 在其他位置，在连接器对象中增加 `"options": { "binary": "<arkcli 的绝对路径>" }`。

## 更新已安装的插件

仓库中的本目录是源码，CCR 扩展目录是运行副本。更新源码后，在本目录执行：

```sh
./install.sh --dry-run
./install.sh
```

脚本仅同步 `index.cjs` 和 `plugin.json`；文件内容改变时会在运行目录留下带时间戳的备份。它不会编辑 CCR 的 SQLite 配置、启用插件或修改供应商。同步后**完整退出并重新打开 CCR**，确认 `ark` 余量刷新。

## 验证与维护

- 单元测试：在本目录执行 `node --test test.cjs`。
- 真实查询：运行上面的 `arkcli usage plan` 命令；输出可能包含账户信息，不要贴进仓库或公开日志。
- 未登录、套餐不可用或 CLI 路径错误时，CCR 会显示查询错误或无可用额度。API 查询出错会优先报错，不会误提示为未订阅。
- 用量与余量显示到 1 位小数；火山返回空值或无效百分比时，该窗口不显示为 100% 余量。
- **GUI 网关 PATH 受限**（2026-09-26 实测）：插件在 `PATH` 中定位 CLI；遇到 node shebang 时使用宿主运行时执行脚本本体，避免 Electron 网关找不到 `node`。

## 权限与许可

CCR 需要授予本插件 `trusted-code` 和 `provider-account-connectors` 权限。插件只在本机执行 Ark CLI 的只读用量查询；火山账户登录由官方 CLI 管理。请勿将 CLI 查询结果、Key、Cookie 或登录状态提交到仓库。

源码采用 [MIT License](LICENSE)。开源发布前应复核所用 CCR 和 Ark CLI 版本的兼容性；本插件不包含二者的源码。

## 参考资料

- [CCR 扩展配置](https://github.com/musistudio/claude-code-router/blob/75e9e750c134acc389eab00bc131c6cd625ba614/docs/src/content/docs/zh/configuration/extensions.md)
- [CCR 供应商用量连接器](https://github.com/musistudio/claude-code-router/blob/75e9e750c134acc389eab00bc131c6cd625ba614/docs/src/content/docs/zh/configuration/providers.md)
- [Ark CLI Coding Plan 用量查询](https://github.com/volcengine/ark-cli/blob/daa24759793f6db7c888bf5bdb61990e0c8e249b/skills/arkcli-usage/references/arkcli-usage-plan.md)

配置变更：CCR 的 `ark` 用量模式改为插件连接器；漏配或未启动插件时无法显示套餐余量。现有模型请求的 API Key 与路由配置不需要修改。
