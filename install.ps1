# OpenCode Self-Evolving Kit — 一键安装
# 将本仓库的核心系统拷贝到 opencode 全局配置目录。
# 用法：右键"使用 PowerShell 运行"，或 `powershell -ExecutionPolicy Bypass -File install.ps1`

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $HOME ".config\opencode"

if (-not (Test-Path -LiteralPath $target)) {
  New-Item -ItemType Directory -Path $target -Force | Out-Null
}

# 1. 全局指令（AGENTS.md）——已存在则提示备份
$agents = Join-Path $target "AGENTS.md"
if (Test-Path -LiteralPath $agents) {
  $bak = "$agents.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
  Copy-Item -LiteralPath $agents -Destination $bak
  Write-Host "已备份现有 AGENTS.md 到 $bak"
}
Copy-Item -LiteralPath (Join-Path $repo "AGENTS.md") -Destination $agents -Force
Write-Host "已安装 AGENTS.md"

# 2. 技能目录
$skillSrc = Join-Path $repo "skills"
$skillDst = Join-Path $target "skills"
if (Test-Path -LiteralPath $skillDst) {
  Copy-Item -Path (Join-Path $skillSrc "*") -Destination $skillDst -Recurse -Force
} else {
  Copy-Item -LiteralPath $skillSrc -Destination $skillDst -Recurse
}
Write-Host "已安装 skills/"

# 3. 配置文件模板（不会覆盖现有 opencode.json）
$cfg = Join-Path $target "opencode.json"
if (-not (Test-Path -LiteralPath $cfg)) {
  Copy-Item -LiteralPath (Join-Path $repo "opencode.json.example") -Destination $cfg
  Write-Host "已创建 opencode.json（请编辑填入你自己的 API Key）"
} else {
  Write-Host "跳过 opencode.json（已存在，避免覆盖你的配置）"
}

Write-Host "`n完成！重新启动 opencode 即可生效。"