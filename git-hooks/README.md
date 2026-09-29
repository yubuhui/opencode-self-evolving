# git-hooks（全局提交钩子）

本目录随 `~/.config/opencode` 版本化，通过全局 `core.hooksPath` 安装到本机所有 git 仓库。

## 安装（一次性）

```sh
git config --global core.hooksPath C:/Users/huang/.config/opencode/git-hooks
```

## 卸载

```sh
git config --global --unset core.hooksPath
```

## 行为

- `pre-commit` 对暂存区文档跑 `audit-docs.mjs --staged`：高置信墓碑描述（见 `docs-stale-audit` 技能判级）阻断提交，并输出修复指引；复查候选仅提示。
- 在全局配置库（本目录所在仓库）内提交时，加跑 `check-rules.mjs` 全套（L1 索引 / L2 白熊 / L3 乱码 / L4 文档审计）。
- fail-open：node 不可用或脚本缺失时打印警告并放行，避免影响其它仓库的日常提交。

## 覆盖关系与逃生口

- 仓库级 `core.hooksPath`（如 husky）优先于全局配置。
- 单次跳过：`git commit --no-verify`（钩子故障等例外场景，使用后在回复中说明）。
- 修改本目录文件立即对全部仓库生效，无需重装。

## 检查项

- 查看当前设置：`git config --global --get core.hooksPath`
- 手动预检（在目标仓库内）：`git hook run pre-commit`
- 临时放行误报：文档行内加 `docs-audit:allow`
