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

先判断知识属于哪一类，再决定写到哪里：

| 类型 | 判据 | 落点 |
| --- | --- | --- |
| 元技能/纪律 | 流程、写作语法、质量、测试、计划、审计等跨项目规则 | 全局 `~/.dsh/skills` |
| 平台规则 | DSH/OpenCode/Windows/Git 等平台或工具知识，与具体代码库无关 | 全局 `~/.dsh/skills` |
| 跨项目配方 | 可复用的任务操作手册（如 APK 下载核验），换项目仍成立 | 全局 `~/.dsh/skills` |
| 方法细节 | 属于某个总控技能的分支方法（界面验证、场景设计等） | 该技能的 `references/*.md`，不单独建技能 |
| 项目专属 | 某项目的库、构建链、业务规则、页面结构 | 项目 `.dsh/skills` |
| 一次性经验 | 只在本次任务成立、未验证或不会复发 | 留在回复，不落盘 |

判断顺序：先看是否属于已有总控技能的方法细节（写 references），再看是否与具体项目绑定（项目级），最后才考虑全局技能。首次遇到、尚未复用的配方先留在回复；第二次复用或确认跨项目通用时再提升为全局技能。

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

frontmatter 必填两项：

- `name`：kebab-case，与目录名一致。
- `description`：一句话说明 + `Triggers:` 关键词，供目录触发。DSH 只用目录里的 description 匹配，触发词写全。

可选字段：`whenToUse`（补充适用时机）、`disable-model-invocation: true`（仅用户可调用）、`user-invocable: false`（仅模型可调用）。缺 `name`/`description` 或名称不合法的文件会被 DSH 跳过。

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
- 两个技能职责重叠：保留更通用的一个，另一个并入或改写成指向它。
- 技能描述与内容不符：同步 `description` 与 INDEX 行。
- 方法细节有增补：写进所属总控技能的 `references/*.md`（如界面验证 → `test-verification/references/ui-verification.md`），保持技能目录数量稳定。

流程/元技能保持精简：新增前先找可合并项，合并或删除过时项后再新增；领域技能按真实经验增长。

## 写完检查

1. 回读 frontmatter 与正文，确认 `name` 与目录一致、中文无乱码。
2. 运行规则体检：`node ~/.dsh/rules/check-rules.mjs`（DSH 经 `~/.dsh/rules` 联接访问；OpenCode 用 `~/.config/opencode/check-rules.mjs`）。
3. 改动共享规则库时同步 `skills/INDEX.md`，再跑 `node ~/.dsh/rules/audit-docs.mjs --changed`。

## 红线兜底

- 未验证、不可复现或只对当前对话有意义的内容留在回复里，不写成技能。
- 技能写入前先搜索同名与同主题条目，避免重复与互相矛盾的指令。
- 共享规则库的 INDEX 与目录保持一一对应；项目级 DSH 技能不需要 INDEX。
