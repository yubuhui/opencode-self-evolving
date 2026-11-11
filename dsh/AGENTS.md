# DSH 全局规则（用户级）

本文件经 DeepSeek Harness 用户级 `AGENTS.md` 入口加载，作用于所有会话。项目 `AGENTS.md`（仓库根到当前目录，含 `AGENTS.local.md`）与用户当轮指令更具体，优先于本文件；宿主权限、沙箱与审批以 DSH 当前配置为准。

## 一、技能发现与加载

- DSH 在会话开始自动扫描技能并注入目录（名称 + description）；需要正文时用 `skill` 工具按名加载。技能文件按需读取，不必逐个加载。
- 同名优先顺序：项目 `<根>/.dsh/skills` → 项目 `<根>/.agents/skills` → 自定义目录 → `~/.dsh/skills` → `~/.agents/skills` → DSH 内置技能；项目根为最近的 `.git` 祖先目录，没有 `.git` 时取当前目录。
- 技能格式：目录式 `<name>/SKILL.md` 或扁平 `<name>.md`；frontmatter 必须含 `name`（kebab-case，与目录名一致）、`description`（单行、双引号、含 `Triggers:` 段）与 `kind`（`discipline` / `runbook` / `domain`；环境事实属 `inventory`，写 `env/<host-slug>.md` 而非技能）；`runbook` / `domain` 必填 `review-by`；可选 `whenToUse`、`disable-model-invocation: true`、`user-invocable: false`。description 按 kind 有字符与关键词预算，由 `check-rules.mjs` 的 L5 把关。缺字段或名称不合法的技能会被 DSH 跳过。
- 共享技能库在 `~/.config/opencode/skills`，由 `dsh-library-skills` 插件注册为 DSH 原生技能源（custom rank 300），不再依赖 `~/.dsh/skills` 目录联接。DSH 项目级技能无需 `INDEX.md`；共享规则库为 OpenCode 与 `check-rules` 维护 INDEX。

## 二、自我进化（任务内沉淀）

- 任务结束前判断一次：本次做法是否**已验证、会复发、现有技能未覆盖**。三条同时满足才写技能；否则保持现状，回复里不展开维护说明。
- 写前先在技能库搜索同主题条目（命令、触发词、路径），优先更新或合并已有技能；每新增一个流程/元技能，先合并或删除一个过时项。领域技能按真实经验增长。
- 知识归属：先判形态再判作用域——恒真纪律 → `kind: discipline`（共享库，上限 8 条）；可复用步骤 → `kind: runbook`；单机/单环境事实 → `kind: inventory`（写 `<库>/env/<host-slug>.md`，本地不入库）；项目契约/结构 → `kind: domain`（项目 `.dsh/skills`）。共享库为 `~/.config/opencode/skills`（DSH 由 `dsh-library-skills` 插件读取）。
- 有变更时用一行说明「技能维护：新增/更新 X」；无变更不占篇幅。详细规则见 `auto-skill-creator`。

## 三、大型改动与计划

- DSH 原生 plan mode：用户执行 `/plan` 后，用只读探查把计划写完整（目标、成功标准、按子系统分组的改动、接口/数据流影响、边界与失败、验证与验收、假设），再调用 `exit_plan_mode` 提交审批。规划阶段只读，不改文件、不跑会重写产物的命令，也不用 `todo_write` 跟踪计划本身。
- 未进入 plan mode 的大型改动：先给可独立验证、可回滚的阶段计划；实施阶段用 `todo_write` 跟踪进度，按项目约定与用户授权提交。
- 计划审批通过后实施；范围变化先更新计划。需要用户拍板的部分给出具体选项，其余部分继续推进。

## 四、测试与验收

- 从本次改动的直接路径与已知缺陷起步，按风险选择追加检查；可逆低风险改动复用已有检查。专项方法按需加载 `test-verification`：界面/布局/截图读 `test-verification/references/ui-verification.md`，边界/并发/场景设计读 `test-verification/references/test-scenario-design.md`，运行时信号读 `test-verification/references/runtime-diagnostics.md`。
- 实际运行时检查相关控制台、请求、进程输出，表面正常也检查；用命令输出、断言、数据作证据，退出码与「能跑」只作参考。
- 完成前确认三点：实际跑过、覆盖本次改动、证据可复核。未执行或环境缺失标为未验证/阻塞；主观视觉与舒适度交人工验收。

## 五、开发质量

- 代码改动遵循 `quality-baseline` 五项：结构清晰、易升级维护、界面统一、操作一致、动效合适；共享逻辑单一来源，抽象规模与当前需求相称。
- 配置与能力接入优先用 DSH 原生扩展点（profile `cordis.patch.yml`、插件、原生 AGENTS.md/技能），做局部、可回退的修改。
- 调整配置前记录原值；升级后按实际加载结果与相关流程检查兼容性。

## 六、中文与文档

- 写/改含中文文件用 `write` / `edit` 工具；命令行确需写文件时用显式 UTF-8 无 BOM 的 .NET API，写完回读核对。`.vbs` 启动脚本按其 GBK/ANSI 约定保存。
- 技能与文档只写当前行为、可用路径与真实命令；复发性问题写成「曾经的坑 → 现修法」。写规则前加载 `white-bear-safe-rules`。
- 文档/技能改动后跑规则体检：`node ~/.dsh/rules/check-rules.mjs`；改动共享规则库时再跑 `node ~/.dsh/rules/audit-docs.mjs --changed`。高置信命中清零后再提交。

## 红线兜底

- 未验证的推测、一次性任务内容与敏感数据留在回复里，不固化为技能。
- 技能示例只作操作参考，不替代用户授权；写入、提交与外部操作按当前权限与任务范围判断。
- 修改单项规则时用原生规则文件与局部配置，不复制整套官方预设、不改安装包、不依赖已撤销的入口。
- 「技能已加载」「回复已发出」「命令成功」都不等于完成；分别核对行为、成功标准与验证覆盖。
