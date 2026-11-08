---
name: powershell-utf8-safety
description: "写/改含中文文本文件一律用 Write/Edit 工具（UTF-8），命令行确需写文件时用显式 UTF-8 无 BOM 写入 API。Triggers: 乱码, 写文件, Set-Content, Out-File, UTF-8, BOM, 中文损坏, 读改写, 文件编码, 编码安全, 缺少.wxss, WXSS"
---

# PowerShell 写文件编码安全（全局）

## 事故背景

在中文 Windows（系统 ANSI 编码 = GBK）上，PowerShell 5.1 的文本读写命令默认按 **ANSI(GBK)** 处理。用它改写含中文的 UTF-8 文件会把中文变成乱码（如 `鎺掑簭`、`锟斤拷`、`U+FFFD`），且不可逆——曾因此损坏真实项目文件，需 `git checkout` 恢复后逐条重放全部改动。

## 行为规范

1. **写/改含中文的文本文件一律用 Write / Edit 工具**，由工具按 UTF-8 正确处理中文。
2. **命令行仅当确需写文件时**（如程序输出到文件）用**不带 BOM** 的显式 UTF-8 写入 API：
   ```powershell
   $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
   [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
   ```
   特别注意：`[System.Text.Encoding]::UTF8` 会写入 BOM，写源码请用上面的不带 BOM 写法（后果见「BOM 陷阱」）。读文件用 `Get-Content -Encoding UTF8`；核对内容用 Read 工具。
3. **写完即检**：改完含中文文件后用 Read 核对，或跑乱码检测（签名见「检测签名」节）；命中乱码立即用 Write/Edit 重写修复，修复后核对通过再提交。
4. 若项目有编码检查脚本/测试（如 `check-encoding.js`、`npm test` 含编码扫描），跑之。
5. **批量替换一律逐处用 Edit 工具做**，「替换表」仅作逐处编辑的核对清单。曾经的事故：把 `@{ p='x.wxml'; pairs=@( @('<text…','<view…') ) }` 这类嵌套数组放进 hashtable，再 `foreach ($pair in $e.pairs) { $c.Replace($pair[0], $pair[1]) }` —— PowerShell 把嵌套数组**展平**了，`$pair` 变成字符串，`$pair[0]`/`$pair[1]` 取到的是**首字符和第二个字符**，实际执行的是 `.Replace('<','t')`，把 5 个 WXML 全文的 `<` 换成字母且无任何报错。识别信号：替换后出现 `ttext`、`vview`、`t/view>` 这类「首字母重复 + 丢失 `<`」的畸形标签。发生后直接 `git checkout -- <files>` 还原，再用 Edit 逐处重放。

## 检测签名

以下内容仅作检测/排查用途，正文行为规范不复述：

- **替换被展平的畸形签名**（标签名首字母重复、`<` 丢失）：`rg -n "ttext |vview |t/view>|v/text>" <目录>`

- **会破坏 UTF-8 中文的命令**（PowerShell 5.1 默认 ANSI/GBK 写入）：`Set-Content`、`Out-File`、`Add-Content`、`内容 > 文件`、以及 `Get-Content -Raw` + 写回组合。
- **乱码签名**（UTF-8-as-GBK 误读常见连字）：
  ```powershell
  rg -n "锟斤拷|鎺掑|掑簭|缁撴|娴嬭|鐨勶|鍦ㄤ|鏄痯|\\uFFFD" <目录>
  ```

## BOM 陷阱

- `[System.Text.Encoding]::UTF8` 的 `GetPreamble()` 非空，`WriteAllText` 会写出 `EF BB BF`。JS/JSON 通常能容忍，但 **WXSS 带 BOM 会让微信开发者工具的「分包按需编译」解析失败**，报「缺少 .wxss 文件错误」——症状是**真机（完整构建）能打开、模拟器打不开**，报错文本里完全不提编码，极难定位。修复：去掉前 3 字节。
- 写入一律用不带 BOM 的编码：`New-Object System.Text.UTF8Encoding($false)`，或直接用 Write/Edit 工具。
- 检测签名（列出带 UTF-8 BOM 的源文件，命中即去掉前 3 字节）：
  ```powershell
  Get-ChildItem -Recurse -File -Include *.js,*.json,*.wxss,*.wxml,*.wxs,*.ts,*.md | Where-Object {
    $b = [System.IO.File]::ReadAllBytes($_.FullName)
    $b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF
  } | Select-Object -ExpandProperty FullName
  ```

## 恢复技巧（万一损坏）

1. `git checkout HEAD -- <file>` 恢复到提交版（若损坏前有未提交改动会丢失——先评估）。
2. 用 Read 工具读各段落，逐段用 Edit 工具重放丢失的改动（Edit 用精确 old/new 字符串）。
3. 全程用 Write/Edit 写该文件，不再经由命令行写文件命令。

## 红线兜底

- 含中文文本文件写/改统一走 Write/Edit 工具（UTF-8）；命令行写文件仅限程序输出且用**不带 BOM**的 `New-Object System.Text.UTF8Encoding($false)`，绝不用 `[System.Text.Encoding]::UTF8` 写源码。
- `.vbs` 启动脚本（如「启动工作台.vbs」）是唯一豁免：在中文 Windows 上必须 GBK/ANSI 保存，否则 VBScript 解析中文字符串会报错——刻意保持 ANSI，不要改成 UTF-8。
