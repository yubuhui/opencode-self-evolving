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

- Location: `.opencode/skills/{skill-name}/SKILL.md`
- Naming: kebab-case, descriptive
- One skill per directory
- Keep it focused — one skill = one purpose

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
5. Never leave an unregistered skill (INDEX missing) or a registered-but-missing skill.

## Skill Conflict Detection

Beyond staleness, verify skills don't conflict with each other. Three levels:

| Level | Check | Method |
|-------|-------|--------|
| L1 索引一致性 | `skills/` dir ↔ INDEX.md bidirectional consistency (orphan/unregistered); AGENTS.md skill references exist | Automated: `test/skill-index.test.mjs` (runs in `npm test`) |
| L2 职责重叠 | Two skills cover same domain (overlapping description trigger keywords) | `rg` trigger keywords across descriptions, judge whether to merge/split; common hotspots: file/档案/预览, loading/动画, 编码/写文件, 样式/组件 |
| L3 指令矛盾 | One skill's red lines contradict another's (e.g. example uses a forbidden command) | `rg "禁止\|一律\|必须\|不得"` to extract red lines, manually scan for opposing pairs |

Known L3 hotspots and the correct resolution:
- 编码红线：example commands must use Write/Edit or `[System.IO.File]::WriteAllText`, never `Set-Content`/`Out-File`/`>` (see powershell-utf8-safety). `.vbs` files are the explicit exception (must be GBK/ANSI, see vbs-launch-script-debug).
- 图标/样式：no emoji icons, no icon+text mixing, no inline style / hardcoded color (see quality-baseline + project AGENTS.md 前端样式规范).
