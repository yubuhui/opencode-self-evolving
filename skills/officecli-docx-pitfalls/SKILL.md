---
name: officecli-docx-pitfalls
description: "用 officecli 生成 Word 报告时的关键坑：标题样式静默失效、TOC 目录域刷新失败、PDF 导出。Triggers: officecli, docx, Word 报告, 生成 Word, 目录域, TOC, styleId, heading 1, 导出 PDF, screenshot grid"
---

# officecli 生成 docx 报告踩坑

<role>用 officecli 生成中文 Word 报告时，避开样式 / 目录 / 导出的坑。</role>

## 可靠流程

1. `officecli create <file>.docx`
2. 内容一次性用 `officecli batch <file> --input ops.json`（JSON 数组，原子回滚：任一项失败则整批不落盘）
3. 页脚页码：`add <file> / --type footer --prop type=default --prop text="第 " --prop field=page`，再 `add "/footer[1]/p[1]" --type field --prop fieldType=numpages` 拼「第 X 页 / 共 Y 页」
4. `officecli validate <file>` 必须 `no errors found`
5. 视觉检查：`officecli view <file> screenshot --grid auto -o sheet.png`（Windows 走真实 Word 渲染），再 Read 该图
6. `officecli save` / `officecli close` 落盘

## 关键坑

### 1. `--prop style=Heading1` 会静默失效
- 表现：`add paragraph --prop style=Heading1` 返回成功，但读回 `style=Normal`；`view outline` 仍把它列为 `(Heading1)`（**误导**），导致 TOC 收集不到条目。
- 原因：模板内置标题样式的 styleId 未必是 `Heading1`。
- 正确做法：先 `officecli get <file> /styles --depth 1` 查实际 `styleId`（本机实测：`1`=Normal、`2`=heading 1、`3`=heading 2），再 `--prop styleId=2`。
- 出现 `WARNING: style 'X' not found in styles part — will be referenced as-is` = 没匹配上，必须换实际 id。

### 2. live TOC 易渲染成「错误！未找到目录项。」
- `add / --type toc` + `officecli refresh`（Word 后端）在标题样式未真正生效时，会把域结果写成该错误文本，发出后很难看。
- 稳妥替代：**静态目录**——手写章节清单，两级用 `listStyle=bullet` + `numLevel=0/1`，不依赖域，任何阅读器都能显示。
- 若坚持 live TOC：先确保标题用了真实 heading styleId，再 `set <file> /settings --prop updateFields=true`，并告知收件人在 Word 中按 F9 更新。

### 3. 导出 PDF
- `officecli view <file> pdf -o x.pdf` 需要 exporter 插件，未装时报 `No exporter plugin found for .docx → .pdf`。
- 替代（本机已装 Word）：用 Word COM 导出

```powershell
$w = New-Object -ComObject Word.Application; $w.Visible = $false; $w.DisplayAlerts = 0
$d = $w.Documents.Open("in.docx", $false, $true)
$d.SaveAs([ref]"out.pdf", [ref]17)   # 17 = wdFormatPDF
$d.Close($false); $w.Quit()
```

## Notes
- batch 的 JSON 用 Write 工具写文件（UTF-8），再 `officecli batch --input file.json`，避开 PowerShell 引号地狱。
- `view issues` 报的 `Mixed CJK/Latin punctuation`、`Body paragraph missing first-line indent` 对中英混排 / 块式文档多为误报，不必追。
- 只加自定义样式（`add /styles --type style`）可能引入 `uiPriority` 位置错误的 schema 报错；能靠内置样式就不要自建。
