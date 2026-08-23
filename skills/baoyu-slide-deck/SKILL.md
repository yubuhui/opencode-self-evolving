---
name: baoyu-slide-deck
description: 从 Markdown 文件生成专业幻灯片图片的 skill。支持多种预设风格（blueprint/chalkboard/corporate/minimal/sketch-notes 等）、自定义样式、目标受众和幻灯片数量。输出可导出为 PPTX 和 PDF。适用于：(1) 将文章/报告转为幻灯片，(2) 生成漫画风格的演示文稿，(3) 教育/商业/技术演示，(4) 快速原型设计 PPT 视觉稿。
---

# Baoyu Slide Deck - 幻灯片生成器

## 概述

从 Markdown 内容生成专业的幻灯片图片集。自动创建大纲、设计每张幻灯片的视觉样式，并生成高质量图片。

## 快速开始

### 基本用法

```bash
# 从 Markdown 文件生成幻灯片
/baoyu-slide-deck path/to/article.md

# 指定风格
/baoyu-slide-deck path/to/article.md --style corporate
/baoyu-slide-deck path/to/article.md --style chalkboard
/baoyu-slide-deck path/to/article.md --style minimal
/baoyu-slide-deck path/to/article.md --style blueprint
/baoyu-slide-deck path/to/article.md --style sketch-notes

# 指定受众
/baoyu-slide-deck path/to/article.md --audience executives
/baoyu-slide-deck path/to/article.md --audience students

# 指定幻灯片数量
/baoyu-slide-deck path/to/article.md --slides 15

# 仅生成大纲（不生成图片）
/baoyu-slide-deck path/to/article.md --outline-only

# 仅生成提示词
/baoyu-slide-deck path/to/article.md --prompts-only

# 从已有提示词生成图片
/baoyu-slide-deck path/to/article.md --images-only

# 重新生成指定幻灯片
/baoyu-slide-deck path/to/article.md --regenerate 3
/baoyu-slide-deck path/to/article.md --regenerate 2,5,8
```

## 预设风格

| 预设 | 说明 | 适用场景 |
|------|------|----------|
| `blueprint` | 默认，蓝图风格 | 架构设计、系统设计 |
| `chalkboard` | 黑板粉笔风 | 教育、教学演示 |
| `corporate` | 企业商务风 | 商业提案、公司介绍 |
| `minimal` | 极简风 | 高管简报、产品发布 |
| `sketch-notes` | 手绘笔记风 | 创意演示、漫画风格 |

## 自定义配置

可通过 YAML 配置文件自定义样式：

```yaml
# preferences.yaml
style: sketch-notes
language: zh
audience: students
target_slides: 12
```

### 可用配置项

- **style**: 预设风格名称或自定义风格
- **preferred_layout**: `sparse` | `balanced` | `dense` | `list` | `comparison` | `flow`
- **language**: `zh` | `en` | `ja` | `ko` | `auto`
- **preferred_image_backend**: 图片生成后端
- **generation_batch_size**: 批量生成数量（1-8）
- **watermark**: 水印配置（enabled/content/position）

### 自定义风格示例

```yaml
custom_styles:
  - name: comic-presentation
    description: "漫画风格演示文稿"
    color_palette:
      primary: ["#FF6B6B", "#4ECDC4", "#FFE66D"]
      background: "#FFF5E4"
      accents: ["#FF8E8E", "#7EC8E3"]
    visual_elements: "对话框、速度线、表情符号、漫画气泡"
    typography: "圆润手写字体，活泼"
    best_for: "轻松演示、教育、故事讲述"
```

## 漫画风格推荐配置

### 欧洲漫画风（Ligne Claire）
```bash
/baoyu-slide-deck article.md --style sketch-notes --layout balanced
```

### 日式漫画风
```bash
/baoyu-slide-deck article.md --style minimal --preferred_layout dense
```

### 黑板粉笔风（适合教育）
```bash
/baoyu-slide-deck article.md --style chalkboard --language zh
```

## 工作流程

1. **解析 Markdown** — 读取文章内容，理解结构和层次
2. **生成大纲** — 自动拆分幻灯片，确定每页主题
3. **设计视觉** — 根据风格预设为每张幻灯片生成设计指令
4. **生成图片** — 逐张渲染幻灯片图片
5. **导出** — 可导出为 PPTX 或 PDF 格式

## 注意事项

- 确保输入文件为有效 Markdown 格式
- 幻灯片数量建议 8-20 张，过多会影响质量
- 复杂排版建议先用 `--outline-only` 预览大纲
- 中文内容建议设置 `language: zh`
- 漫画风格推荐使用 `sketch-notes` 或自定义风格
