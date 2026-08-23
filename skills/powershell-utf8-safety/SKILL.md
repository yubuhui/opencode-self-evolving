---
name: powershell-utf8-safety
description: "禁止用 PowerShell 写含中文的文本文件（Set-Content/Out-File 默认 ANSI/GBK 破坏 UTF-8 中文）。Triggers: 乱码, 写文件, Set-Content, Out-File, UTF-8, 中文损坏, 读改写, 文件编码, 编码安全"
---

# PowerShell 写文件编码安全（全局）

## 事故背景

在中文 Windows（系统 ANSI 编码 = GBK）上，PowerShell 5.1 的 `Get-Content`/`Set-Content`/`Out-File`/`Add-Content`/`>` 默认用 **ANSI(GBK)** 读写文本。用它改写含中文的 UTF-8 文件会把中文变成乱码（如 `鎺掑簭`、`锟斤拷`、U+FFFD），且不可逆——曾因此损坏真实项目文件，需 `git checkout` 恢复后逐条重放全部改动。

## 铁律

1. **写/改含中文的文本文件一律用 Write / Edit 工具**（正确按 UTF-8）。
2. **禁止**：`Set-Content`、`Out-File`、`Add-Content`、`内容 > 文件`、以及 `Get-Content -Raw` + 写回组合。
3. 确需命令行写文件（如程序输出到文件）时用显式 UTF-8：
   ```powershell
   [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
   ```
   读文件用 `Get-Content -Encoding UTF8`；核对内容用 Read 工具。
4. 改完含中文文件后做乱码检测（见下）。

## 唯一例外：.vbs 启动脚本

`.vbs` 文件（如「启动工作台.vbs」）在中文 Windows 上**必须用 GBK/ANSI 保存**，否则 VBScript 解析中文字符串会报错——这**故意违反**本条铁律，是明确豁免，不要"修"成 UTF-8。其余文本文件一律按铁律走 UTF-8。

## 通用乱码检测（不限本项目）

```powershell
rg -n "锟斤拷|鎺掑|掑簭|缁撴|娴嬭|鐨勶|鍦ㄤ|鏄痯|\\uFFFD" <目录>
```

命中即事故：立即用 Write/Edit 重写修复，不得提交。若项目有编码检查脚本/测试（如 `check-encoding.js`、`npm test` 含编码扫描），跑之。

## 恢复技巧（万一损坏）

1. `git checkout HEAD -- <file>` 恢复到提交版（若损坏前有未提交改动会丢失——先评估）。
2. 用 Read 工具读各段落，逐段用 Edit 工具重放丢失的改动（Edit 用精确 old/new 字符串）。
3. 全程用 Write/Edit，禁止再用 PowerShell 写该文件。

## 检测签名

`锟斤拷`、`鎺掑簭`、`掑簭`、`缁撴`、`娴嬭`、`鐨勶`、`鍦ㄤ`、`鏄痯`、U+FFFD 等 UTF-8-as-GBK 误读常见连字。
