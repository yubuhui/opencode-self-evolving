---
name: dsh-turn-failure-diagnosis
kind: runbook
review-by: 2027-06-30
description: "DeepSeek Harness 每轮立即失败（界面显示本轮运行失败）的定位与修复：解压 session.v4.jsonl.zstd 读 turn/end 错误，处理 unknown prompt variable（如 persona 里的 {{cwd}}）。Triggers: DeepSeek Harness, dsh, 本轮运行失败, 一直失败, unknown prompt variable, persona-suffix, {{cwd}}, session.v4.jsonl.zstd"
---

# DeepSeek Harness 每轮失败排查

<role>会话里每次发送都立刻失败、连模型都没请求时，先从会话日志拿到真实错误，再修 profile 补丁配置。</role>

## Steps

1. 找最近会话日志：`%USERPROFILE%\.dsh\sessions\<工作区目录>\<session-id>\session.v4.jsonl.zstd`，按修改时间取最新。
2. 解压并只看每轮的结局（日志是 zstd 流，帧头可能没有 content size，必须用 `stream_reader`）：

```python
import zstandard, json
p = r"...\session.v4.jsonl.zstd"
with open(p, "rb") as f:
    data = zstandard.ZstdDecompressor().stream_reader(f).read().decode("utf-8")
for line in data.splitlines():
    e = json.loads(line)
    if e.get("type") == "turn/end":
        print(e["data"]["turn"], e["data"]["reason"])
```

3. 若错误是 `unknown prompt variable "{{x}}" in section "deployment:persona-suffix"; registered variables: provider, model`，去改 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml` 的 `preset-standard` → `persona`。
4. 改前备份，改后确认 YAML 可解析、文件里不再有非法变量，再让应用重载或重试。

## Key Patterns

- 当前 dsh 版本（0.2.1-rc.2）persona 模板只注册 `{{provider}}` 和 `{{model}}`；`{{cwd}}` 不是提示词变量。
- 当前工作目录由 `dsh-working-directory` 作为**必需的 user-role 上下文**注入，内容形如 `Current working directory: "<绝对路径>".`，不占系统提示词、也不受 `includeRuntimeContext: false` 影响。
- 正确写法：persona 只保留合法变量，例如

```yaml
- id: persona
  name: '@deepseek-ai/dsh-persona'
  config:
    prefix: You are a coding agent powered by the {{model}} model.
```

- cwd 只交给 working-directory 上下文；persona 里删掉 `suffix: ... {{cwd}} ...`，模型仍能从上下文拿到目录。
- profile 补丁文件受 HMR 监听，保存后通常自动重组；若现有会话仍报同一错误，重启 DeepSeek Harness 再试。
- 启动期崩溃看 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*-host.log`；`ECONNREFUSED 127.0.0.1:7890` 是本地代理没开，与提示词错误无关。

## Notes

- 先看 `turn/end` 的 `reason.error.message` 再动手，以日志里的错误文本为准。
- 这类错误发生在提示词渲染阶段，换模型、重开会话都无效，必须改配置。
- 大版本升级后先复查用户补丁里的 `{{...}}`：只允许当前版本注册过的变量，否则每一轮都会在渲染时失败。
