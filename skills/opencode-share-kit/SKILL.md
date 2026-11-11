---
name: opencode-share-kit
kind: runbook
review-by: 2027-06-30
description: "将 opencode 的自我进化/开发规范配置打包成可分享仓库（脱敏密钥 + 安装脚本 + README），并同步清理本地无效插件配置。Triggers: 分享, 打包, 分发, 给别人的 opencode, 自我进化系统, 开发规范系统, 分享配置, opencode 插件未加载, 脱敏"
---

# OpenCode 配置打包分享

<role>把本机的 opencode 全局配置（skills + AGENTS.md）整理成干净、可分享的 GitHub 仓库，并在打包前排查本地无效配置。</role>

## 步骤

1. **盘点现状**：列出 `~/.config/opencode/` 目录结构（skills/、AGENTS.md、opencode.json、agent-team/、*plugin*.jsonc 等）。
2. **排查插件是否真的加载**：
   - 检查 `plugin/` 目录是否存在（opencode 插件安装位置）；无则插件未装。
   - 检查 `node_modules/` 里是否有所声明插件的包。
   - 检查插件配置文件引用的 provider/model 在 `opencode.json` 是否真的定义（引用不存在的 provider = 死配置）。
   - 无效插件：删除 `opencode.json` 与 `tui.json` 里的 `"plugin": [...]` 声明，并可删插件 jsonc 与 agent-team/。
3. **定分享范围**：核心系统 = auto-skill-creator + white-bear-safe-rules + 质量/规范类技能 + AGENTS.md + INDEX.md + `check-rules.mjs` + `audit-docs.mjs` + `test/` + `git-hooks/` + `.gitattributes`（`npm test` = 规则体检 L1-L5 + 单测；git-hooks = 全局提交钩子）；领域专属技能（excel-vba、vbs 等）按需另打包。
4. **清理悬空引用**：共享版技能里对不一起分享的技能名/文件的引用要删掉（保留规则本身）。
5. **脱敏**：`opencode.json.example` 里所有 API Key 换占位符（`sk-`、`nvapi-`、`ctx7sk-` 全查），去掉真实 provider/baseURL；`env/`、`archive/`、`plans/` 是本机留档（`.gitignore` 已忽略），分享前确认包里没有它们。
6. **写 README**：目录结构、安装步骤（install.ps1 + macOS/Linux 手动拷贝）、自我进化原理、自定义说明。
7. **安全自检**：`rg -n "sk-[A-Za-z0-9]{20,}|nvapi-|ctx7sk-"` 全仓零命中才算完成。

## 关键命令 / 模式

- 安装脚本：`Copy-Item AGENTS.md` + `skills/` 到 `$HOME/.config/opencode/`，opencode.json 已存在则跳过不覆盖；`check-rules.mjs`、`audit-docs.mjs`、`test/`、`git-hooks/`、`.gitattributes` 一并拷贝（配合 `package.json` 的 `npm test`）。
- 全局提交钩子：安装 `git config --global core.hooksPath <配置目录>/git-hooks`；卸载 `git config --global --unset core.hooksPath`；仓库级 hooksPath（husky 等）优先，`--no-verify` 单次跳过。
- 分享后体检：`npm test`（规则体检 L1-L5 + 单测）与 `node audit-docs.mjs` 全 PASS 再发布。
- 插件未加载判定：`Test-Path plugin`、`Get-ChildItem node_modules -Filter "*oh-my*"`、`rg "my-provider" *.jsonc`。
- 密钥扫描：`rg -n "sk-[A-Za-z0-9]{20,}|nvapi-[A-Za-z0-9]{20,}|ctx7sk-[A-Za-z0-9]{20,}"`。

## Notes

- 分享仓库的 AGENTS.md/skills 是快照，与本地全局目录（含更多技能）不必完全一致。
- 千万别把含真实密钥的 `opencode.json` 提交进公开仓库；`.gitignore` 里加 `opencode.json`。