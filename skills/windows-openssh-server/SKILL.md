---
name: windows-openssh-server
kind: runbook
review-by: 2027-06-30
description: Windows 10/11（含家庭版）OpenSSH 服务端：DISM 绕开 0x80040154、1067 查主机密钥 ACL、计划任务+.cmd wrapper 拉起 sshd、端口与认证应答验证。指纹见 env/{host}.md。Triggers: OpenSSH, sshd, 安装SSH服务端, ssh连不上, 0x80040154, 服务1067, no hostkeys available, 计划任务启动sshd, 微软账户SSH登录
---

# Windows OpenSSH 服务端落地

## 适用条件

- 目标是从另一台设备 `ssh user@局域网IP` 登录 Windows 主机，而不是本机当客户端。
- 环境指纹：见库根 `env/<host-slug>.md`（本机为 `env/desktop-m9lqf60.md`；该文件是本地留档、不入库），内容含 Windows 版本、账户类型、sshd 与主机密钥落点、已装验证状态。
- 家庭版支持 `OpenSSH.Server` 能力，版本限制不是失败原因。

## 一、安装阶段

1. 安装入口走原生命令：本机实测 PowerShell 7 的 `Add-WindowsCapability` 报 `没有注册类`（`0x80040154`，COM 类未注册），属 PS7 加载 DISM 模块的问题，与系统缺组件无关。
2. 直接用原生命令（管理员窗口）：
   ```powershell
   dism.exe /online /add-capability /capabilityname:OpenSSH.Server~~~~0.0.1.0 /norestart
   ```
   成功标志：`操作成功完成`，且 `C:\Windows\System32\OpenSSH\sshd.exe` 出现。
3. 备选安装路径（DISM 失败时依次试）：Windows PowerShell 5.1 的 `Add-WindowsCapability` → `winget install --id Microsoft.OpenSSH.Preview` → 从 GitHub PowerShell/Win32-OpenSSH 下载 `OpenSSH-Win64.zip`，解压后跑 `Install-sshd.ps1`。
4. 补主机密钥（缺失时 sshd 直接退）：`& "$env:SystemRoot\System32\OpenSSH\ssh-keygen.exe" -A`，密钥落在 `C:\ProgramData\ssh\`。

## 二、服务启动失败（1067）的判定顺序

症状组合：`Start-Service sshd` 报“无法启动服务”，System 日志事件 **7034“服务意外停止”**，`sc.exe queryex sshd` 给出 `WIN32_EXIT_CODE : 1067`，且 `C:\ProgramData\ssh\logs` 里**一行日志都没有**。

判定步骤：

1. **先分清是不是 SYSTEM 上下文的问题**：在管理员窗口前台跑
   ```powershell
   & 'C:\Windows\System32\OpenSSH\sshd.exe' -d -e
   ```
   能打印 `Server listening on 0.0.0.0 port 22.` 就说明配置、密钥、端口、防火墙全都没问题，故障只在“被服务管理器拉起”这条路上。
2. **拿 SYSTEM 上下文真实报错**：服务本身不给 stderr，用计划任务以 SYSTEM 跑一个 wrapper .cmd，把 stderr 重定向进文件（见第三节写法）。本机实测报错为：
   ```
   WARNING: UNPROTECTED PRIVATE KEY FILE!
   Permissions for '__PROGRAMDATA__\ssh/ssh_host_rsa_key' are too open.
   This private key will be ignored.
   sshd: no hostkeys available -- exiting.
   ```
   即 **SYSTEM 身份下的 sshd 拒绝加载 ACL 被判“过于开放”的主机密钥，报“无主机密钥”后直接退出**——这就是 1067 的真正原因，与端口、防火墙、sshd_config 无关。
3. 777 之外的相关背景：`ssh-keygen -A` 由管理员用户执行时，密钥 **owner 是该用户**；同一批密钥在用户上下文（`-d -e`）能正常加载，在 SYSTEM 上下文就被判 too open。因此“前台能跑、服务不能跑”是本问题的典型指纹。

## 三、修法

### 修法 A（推荐先试）：把密钥 owner/ACL 收到 SYSTEM

```powershell
$keys = Get-ChildItem 'C:\ProgramData\ssh' -Filter 'ssh_host_*_key'
foreach ($k in $keys) {
    icacls.exe $k.FullName /setowner 'NT AUTHORITY\SYSTEM'
    icacls.exe $k.FullName /inheritance:r /grant 'SYSTEM:F' /grant 'Administrators:R'
}
Set-Service sshd -StartupType Automatic
Start-Service sshd
```
关键是把 **owner 改成 SYSTEM**（仅收紧 ACE 不够——ACE 收成 `SYSTEM:R + Administrators:R` 时 SYSTEM 仍报 too open）。

### 修法 B（服务仍不可用时的可靠替代）：计划任务拉起 sshd

单条命令内嵌 `cmd /c "exe" ... > log 2>&1` 会被 PowerShell 的 `Start-Process -ArgumentList` 二次转义，命令可能**静默不执行**（表现为日志文件根本不生成、端口不监听，极易误判成“sshd 在用户上下文也跑不起来”）。

正确写法：先落一个 wrapper 文件，再让计划任务执行它。

```powershell
$wrapper = "$env:USERPROFILE\run-sshd.cmd"
Set-Content -Path $wrapper -Encoding ASCII -Value @"
@echo off
"C:\Windows\System32\OpenSSH\sshd.exe" -D -e >> "$env:USERPROFILE\sshd-runtime.log" 2>&1
"@

$action    = New-ScheduledTaskAction -Execute $wrapper
$trigger   = New-ScheduledTaskTrigger -AtLogOn -User "$env:COMPUTERNAME\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'OpenSSH Server (Logon)' -Action $action -Trigger $trigger `
    -Principal $principal -Settings $settings -Force
Start-ScheduledTask -TaskName 'OpenSSH Server (Logon)'
```

要点：
- `-D -e` 必须带：`-D` 不脱离前台，`-e` 输出到 stderr（被 wrapper 重定向），避免落到会崩的日志初始化路径。
- `-RunLevel Highest` 让 sshd 拿到提权令牌，才能给管理员账户建会话；不带则登录大概率失败。
- 服务与计划任务二选一：同时启用会抢 22 端口；改用任务时把服务设为 `Manual`。
- 代价：任务依赖用户已登录。需要“开机未登录也能连”就回到修法 A 把服务修好。

## 四、验证（以监听与真实应答为准）

```powershell
# 1) 监听
Get-NetTCPConnection -LocalPort 22 -State Listen
# 2) 真实应答 + 认证方式（BatchMode 必然失败，但失败信息就是证据）
& 'C:\Windows\System32\OpenSSH\ssh.exe' -o BatchMode=yes -o StrictHostKeyChecking=no `
    -o UserKnownHostsFile=NUL -o ConnectTimeout=5 'user@192.168.1.10' 'echo ok'
```

看到 `Permission denied (publickey,password,keyboard-interactive)` 即通过：**sshd 已应答且提供密码认证**（BatchMode 只是不交互）。看到 `Connection refused` 才是没通。

## 五、客户端填写与常见坑

- 填三项：**局域网 IPv4**（如 `192.168.1.10`，取 WLAN 那块网卡；`192.168.56.x`/`198.18.x.x` 等虚拟网卡不用于局域网登录）、端口 `22`、用户名（本地账户名；微软账户先试账户名，失败再试邮箱全称）。
- **密码 = 微软账户密码**（`Get-LocalUser <name> | Select PrincipalSource` 显示 `MicrosoftAccount`）。开机 PIN、指纹、Windows Hello 都不参与 SSH。
- MSA 账户常见 `get_passwd: lookup_sid() failed: 1332` 警告，前台运行时可忽略；若密码认证始终 `Permission denied`，改用公钥：管理员组账户的密钥要写进 `C:\ProgramData\ssh\administrators_authorized_keys`（`AuthorizedKeysFile` 的 `Match Group administrators` 分支），并确保该文件 ACL 仅 SYSTEM/Administrators 可写。
- 客户端报 `Connection refused` 先查 `Get-NetTCPConnection -LocalPort 22 -State Listen`；服务/任务停止、端口未监听是首位原因，其次才是防火墙。

## 六、留档位置

- 服务端日志：`C:\ProgramData\ssh\logs\sshd.log`（为空说明进程在写日志前就退了）。
- 计划任务方式日志：wrapper 里重定向的那个文件（如 `%USERPROFILE%\sshd-runtime.log`）。
- 事件：System 日志 7034（意外停止）；`sc.exe queryex sshd` 的 `WIN32_EXIT_CODE` 1067 = 进程意外终止。

## 红线兜底

- 不要用 `Set-Content`/`Out-File` 写含中文的脚本（编码易坏），脚本内容保持纯 ASCII 更稳；中文说明写在文档里。
- 不要把 `-d` 当成长期服务模式：调试模式只适合定位问题，长期运行用 `-D`（服务或任务方式）。
- 不要为了让 sshd 起来而给 `C:\ProgramData\ssh` 或密钥加 `Everyone`/`Authenticated Users` 的可写权限——那会直接触发同一处保护检查，并降低安全性。
- 不要在未确认端口监听与认证应答前宣布“搞定”，只看到 `[ OK ]` 类输出不算证据。
