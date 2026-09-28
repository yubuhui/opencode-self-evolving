---
name: opencode-proxy-network-error
description: "排查 OpenCode 报网络错误/必须开 VPN 才可用的问题：定位 service.json 的 HTTP_PROXY 注入与 VPN 本地代理端口的关系，并用绕过代理的直连测试判定供应商是否真需要翻墙。Triggers: opencode 网络错误, 必须开VPN, 连接被拒绝, ECONNREFUSED, 7890, HTTP_PROXY, service.json, 代理, 供应商连不上, fetch failed"
---

# OpenCode 必须开 VPN / 报网络错误排查

<role>当 OpenCode 报网络错误、或在关掉 VPN 后不可用时，快速判定「是供应商真被墙」还是「代理配置把流量硬绑到 VPN 本地端口」。</role>

## 核心判断

OpenCode（服务进程）的出网代理来自 `~/.config/opencode/service.json` 的 `env`：

```json
{ "env": { "HTTP_PROXY": "http://127.0.0.1:7890", "HTTPS_PROXY": "http://127.0.0.1:7890", "NO_PROXY": "localhost 127.0.0.1 ::1" } }
```

若这段存在，**OpenCode 的所有请求都先连 `127.0.0.1:<端口>`**。该端口通常是 VPN/Clash 的本地代理口。VPN 一关端口无监听 → `ECONNREFUSED` → OpenCode 报网络错误，**跟供应商是否被墙无关**。
注意：Node/Bun **不读 Windows 系统代理（WinINET）**，所以是 service.json 的 env 在起作用；只改注册表代理不改这里没用。

## 排查步骤

1. 看配置里有没有代理注入：
   `Read ~/.config/opencode/service.json`
2. 查代理端口被谁监听：
   `Get-NetTCPConnection -LocalPort 7890 -State Listen | Select OwningProcess` → `Get-Process -Id <pid>`
   若进程是 VPN 客户端（如 `iKuuuVPNCore.exe`），则确认端口 = VPN 本地代理。
3. 判定 VPN 是「代理模式」还是「TUN 全局模式」（决定直连测试是否可信）：
   - `Get-NetRoute -DestinationPrefix "0.0.0.0/0"` → 默认路由走物理网卡(WLAN/以太网)=代理模式；走 wintun/tun 网卡=TUN 模式。
   - 保险再跑：`Find-NetRoute -RemoteIPAddress <API域名解析IP>` 看出口网卡。
4. 绕过代理做真实 HTTPS 直连测试（等价于关 VPN 后的效果）：
   `curl.exe -s -o NUL -w "%{http_code}" --noproxy "*" --max-time 15 https://<api域名>/...`
   返回 200/401/403/405 = 直连可达（能到达服务器），该供应商**不需要 VPN**。
   返回超时/连接失败 = 真被墙，才需要代理。
   同理测当前模型供应商、所有 `auth.json` 里的供应商、以及 `mcp` remote 域名。

## 修复（首选：NO_PROXY 白名单，而非删代理）

**不要把 `HTTP_PROXY` 整段删掉**。OpenCode 用 Bun，代理模式 VPN 下它不读系统代理；删掉代理配置后，遇到真被墙的供应商（OpenAI/Google/Anthropic）**即使开着 VPN 也连不上**，因为没人告诉它走代理。
正确做法是「代理照设 + 直连可达域名放白名单」：

```json
{ "env": {
  "HTTP_PROXY": "http://127.0.0.1:7890",
  "HTTPS_PROXY": "http://127.0.0.1:7890",
  "NO_PROXY": "localhost,127.0.0.1,::1,<直连可达域名1>,<直连可达域名2>,..."
}}
```

- 白名单域名（如 api.deepseek.com、integrate.api.nvidia.com、国内中转站）→ 直连，开不开 VPN 都可用。
- 未列入的（如 api.openai.com）→ 走 VPN 代理，需 VPN 开着。
- `NO_PROXY` 用**逗号**分隔（Node/Bun 约定），端口改了就同步改两处。
- 改动后需**完全重启 OpenCode**（含后台 server）才生效。

判定某域名是否该进白名单，用上面的 `--noproxy` 直连测试：能返回状态码就进白名单，超时才留给代理。

## 关键命令

```powershell
# 端口归属
Get-NetTCPConnection -LocalPort 7890 -State Listen | Select LocalAddress,LocalPort,OwningProcess
Get-Process -Id <pid> | Select ProcessName,Path
# 默认路由 / 出口网卡
Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select ifIndex,NextHop,InterfaceAlias
Find-NetRoute -RemoteIPAddress <ip> | Select -First 1 InterfaceIndex,InterfaceAlias
# 绕代理直连测试
curl.exe -s -o NUL -w "%{http_code} %{time_total}s" --noproxy "*" --max-time 15 <url>
# 备份/回滚 service.json
Copy-Item service.json "service.json.bak-$(Get-Date -f yyyyMMdd-HHmmss)"
```

## Notes

- 「必须开 VPN」多半是代理注入造成的假象，别默认怀疑供应商被墙——先做第 4 步直连测试。
- **但确有真被墙的站**：实测 api.openai.com、generativelanguage.googleapis.com 直连超时（`000`），api.anthropic.com 直连 403。用这些供应商时 VPN 必须开，且 OpenCode 必须保留代理配置（Bun 不读系统代理）。所以修法是「NO_PROXY 白名单」而非「删代理」。
- 直连测试在 TUN 全局模式下会被隧道接管而失真，必须先做第 3 步确认是代理模式。
- 用户没法自己关 VPN 配合测试时（关了他就没法跟 AI 对话，鸡生蛋），用 `--noproxy` 绕过代理测即可，无需真关 VPN。
- 判断「走代理是否可用」用 `curl.exe -x http://127.0.0.1:7890 <url>`，与直连测试对照即可区分「配置问题」和「真被墙」。
- 改含中文的文本文件时用 Write/Edit 工具，见技能 `powershell-utf8-safety`。
