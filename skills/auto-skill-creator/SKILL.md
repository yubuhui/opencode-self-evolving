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

- 默认位置（**项目级**）：`<project>/.opencode/skills/{skill-name}/SKILL.md` — 绝大多数技能放这里，只对该项目生效。
- 全局位置：`~/.config/opencode/skills/{skill-name}/SKILL.md` — 仅极少数通用技能放这里，对所有项目生效。
- Naming: kebab-case, descriptive
- One skill per directory
- Keep it focused — one skill = one purpose

### 全局 vs 项目级 分流规则（铁律）

- **默认项目级**：技能建在「学到它的当前项目」`.opencode/skills/`。项目专属的踩坑（某项目的库/构建链/脚本/产品特性）留在项目级 `.opencode/skills/`。
- **提升到全局**仅当满足其一：
  - 通用纪律 / 红线 / 跨语言平台规则（如编码安全、质量底线、分阶段规范）
  - 已在 **2+ 个互不相干**的项目实际复用
- **恒全局**：元技能（auto-skill-creator 本身）与 always-on 纪律。
- **迁移**：发现全局目录里有项目专属技能时，移到对应项目 `.opencode/skills/`，并同步全局 INDEX 与该项目 INDEX。

## Auto-Indexing

After creating a skill, add it to `.opencode/skills/INDEX.md`:

```markdown
| Skill | Description |
|-------|-------------|
| {name} | {one-line description} |
```

## When to Update an Existing Skill

Skills go stale when the codebase moves. After a round of feature add/fix, check whether existing skills match current reality — **not just whether a skill is missing**:

| Trigger | What to check |
|---------|---------------|
| Page/module/lib/route added, renamed, or deleted | AGENTS.md file listings + architecture skills (e.g. file-management-architecture, embedded-doc-editor) reference the new paths |
| Commands/build steps/ports/config changed | Skills recording them (offline-installer-build, lawyer-theme-color, headless-page-smoke-test) still accurate |
| Architecture/conventions/red lines changed | Corresponding skills + project AGENTS.md / AI-开发规范.md references |
| New pitfall/command/pattern learned | Even if no skill is stale, record it (don't skip because "skill exists") |

## Skill Update Workflow

1. List files/commands/architecture touched by this change.
2. `rg` the affected paths/commands across `skills/`, `AGENTS.md`, and project docs to find referencing skills.
3. For each hit, read the SKILL.md and update: content, `description` trigger keywords (add new ones), and `INDEX.md` row.
4. If it's a project skill, check the project AGENTS.md / AI-开发规范.md references too.
5. Keep INDEX.md in sync: every skill in `skills/` has a row, and every row points to an existing skill. Run `npm test` (runs `check-rules.mjs`) to auto-verify.

## Skill Conflict Detection

Beyond staleness, verify skills don't conflict with each other. Three levels:

| Level | Check | Method |
|-------|-------|--------|
| L1 索引一致性 | `skills/` dir ↔ INDEX.md bidirectional consistency (orphan/unregistered); AGENTS.md skill references exist | Automated: `npm test` runs `check-rules.mjs` (also checks white-bear rule-writing and mojibake) |
| L2 职责重叠 | Two skills cover same domain (overlapping description trigger keywords) | `rg` trigger keywords across descriptions, judge whether to merge/split; common hotspots: file/档案/预览, loading/动画, 编码/写文件, 样式/组件 |
| L3 指令矛盾 | One skill's red lines contradict another's (e.g. example uses a forbidden command) | `rg "禁止\|一律\|必须\|不得"` to extract red lines, manually scan for opposing pairs |

Known L3 hotspots and the correct resolution:
- 编码红线：示例命令一律用 Write/Edit 或 `[System.IO.File]::WriteAllText` 显式 UTF-8；被禁命令清单属检测信息，只在 `powershell-utf8-safety` 的「检测签名」节出现。`.vbs` 文件是明确豁免（须 GBK/ANSI）。
- 图标/样式：图标走项目统一方案，样式走共享样式/CSS 变量，emoji 不作图标、样式不内联（见 quality-baseline + 项目 AGENTS.md 前端样式规范）。

## 红线兜底

- 全局目录只收通用纪律/红线/跨语言平台规则或已在 2+ 个互不相干项目复用的技能；项目专属技能留在项目级 `.opencode/skills/`（污染全局会稀释所有项目上下文与触发精度）。
- 技能登记与目录保持一一对应：无孤儿技能（有目录无 INDEX 行）、无悬空条目（有 INDEX 行无目录）。
