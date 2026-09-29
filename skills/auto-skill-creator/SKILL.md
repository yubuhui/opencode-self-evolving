---
name: auto-skill-creator
description: "Automatically create, update, and de-conflict skills from experience. Triggers: whenever you learn something reusable, solve a non-trivial problem, discover a pattern, identify a repeatable workflow, or finish a round of feature add/fix and need to sync stale/conflicting skills. Runs continuously in the background."
---

# Auto Skill Creator & Maintainer — Learn from Experience

You are an always-active meta-skill. Your job is to watch what the agent does, create reusable skills from its experiences, and keep existing skills in sync with the codebase (update stale ones, detect conflicts).

## When to Create a Skill

Create a new SKILL.md in `.opencode/skills/{name}/` when any of these happen:

| Trigger | Example |
|---------|---------|
| Solved a complex problem | Debugged a tricky concurrency issue |
| Discovered a reusable pattern | Found a consistent way to handle auth |
| Built a multi-step workflow | Manual steps that could be automated |
| Learned project-specific knowledge | Architecture decisions, conventions |
| Repeated a task 2+ times | Same commands/steps used again |
| Found a useful tool/command | A CLI trick or API pattern worth saving |

## Skill Format (template)

```markdown
---
name: {skill-name}
description: "One-line description of what this skill does. Triggers: {keywords that activate this skill}"
---

# {Skill Name}

<role>
What this skill does and when to use it.
</role>

## Steps

{Numbered or structured steps}

## Key Commands / Patterns

{Reusable commands, code snippets, or patterns}

## Notes / Pitfalls

{Things to watch out for, common mistakes}
```

## Skill Storage Convention

先判断你运行在哪个 agent 下，再按对应一行取路径。两个 agent 的技能目录都采用 `<名称>/SKILL.md` 目录式布局。

| agent | 项目级（默认） | 全局级 |
|-------|----------------|--------|
| OpenCode | `<project>/.opencode/skills/` | `~/.config/opencode/skills/` |
| DeepSeek Harness (DSH) | `<project>/.dsh/skills/` | `~/.dsh/skills/` |

- **默认项目级**：绝大多数技能建在这里，只对该项目生效。
- **全局级**：仅极少数通用技能放这里，对所有项目生效。
- DSH 加载器认两种形态：目录式 `{名称}/SKILL.md`，或根目录下的扁平 `{名称}.md`。
- DSH 要求 YAML frontmatter 同时具备 `name:` 与 `description:` 两个字段，两项齐备才生效，所以新建后务必回读确认。
- Naming: kebab-case, descriptive
- One skill per directory
- Keep it focused — one skill = one purpose

> 两个 agent 的**项目级目录互不相通**（DSH 读 `.dsh/skills/`，不读 `.opencode/skills/`）。要在两个 agent 下都生效的项目技能，需在两边各放一份，并保持内容同步。

### 全局 vs 项目级 分流规则（铁律）

- **默认项目级**：技能建在「学到它的当前项目」的项目级目录（按上表取当前 agent 的那一列）。项目专属的踩坑（某项目的库/构建链/脚本/产品特性）留在项目级。
- **提升到全局**仅当满足其一：
  - 通用纪律 / 红线 / 跨语言平台规则（如编码安全、质量底线、分阶段规范）
  - 已在 **2+ 个互不相干**的项目实际复用
- **恒全局**：元技能（auto-skill-creator 本身）与 always-on 纪律。
- **迁移**：发现全局目录里有项目专属技能时，移到对应项目的项目级目录，并同步全局 INDEX 与该项目 INDEX。
- **跨 agent 提升**：在 DSH 下提升全局技能时，按上表写入 `~/.dsh/skills/`；若该技能同时服务 OpenCode，再补一份到 `~/.config/opencode/skills/`，两处 INDEX.md 一并更新。
  - 本机 `~/.dsh/skills` 是指向 `~/.config/opencode/skills` 的目录联接（junction），两处实为同一份文件，写入一次即两边生效。执行前先确认该联接仍在，再决定是否需要补写。

## Auto-Indexing

After creating a skill, add it to the current agent's project-level `INDEX.md` (i.e. `<project>/.opencode/skills/INDEX.md` for OpenCode, `<project>/.dsh/skills/INDEX.md` for DSH):

```markdown
| Skill | Description |
|-------|-------------|
| {name} | {one-line description} |
```

全局库的 `INDEX.md` 同理维护（本机因目录联接，两侧为同一份文件）。

## When to Update an Existing Skill

Skills go stale when the codebase moves. After a round of feature add/fix, check whether existing skills match current reality — **not just whether a skill is missing**:

| Trigger | What to check |
|---------|---------------|
| Page/module/lib/route added, renamed, or deleted | AGENTS.md file listings + architecture skills (e.g. file-management-architecture, embedded-doc-editor) reference the new paths |
| Commands/build steps/ports/config changed | Skills recording them (offline-installer-build, lawyer-theme-color, headless-page-smoke-test) still accurate |
| Architecture/conventions/red lines changed | Corresponding skills + project AGENTS.md / AI-开发规范.md references |
| New pitfall/command/pattern learned | Even if no skill is stale, record it even when a similar skill already exists |

## Skill Update Workflow

1. List files/commands/architecture touched by this change.
2. `rg` the affected paths/commands across `skills/`, `AGENTS.md`, and project docs to find referencing skills.
3. For each hit, read the SKILL.md and update: content, `description` trigger keywords (add new ones), and `INDEX.md` row.
4. If it's a project skill, check the project AGENTS.md / AI-开发规范.md references too.
5. Keep INDEX.md in sync: every skill in `skills/` has a row, and every row points to an existing skill. Run `npm test` (runs `check-rules.mjs`) to auto-verify.

## Skill Conflict Detection

Beyond staleness, verify skills stay conflict-free with each other. Three levels:

| Level | Check | Method |
|-------|-------|--------|
| L1 索引一致性 | `skills/` dir ↔ INDEX.md bidirectional consistency (orphan/unregistered); AGENTS.md skill references exist | Automated: `npm test` runs `check-rules.mjs` (also checks white-bear rule-writing and mojibake) |
| L2 职责重叠 | Two skills cover same domain (overlapping description trigger keywords) | `rg` trigger keywords across descriptions, judge whether to merge/split; common hotspots: file/档案/预览, loading/动画, 编码/写文件, 样式/组件 |
| L3 指令矛盾 | One skill's red lines contradict another's (e.g. example uses a forbidden command) | `rg "禁止\|一律\|必须\|不得"` to extract red lines, manually scan for opposing pairs |

Known L3 hotspots and the correct resolution:
- 编码红线：示例命令一律用 Write/Edit 或 `[System.IO.File]::WriteAllText` 显式 UTF-8；被禁命令清单属检测信息，只在 `powershell-utf8-safety` 的「检测签名」节出现。`.vbs` 文件是明确豁免（须 GBK/ANSI）。
- 图标/样式：图标走项目统一方案，样式走共享样式/CSS 变量，emoji 不作图标、样式不内联（见 quality-baseline + 项目 AGENTS.md 前端样式规范）。

## 文档只写现状与踩坑（`docs-current-state-only`）

写技能 / 注释 / 规范时，一律只写**当前做法**；踩坑写成「曾经的坑 → 现修法」这种对当前代码仍有指导价值的形态。

| 写什么 | 例子 |
|--------|------|
| 当前行为、当前 API / 参数 | 「常规修改默认 `edit_docx_review` 留 Word 修订」 |
| 防回归的坑及其原因 | 「`--prop style=Heading1` 会静默失效 → 先查真实 styleId」 |
| 复发性高的旧事物，重点写「怎么防」 | 「该坑在换模板后可能复发，判定方法是回读 styleId」 |

**判定一句话**：这段文字对**当前代码**有没有操作或避坑价值？没有就删。

配对的正面写法：坑的写法统一落到「曾经的坑 → 现修法」这个句式上，把「旧版长什么样」的篇幅让给「现在怎么做」。

红线：已彻底删除的功能 / UI / 字段 / 命令，连同「旧版用 xx」「原来是…」「原实现…」这类墓碑描述一并删除（删除即删，不再留痕——留痕只增阅读成本与 token 消耗）。

## 红线兜底

- 全局目录只收通用纪律/红线/跨语言平台规则或已在 2+ 个互不相干项目复用的技能；项目专属技能留在项目级目录（污染全局会稀释所有项目上下文与触发精度）。
- 技能登记与目录保持一一对应：无孤儿技能（有目录无 INDEX 行）、无悬空条目（有 INDEX 行无目录）。
- 技能文件一律落在上表列出的标准目录内（OpenCode `.opencode/skills/` · `~/.config/opencode/skills/`；DSH `.dsh/skills/` · `~/.dsh/skills/`），两个 agent 各按自己那两列读写。
