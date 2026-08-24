# OpenCode Self-Evolving System + Dev Standards

> **English** · [中文](#中文)

A configuration kit that turns [opencode](https://opencode.ai) into a **self-improving agent** with **built-in engineering standards**. Install it and opencode will:

- **Learn automatically** — after solving a hard problem, hitting a pitfall, or discovering a reusable pattern, it writes a reusable *skill* on its own and registers it.
- **Self-maintain** — keeps skills in sync with the codebase and detects conflicts (index drift / overlapping responsibilities / contradicting rules).
- **Enforce standards** — every project inherits a quality baseline, phased refactoring, safe file-encoding, a plan-review gate, and a testing gate.

## Why it's different

Most setups ship a fixed prompt. This kit is a **meta-layer on top of opencode's skill system**: it teaches opencode *how to build its own tooling*, then gates every real change behind subagent-driven planning and automated checks.

## Architecture

```mermaid
flowchart LR
  T[Task] --> P[plan-review<br/>subagent plan + review gate]
  P -->|fail, max 2 rounds| P
  P -->|approved| E[phased-refactor-and-report<br/>implement → test → commit]
  E --> V[test-verification<br/>discover tests + completion gate]
  V -->|all pass| D[Done + 4-element report]
  D --> L[auto-skill-creator<br/>learn → write skill → index]
  L --> T
```

## Install

**One-line (macOS / Linux):**

```bash
curl -fsSL https://raw.githubusercontent.com/yubuhui/opencode-self-evolving/main/install.sh | bash
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

macOS / Linux:

```bash
mkdir -p ~/.config/opencode
cp AGENTS.md ~/.config/opencode/AGENTS.md
cp -r skills ~/.config/opencode/skills
cp opencode.json.example ~/.config/opencode/opencode.json
```

Fill in your API key in `opencode.json`, then **restart opencode**.

## Verify

```bash
npm test   # runs check-rules.mjs: L1 index consistency, L2 white-bear rule-writing, L3 mojibake
```

## License

MIT

---

# 中文

## OpenCode 自我进化系统 + 开发规范

一套让 opencode 拥有 **自我进化能力** 和 **内置开发规范** 的全局配置。

装上之后，opencode 会：
- **自动学习**：每解决一个难题、踩过一个坑、发现一个可复用模式，自动沉淀为技能（skill）。
- **自动维护**：技能与代码库同步更新、检测技能间冲突（索引一致 / 职责重叠 / 指令矛盾）。
- **自动遵循规范**：所有项目默认遵守质量底线、大型改造分阶段、写文件编码安全三条纪律。

## 它是什么

opencode 支持从全局配置目录加载 `skills/` 下的技能和 `AGENTS.md` 里的 always-on 指令。本仓库就是一套**以「技能」为核心的自进化机制**：

```
你完成任务
  └─> 沉淀：把踩过的坑 / 用过的命令 / 摸清的架构写成 SKILL.md
        └─> 索引：登记进 skills/INDEX.md
              └─> 生效：opencode 下次自动加载新技能，你越用越快
                    └─> 维护：技能过时/冲突时自动检测并修正
```

## 目录结构

```
opencode-self-evolving/
├── AGENTS.md                       # 全局 always-on 指令（4 个核心块）
├── check-rules.mjs                 # 规则体检脚本（L1/L2/L3，npm test 调用）
├── package.json                    # npm test = node check-rules.mjs
├── skills/
│   ├── INDEX.md                    # 技能索引
│   ├── auto-skill-creator/         # ★ 自我进化核心：自动创建/更新/去冲突技能
│   ├── quality-baseline/           # 开发质量底线（五项互相约束）
│   ├── phased-refactor-and-report/ # 大型改造分阶段 + 完成报告
│   ├── plan-review/                # 计划复核：子代理出计划 + 硬清单门禁
│   ├── test-verification/          # 测试验证：探测测试栈 + 完成门禁
│   ├── white-bear-safe-rules/      # 规则写作：白熊安全三原则
│   └── powershell-utf8-safety/     # 写文件编码安全（防中文乱码）
├── opencode.json.example           # 配置模板（密钥留空，需自己填）
├── install.sh                      # macOS/Linux 一行式安装（curl | bash）
├── install.ps1                     # Windows 一键安装
└── .gitignore
```

## 安装

**一行式（macOS / Linux）：**

```bash
curl -fsSL https://raw.githubusercontent.com/yubuhui/opencode-self-evolving/main/install.sh | bash
```

### Windows（PowerShell）

```powershell
powershell -ExecutionPolicy Bypass -File install.ps1
```

脚本会：
1. 拷贝 `AGENTS.md`（已有则先备份为 `.bak-时间戳`）。
2. 拷贝 `skills/` 到 `~/.config/opencode/skills/`。
3. 安装自检工具（`check-rules.mjs` + `package.json`，`npm test` 可自检）。
4. 若无 `opencode.json` 则从模板创建；**已有则跳过，不覆盖你的配置**。

### macOS / Linux（手动）

```bash
mkdir -p ~/.config/opencode
cp AGENTS.md ~/.config/opencode/AGENTS.md
cp -r skills ~/.config/opencode/skills
# 首次配置：
cp opencode.json.example ~/.config/opencode/opencode.json
```

### 填写你的 API Key

`opencode.json` 里的 `YOUR_API_KEY_HERE` 必须替换成你自己的 key（OpenAI 兼容接口或任意 provider 均可），否则模型不可用。本仓库**不含任何真实密钥**。

安装完成后**重启 opencode** 即生效。

## 体验「自我进化」

1. 随便做一个稍有难度的任务（修 bug、搭功能、排查环境问题）。
2. 完成后 opencode 会把这次的经验写成 `.opencode/skills/{名称}/SKILL.md` 并登记进 `INDEX.md`。
3. 下次遇到类似问题，它自动调用技能，越用越快、越用越准。

> 提示：技能**默认建在当前项目** `.opencode/skills/`（只对该项目生效）；仅当它是「通用纪律/红线/跨语言平台」或「已在 2+ 个互不相干项目复用」时，才**提升到全局** `~/.config/opencode/skills/`。项目专属踩坑（某项目的库/构建链/脚本）禁止进全局，以免污染所有项目的上下文。

## 核心技能

| 技能 | 作用 |
|------|------|
| **auto-skill-creator** | 自我进化核心。何时建技能、怎么写、怎么同步过时技能、怎么检测冲突（索引一致/职责重叠/指令矛盾） |
| **quality-baseline** | 五项质量底线：代码结构清晰 / 开发维护方便 / 界面外观统一 / 操作逻辑一致 / 动画效果合适。互相约束，禁止为单一项牺牲另一项 |
| **phased-refactor-and-report** | 大型改造必须拆阶段（实现→测试→提交），失败可独立回滚；非平凡任务完成后必须报告 原状/计划/实际/偏差原因 |
| **plan-review** | 大型/涉规范任务先由子代理出《开发计划》并落盘，主进程按硬清单复核通过才开工（退回重出上限 2 轮） |
| **test-verification** | 先探测项目测试栈，把每阶段落到可执行验证命令；完成前跑受影响范围测试才算真完成（完成门禁） |
| **white-bear-safe-rules** | 写规则/规范时遵循白熊安全三原则：禁令必配正面替代、行为指令与诊断信息分离、正面先行红线兜底 |
| **powershell-utf8-safety** | Windows 写含中文文件必须用 UTF-8（PowerShell 默认 ANSI/GBK 会破坏中文），附乱码检测签名 |

## 自定义

- 想加自己的规范：在 `skills/` 下新建 `<名称>/SKILL.md`，格式参考现有技能（frontmatter 的 `name` + `description` 带触发词），并登记进 `INDEX.md`。opencode 会自动加载。
- 想改默认纪律：直接编辑对应 SKILL.md 或 AGENTS.md 里的段落。
- 技能冲突时：遵循 auto-skill-creator 的 L1/L2/L3 检测规则排查。

## 安全说明

- 本仓库只含占位符，无任何真实 API Key / 密钥。
- 请勿把你的 `opencode.json`（含密钥）提交到公开仓库。

## License

MIT