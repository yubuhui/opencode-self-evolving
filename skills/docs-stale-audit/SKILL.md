---
name: docs-stale-audit
description: "文档/技能改动后的墓碑描述审计闭环：audit-docs.mjs 的 --changed/--staged 用法、高置信与复查候选判级、docs-audit:allow 豁免、修复流程、git 钩子拦截。Triggers: 文档审计, 墓碑描述, 改动后审计, 过时描述, audit-docs, --changed, --staged, 复查候选, docs-audit:allow, 钩子拦截"
---

# 文档墓碑描述审计（docs-current-state-only 闭环）

<role>
回答「改动后怎么确认文档只写现状」：跑审计 → 看判级 → 修文档 → 进完成报告。与 AGENTS.md 的 docs-current-state-only 规则配套，把写前引导延伸为写后检查。
</role>

## 边界职责

- `auto-skill-creator`：技能的创建/更新/同步/冲突检查流程。
- `powershell-utf8-safety`：写文件编码安全。
- 本技能：文档正文的墓碑描述审计（命令、判级、豁免、修复）。

## 何时跑

- 功能/修复收尾、文档或技能改动后、提交前（完成门禁的一部分）。
- 项目内只覆盖本次改动：`node ~/.dsh/rules/audit-docs.mjs --changed`
- 共享规则库全量：`node ~/.dsh/rules/check-rules.mjs` 与 `node ~/.dsh/rules/audit-docs.mjs`（DSH 经 `~/.dsh/rules` 目录联接访问，OpenCode 直接用 `~/.config/opencode/`，同一份实体）

## 判级速查

| 级别 | 典型线索 | 处理 |
| --- | --- | --- |
| 高置信（退出码 1） | `旧版`、`原实现`、`以前是`、`曾是`、`不再支持`、`已移除`、`previously`、`used to`、`no longer` | 删除；或改写成「曾经的坑 → 现修法」；确需引用时行内加 `docs-audit:allow` |
| 复查候选（仅提示） | `曾经`、`以前`、`旧版本`、`已删除`、`原本`、`重命名`、`deprecated` | 人工判断：复发性坑写成「怎么防」保留；纯历史叙述删除 |
| 允许形式 | 同一行同时含「曾经的坑/复发/防回归」与「→/现修法/怎么防/判定方法」 | 无需处理 |
| 行内豁免 | `docs-audit:allow` | 规则词汇表、迁移说明等确需提及旧形态的场合 |

细节：围栏代码块与行内代码不参与扫描；引号内的高置信词自动降级为候选；`--json` 输出 `{ mode, scanned, high, candidates, allowed, warnings }`。

## 修复三步

1. **高置信命中**：优先删除墓碑句；该坑可能复发时改写为「曾经的坑 → 现修法」，把篇幅给「现在怎么做」。
2. **复查候选**：逐条判断对当前代码有无操作/避坑价值——有（复发性坑）就写「怎么防」，没有就删。
3. **确需保留旧形态词汇**（词表、迁移说明）：行内加 `docs-audit:allow`，并在完成报告中说明理由。

## git 钩子（全局安装）

- 本机 `core.hooksPath` 指向配置库 `git-hooks/`，每次 `git commit` 自动对暂存区文档跑 `audit-docs.mjs --staged`；配置库内提交加跑 `check-rules.mjs` 全套。
- 安装：`git config --global core.hooksPath <规则库>/git-hooks`（本机 DSH `$env:USERPROFILE\.dsh\rules\git-hooks`；OpenCode `~/.config/opencode/git-hooks`，同一份）
- 卸载：`git config --global --unset core.hooksPath`
- 仓库级 `core.hooksPath`（如 husky）优先于全局；`--no-verify` 为单次逃生口。
- 误报需要放行时，用行内 `docs-audit:allow`；全局卸载留给钩子故障等例外。

## 完成前门禁

- 高置信命中清零后，再声明完成/提交（候选允许存在，但要在完成报告里写「已逐条判断」）。
- 结果写进完成报告「实际」列：`文档审计：N 高置信→0，M 候选已判断`。

## 红线兜底

- 高置信命中处理完再提交；`git commit --no-verify` 只留给钩子故障等例外场景，使用后须在回复中说明。
