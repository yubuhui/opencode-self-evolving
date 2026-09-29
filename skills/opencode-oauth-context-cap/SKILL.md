---
name: opencode-oauth-context-cap
description: "排查 OpenCode V2 ChatGPT OAuth 下 OpenAI 模型有效上下文被限制为 400k/272k；区分官方规格、客户端目录和实际端点能力。Triggers: GPT-6 Sol 百万上下文, 1M context, 上下文 54%, 400k, 272k, 自动压缩, ChatGPT OAuth, Codex OAuth, /api/model, limit.input, limit.context"
---

# OpenCode OAuth 上下文限额排查

<role>确认当前会话为何提前压缩，区分模型官方窗口、OpenCode 生效目录与认证通道的真实可用窗口。</role>

## Steps

1. 在当前项目运行 `opencode api get /api/model`，只提取目标 `providerID/id/limit`；可用 `opencode api get /api/session/<会话ID>` 只提取 `data.model`，核对会话实际模型。
2. 用 `opencode auth list --format json` 只查看目标提供商 `connections[].method`；不输出凭据、账户信息或原始响应。
3. 对照官方模型规格：GPT-6 Sol API 文档给出 `context=1050000/input=922000/output=128000`。本机 OpenCode 2.0.18 以 ChatGPT OAuth 连接时，`openai/gpt-6-sol` 生效目录是 `400000/272000/128000`，所以 215k / 400k ≈ 54%，约 270k 输入时自动压缩。见 OpenCode [#47646](https://github.com/anomalyco/opencode/issues/47646)。
4. 若目标是确切的百万窗口，先查询当前 OpenCode 版本及该连接的目录是否已有修复；独立计费的 OpenAI API key 是另一种通道，需用户同意后再切换、检查目录和实测。切勿仅凭官方 API 规格宣称 OAuth 已开启百万上下文。

## Key Commands / Patterns

```text
opencode --version
opencode api get /api/model
opencode auth list --format json
```

## Notes / Pitfalls

- OpenCode 的 `/api/model` 是**客户端生效元数据**，不是 OAuth 端点硬限额的直接证明。OpenCode [#44821](https://github.com/anomalyco/opencode/issues/44821) 报告单个 GPT-5.6 Sol OAuth 账户/路由接受约 921k 输入；这不能推断本机 GPT-6 Sol 也必然如此。
- `providers.openai.models.<id>.limit` 是 OpenCode 配置元数据；OAuth 变换可能再次覆盖它。只改数字可能只改变显示/压缩时机，甚至因超出端点能力导致失败；改动后必须重新检查 `/api/model`，不能把数值变大当作端点验证。
- OpenCode V2 配置见 [模型文档](https://opencode.ai/v2/docs/models) 和 [压缩文档](https://opencode.ai/v2/docs/compaction)；模型规格见 [OpenAI GPT-6 Sol](https://developers.openai.com/api/docs/models/gpt-6-sol)。
