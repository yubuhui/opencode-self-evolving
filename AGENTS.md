<!-- auto-skill-creator -->
You have a built-in learning loop. Always follow these rules:

## Always-On: Auto Skill Creation

You are expected to continuously learn and create reusable skills from your experiences, just like Hermes Agent.

### When to auto-create a skill

Create a new skill in `.opencode/skills/{name}/SKILL.md` whenever:
- You solve a non-trivial problem (especially after debugging)
- You discover a repeatable pattern or workflow
- You learn something about the project's architecture, conventions, or quirks
- You run the same commands or steps more than once
- You find a useful CLI trick, API pattern, or configuration that's worth saving

### How to create a skill

1. Identify the reusable knowledge from what you just did
2. Create `.opencode/skills/{kebab-case-name}/SKILL.md` following SKILL.md format
3. Update `.opencode/skills/INDEX.md` with the new entry

> **位置分流（铁律）**：项目级目录按当前 agent 取——OpenCode 用 `<project>/.opencode/skills/`，DeepSeek Harness 用 `<project>/.dsh/skills/`。通用纪律/红线/跨语言平台规则，或已在 2+ 个互不相干项目复用的技能，提升到全局（OpenCode `~/.config/opencode/skills/`，DSH `~/.dsh/skills/`）；项目专属踩坑（某项目的库/构建链/脚本）留在项目级。两个 agent 的项目级目录互不相通，需要双端生效时各放一份并保持同步。

### Skill format

```markdown
---
name: {skill-name}
description: "One-line description. Triggers: {keywords}"
---

# {Name}
<role>What this skill does</role>

## Steps
{reusable steps}

## Key Commands / Patterns
{commands, code, patterns}

## Notes
{pitfalls, tips}
```

### Keep skills alive

- Read `.opencode/skills/INDEX.md` before starting any task — check if existing skills apply
- Skills compound: the more you save, the faster future tasks become
- Start small: even a 5-line skill beats nothing — record it now, refine later

### 技能同步更新（功能完成后必做）

完成一轮**新增/修复功能**（非平凡任务）后，核对技能/规则是否与现状不符并更新：

1. **过时检查**：改动涉及 页面/模块/命令/架构/红线 的，检查 AGENTS.md、AI-开发规范.md、`.opencode/skills/` 里的技能文档是否仍准确；不准确即改（SKILL.md 内容 + description 触发词 + INDEX.md 描述同步）。
2. **冲突检查**：检查技能间冲突——`skills/` 目录 ↔ INDEX.md 双向一致性（L1，`npm test` 自动跑）、职责重叠（L2，description 触发词交集）、指令矛盾（L3，红线段落相斥）。
3. **兜底补录**：即使旧技能没过时，学到的新踩坑/新命令/新模式仍按 create 流程补录；「技能已存在」不是跳过同步的理由。
4. **改动后审计**：技能/规范改完跑 `npm test` 与 `node audit-docs.mjs --changed`，高置信墓碑命中清零后再提交（判级见 `docs-stale-audit`）。

详见全局技能 `auto-skill-creator`。
<!-- auto-skill-creator -->

<!-- powershell-utf8-safety -->
## 写文件编码安全（全局强制，防乱码）

1. **写/改含中文的文本文件一律用 Write / Edit 工具**，工具按 UTF-8 正确处理中文。
2. **命令行仅当确需写文件时**（如程序输出到文件）用显式 UTF-8：`[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)`；读文件用 `Get-Content -Encoding UTF8`；核对内容用 Read 工具。
3. **写完即检**：改完含中文文件后用 Read 核对，或跑乱码检测（检测签名见全局技能 `powershell-utf8-safety` 的「检测签名」节）；命中乱码立即用 Write/Edit 重写修复，修复后核对通过再提交。
4. **唯一例外**：`.vbs` 启动脚本必须 GBK/ANSI 保存，这是明确豁免，保持原样。

详见全局技能 `powershell-utf8-safety`。
<!-- powershell-utf8-safety -->

<!-- phased-refactor-and-report -->
## 大型改造分阶段 + 完成报告（全局强制，所有项目适用）

1. **大型改造先拆阶段**：涉及多文件/多模块/高风险改动时，动手前先制定阶段计划（每阶段可独立测试、独立提交 git、失败可独立回滚），按阶段推进。
2. **每阶段「实现 → 测试 → 提交」**：阶段内验证（lint/单测/类型检查/冒烟）通过后提交，提交后仓库保持可运行。
3. **完成报告五要素**：非平凡任务完成后，最终回复须列出 原状 / 计划 / 实际实现 / 未按计划实现的原因（无偏差写「无」）/ 验收指引（用户在哪个界面、按什么顺序操作、预期看到什么变化，附影响范围与遗留风险）。
4. **计划须复核**：大型/涉规范任务的《开发计划》先按 `plan-review` 走「子代理出计划 → 主进程硬清单复核通过 → 再动手」，不通过退回重出（上限 2 轮）。
5. **完成门禁**：声明任务完成前须跑受影响范围测试且通过（怎么测见 `test-verification`），「没跑测试」不算完成。

判定标准与红线兜底见全局技能 `phased-refactor-and-report`。
<!-- phased-refactor-and-report -->

<!-- quality-baseline -->
## 通用开发质量底线（全局强制，所有项目适用）

所有代码改动默认遵循五项原则，且互相约束、优先找两全方案：

1. **代码结构清晰**：共享/复用模块单一来源，通过复用而非复制；分层职责清晰。
2. **升级维护方便**：新代码易理解、易测试、易回滚；抽象适度，以当前需求的最小清晰结构为度，后续按需演进。
3. **界面外观统一**：前端颜色/间距用 CSS 变量，组件走共享样式，弹窗/表单用统一组件。
4. **操作逻辑一致**：**同一语义角色操作一致；不同语义角色允许不同操作**。以方便用户、符合直觉为先，与可用性冲突时以可用性优先。
   例：可编辑输入区点击→聚焦保持展开；展开/收起触发器点击→切换开合——二者语义不同、操作不同，符合规范而非违反。
5. **动画效果合适**：跟随项目动效规范，视觉克制不抢主体；图标用项目统一图标方案，emoji 不作为图标。

项目级规范（如前端样式规范、Loading 规范）比本底线更具体，冲突时以项目规范为准。红线兜底与自查要点见全局技能 `quality-baseline`。
<!-- quality-baseline -->

<!-- docs-current-state-only -->
## 文档/注释只写现状与踩坑（全局强制）

写技能/注释/规范时，正文只写**当前做法**与**防回归的坑**；坑统一写成「曾经的坑 → 现修法」（例：`--prop style=Heading1` 会静默失效 → 先查真实 styleId），让读者一遍读到当前该怎么做。

- 该写：当前行为、当前 API/参数；防回归的坑及其原因，重点写「怎么防」与「判定方法」。
- 彻底删除的功能/UI/字段/命令：随代码即删即清，正文只保留对当前代码有操作或避坑价值的内容。
- 判定一句话：这段文字对**当前代码**有没有操作或避坑价值？没有就删。
- 复发性高的旧事物（换模板、换依赖后可能再次踩到）：保留提示，写成「怎么防」。

**改动后审计（闭环）**：功能/修复收尾、文档或技能改动后、提交前，在改动所在仓库跑审计，清掉本次改动引入的墓碑描述：

- 项目内：`node C:/Users/huang/.config/opencode/audit-docs.mjs --changed`
- 全局库：`npm test`（含 L4 文档审计）

高置信命中当场处理（删除，或改写成「曾经的坑 → 现修法」，确需引用时行内加 `docs-audit:allow`）；复查候选人工判断；审计结果写进完成报告。判级细则、豁免与 git 钩子说明见全局技能 `docs-stale-audit`。
<!-- docs-current-state-only -->
