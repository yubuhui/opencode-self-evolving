---
name: auto-skill-creator
kind: discipline
description: "任务内自我进化：把已验证、会复发的做法沉淀为 DSH 技能，更新过时条目并保持技能库精简。Triggers: 自我进化, 沉淀技能, 创建技能, 更新技能, 技能过时, 技能冲突, 技能合并, 技能库维护, 记录踩坑, 复用经验, DSH 技能, .dsh/skills"
---

# 技能沉淀与维护（DSH 优先）

<role>
把一次任务里验证过的做法变成下次可直接复用的技能，并让已有技能与当前代码保持同步。默认在一次任务内完成：任务结束前判断一次，有变更才落盘。
</role>

## 何时写

以下三条同时满足才写：

1. **已验证**：做法实际跑通，或坑已复现并修复；有命令、输出或数据可复核。
2. **会复发**：同类任务、同类项目或同类平台问题还会再遇到。
3. **未覆盖**：在技能库搜索后确认没有技能覆盖同一主题；已有相关技能就更新它。

一次性任务、未验证推测、只对当前对话有意义的上下文留在交付说明里，不进技能库。

## 分类与落点

先判**知识形态**（它是什么），再判**作用域**（放哪）。形态决定该不该写成技能、预算多少、是否过期；作用域只决定放共享库还是项目根。

| kind | 中文 | 判据（它是什么） | 落点 | 预算 / 生命周期 |
| --- | --- | --- | --- | --- |
| `discipline` | 行为纪律 | 恒真的做事方式：流程、写作语法、质量、测试、计划、审计 | 共享库 `skills/` | ≤180 字符 / ≤12 关键词；常驻；不过期；全库上限 8 条 |
| `runbook` | 操作规程 | 某类任务的可复用步骤：工具/平台坑、外部系统抓取、发布流程 | 共享库或项目 `skills/` | ≤240 / ≤15；常驻；必填 `review-by` |
| `domain` | 领域契约 | 某项目/业务的契约、结构、模块与页面导航 | 项目 `.dsh/skills` | ≤320 / ≤25；常驻；必填 `review-by` |
| `inventory` | 环境档案 | 某台机器/某环境的现状事实：版本、账户、落点、已装状态 | `<库>/env/<host-slug>.md`，**不是技能** | 不进 catalog；必填 `host` / `updated` / `review-by` |
| 一次性 | — | 只在本次任务成立、未验证或不会复发 | 留在回复 | — |

判断顺序：① 它教 agent 怎么干活、跨项目恒真吗（是→ `discipline`）；② 它是某类任务的办事步骤吗（是→ `runbook`）；③ 它只是本机/本环境现状吗（是→ `inventory` 档案）；④ 它是某项目的契约/结构吗（是→ `domain`）；都不符合就留在回复。方法细节写所属技能的 `references/*.md`，不单独建技能。`discipline` 维持上限 8 条：新增前先合并或归档一条。

## 写哪里（DSH 发现顺序）

| 位置 | 路径 | 优先级 | 用途 |
| --- | --- | --- | --- |
| 项目 DSH | `<项目根>/.dsh/skills/<name>/SKILL.md` | 1 | 默认；项目专属知识 |
| 项目共享 | `<项目根>/.agents/skills/` | 2 | 跨 agent 的项目技能 |
| 用户共享库 | `~/.config/opencode/skills/<name>/SKILL.md` | 3 | 跨项目通用流程/平台规则（DSH 经 `dsh-library-skills` 读取） |
| 用户共享 | `~/.agents/skills/` | 5 | 其他 agent 安装的技能 |

- 项目根 = 最近的 `.git` 祖先目录；没有 `.git` 的临时目录以当前工作目录为根。
- 同名技能按上表优先级取第一个。
- 共享库在 `~/.config/opencode/skills`：OpenCode 直接读取，DSH 由 `dsh-library-skills` 插件注册为技能源；写一次两边生效。
- DSH 项目级技能无需 `INDEX.md`；共享规则库（实体在 `~/.config/opencode/`）为 OpenCode 与 `check-rules` 维护 INDEX。
- OpenCode 对应路径：项目 `<根>/.opencode/skills/`、用户 `~/.config/opencode/skills/`；两个 agent 的项目级目录互不相通，需要双端生效时各放一份。

## 怎么写

frontmatter 必填三项，`runbook` / `domain` 再加一项：

- `name`：kebab-case，与目录名一致。
- `description`：**单行 + 双引号**，一句话说明 + `Triggers:` 段；DSH 只用它匹配，多行 YAML 会让整条技能被跳过。
- `kind`：`discipline` / `runbook` / `domain`（环境事实用 `inventory` 写 `env/` 档案，不建技能）。
- `review-by`：`runbook` / `domain` 必填，格式 `yyyy-mm-dd`，到期进「候选归档」。

description 预算（字符 = 整串含 `Triggers:`；关键词 = 触发段按逗号切分的项数）：`discipline` ≤180/≤12，`runbook` ≤240/≤15，`domain` ≤320/≤25；触发段名统一写 `Triggers:`。预算与取值由 `check-rules.mjs` 的 L5 把关。

可选字段：`whenToUse`（补充适用时机）、`disable-model-invocation: true`（仅用户可调用）、`user-invocable: false`（仅模型可调用）。缺必填字段或名称不合法会被 DSH 跳过。

正文模板：

```markdown
# 名称

<role>一句话：解决什么问题、何时使用</role>

## 适用条件

## 步骤 / 命令

## 失败征兆与处理

## 验证方法
```

- 写真实命令、路径、参数与预期输出；内容对准当前实现。
- 表述遵循 `white-bear-safe-rules`：正面动作在前，被禁对象与检测签名集中在「检测签名」或「红线兜底」节。
- 正文控制在一次能读完的长度；长细节放技能目录下的 `references/*.md`，正文按需指向。

## 维护已有技能

按改动触发检查，不例行全量扫描：

- 技能里记录的文件、命令、配置、端口或架构发生变化。
- 新发现推翻了技能里的做法。
- 两个技能职责重叠：保留更通用的一个，另一个并入或改写成指向它；`check-rules` 的 L6 会列出触发词交集 ≥2 的候选（提醒、不阻断），据此人工判定。
- 红线段落疑似相斥：`check-rules` 的 L7 会列出同一标识符在红线节一正一反的候选（提醒、不阻断），据此人工统一口径。
- 技能描述与内容不符：同步 `description` 与 INDEX 行（INDEX 的 Kind 列与 frontmatter 保持一致）。
- 方法细节有增补：写进所属总控技能的 `references/*.md`（如界面验证 → `test-verification/references/ui-verification.md`），保持技能目录数量稳定。

**生命周期与归档**：`review-by` 到期时 `check-rules` 报「候选归档」，由人确认后执行——技能目录移到 `<库>/archive/<name>/`（在 `skills/` 之外，天然不被扫描）、从 `skills/INDEX.md` 删掉该行、在 `<库>/archive/INDEX.md` 记一行（名称 / 退役日期 / 原因）。`env/` 档案到期时更新字段与内容。

流程/元技能保持精简：新增前先找可合并项，合并或删除过时项后再新增；`discipline` 满 8 条时先置换；领域技能按真实经验增长。

## 写完检查

1. 回读 frontmatter 与正文：`name` 与目录一致、`kind` 与 `review-by` 齐全、`description` 单行且入预算、中文无乱码。
2. 运行规则体检：`node ~/.dsh/rules/check-rules.mjs`（DSH 经 `~/.dsh/rules` 联接访问；OpenCode 用 `~/.config/opencode/check-rules.mjs`）；项目技能跑 `node scripts/case-skills-check.js`。
3. 改动共享规则库时同步 `skills/INDEX.md`（含 Kind 列），再跑 `node ~/.dsh/rules/audit-docs.mjs --changed`。

## 红线兜底

- 未验证、不可复现或只对当前对话有意义的内容留在回复里，不写成技能。
- 技能写入前先搜索同名与同主题条目，避免重复与互相矛盾的指令。
- 共享规则库的 INDEX 与目录保持一一对应；项目级 DSH 技能不需要 INDEX。
