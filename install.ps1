# OpenCode Self-Evolving Kit — 一键安装（远程 / 本地均可）
# 用法（任意目录）：
#   iex (irm https://raw.githubusercontent.com/yubuhui/opencode-self-evolving/main/install.ps1)
# 或本地：powershell -ExecutionPolicy Bypass -File install.ps1
# 脚本从 GitHub 下载整套 tarball 再解压安装，不依赖本地仓库文件。
$ErrorActionPreference = "Stop"

$RepoUrl = "https://github.com/yubuhui/opencode-self-evolving/archive/refs/heads/main.tar.gz"
$target  = Join-Path $HOME ".config\opencode"
$tmp     = Join-Path $env:TEMP ("opencode-kit-" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $target -Force | Out-Null
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

try {
  Write-Host "Downloading opencode-self-evolving kit..."
  Invoke-WebRequest -Uri $RepoUrl -OutFile (Join-Path $tmp "kit.tar.gz") -UseBasicParsing
  tar -xzf (Join-Path $tmp "kit.tar.gz") -C $tmp
  $src = Get-ChildItem -Path $tmp -Directory | Where-Object { $_.Name -like "opencode-self-evolving-*" } | Select-Object -First 1
  if (-not $src) { throw "无法找到解压后的套件目录" }

  # 1. AGENTS.md — 已有则备份
  $agents = Join-Path $target "AGENTS.md"
  if (Test-Path -LiteralPath $agents) {
    $bak = "$agents.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
    Copy-Item -LiteralPath $agents -Destination $bak
    Write-Host "已备份现有 AGENTS.md 到 $bak"
  }
  Copy-Item -LiteralPath (Join-Path $src.FullName "AGENTS.md") -Destination $agents -Force
  Write-Host "已安装 AGENTS.md"

  # 2. 技能目录
  $skillDst = Join-Path $target "skills"
  New-Item -ItemType Directory -Path $skillDst -Force | Out-Null
  Copy-Item -Path (Join-Path $src.FullName "skills\*") -Destination $skillDst -Recurse -Force
  Write-Host "已安装 skills/"

  # 3. 自检工具
  Copy-Item -LiteralPath (Join-Path $src.FullName "check-rules.mjs") -Destination (Join-Path $target "check-rules.mjs") -Force
  Copy-Item -LiteralPath (Join-Path $src.FullName "audit-docs.mjs") -Destination (Join-Path $target "audit-docs.mjs") -Force
  $testDst = Join-Path $target "test"; New-Item -ItemType Directory -Path $testDst -Force | Out-Null
  Copy-Item -Path (Join-Path $src.FullName "test\*") -Destination $testDst -Recurse -Force
  $hooksDst = Join-Path $target "git-hooks"; New-Item -ItemType Directory -Path $hooksDst -Force | Out-Null
  Copy-Item -Path (Join-Path $src.FullName "git-hooks\*") -Destination $hooksDst -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $src.FullName "package.json") -Destination (Join-Path $target "package.json") -Force
  Write-Host "已安装自检工具（npm test = L1-L4 + 单测）；git-hooks 已拷贝但默认不启用"

  # 4. opencode.json（仅安全权限规则；已有则跳过）
  $cfg = Join-Path $target "opencode.json"
  if (-not (Test-Path -LiteralPath $cfg)) {
    Copy-Item -LiteralPath (Join-Path $src.FullName "opencode.json.example") -Destination $cfg
    Write-Host "已创建 opencode.json（含安全权限规则）。模型/API key 由 opencode 自己管理，本套件不涉及。"
  } else {
    Write-Host "跳过 opencode.json（已存在，避免覆盖你的配置）"
  }

  Write-Host "`n完成！重新启动 opencode 即可生效。"
}
finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
