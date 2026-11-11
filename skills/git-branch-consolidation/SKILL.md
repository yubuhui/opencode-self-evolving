---
name: git-branch-consolidation
kind: runbook
review-by: 2027-06-30
description: "Git 分支合并/清理的安全流程：脏工作区下用 branch -f 快进而非 checkout+merge、先判定线性链与 worktree 占用、删 worktree 前验干净。Triggers: 合并分支, 合并到 main/master, 清理分支, 删除 worktree, git worktree remove, branch -f, 快进合并, fast-forward, 分支整理"
---

# Git 分支合并与清理

把一堆 feature 分支收敛到主线，并清理分支与 worktree。

<role>在不动用户未提交改动的前提下完成分支合并与清理</role>

## Steps

1. **先摸清关系，不猜。** 三条命令拿到全部事实：
   ```powershell
   git branch -a -v                          # 分支 + HEAD，`+` 前缀 = 被 worktree 占用
   git log --graph --oneline --decorate --all -30   # 判断是否线性链
   git branch --merged main; git branch --no-merged main
   git rev-list --left-right --count "main...$b"     # 逐分支 behind/ahead
   ```
   `behind=0` → 可快进；`ahead=0` → 该分支无独有提交，无需合并。

2. **线性链 = 零冲突快进。** 历史呈 `main → feat/A → feat/B → feat/C(HEAD)` 时，全部 feature 分支互为祖先，只需把主线移到最顶端一个提交，`git merge` 不会产生任何冲突。

3. **脏工作区走「移动引用」这条路。** `checkout` + `merge` 遇到未提交/未暂存改动会被 Git 拒绝，或把改动带到新分支；直接移动引用则完全不碰工作区：
   ```powershell
   git branch -f main feat/最新分支    # 快进，不产生合并提交，不动工作区
   git checkout main                   # 此时 main 与原 HEAD 同 commit，切换零风险
   ```
   切换前后各跑一次 `git status -sb` 对比，确认改动集未变。

4. **删除已合并分支用 `-d` 而非 `-D`。** `-d` 只删真正合并进当前分支的，未合并会报错——这是安全网。删当前分支会失败，先切走。

5. **删 worktree 前先验干净：**
   ```powershell
   git -C "<worktree路径>" status --porcelain    # 必须无输出才可删
   git worktree remove "<路径>"
   git branch -d opencode/xxx                   # worktree 释放后分支才可删
   git worktree prune                           # 清理失效登记
   ```
   有输出说明该 worktree 有未保存改动 → 停，先问用户。

6. **收尾核对：** `git worktree list`（仅剩主 worktree）、`git branch -a`（仅剩 main）、`git status -sb`（原有改动完整）、`git log --oneline -1` 指向预期提交。

## Key Commands / Patterns

```powershell
# 一次性拿到每个分支相对 main 的 behind/ahead
foreach ($b in @('feat/a','feat/b')) { $c = git rev-list --left-right --count "main...$b"; Write-Output "$b : $c" }

# 确认快进合法（不产生合并提交）
git merge-base --is-ancestor main feat/最新分支; Write-Output $LASTEXITCODE   # 0 = 可快进
```

## Notes

- **主线名先确认再动手。** 用户说"合并到 master"而仓库只有 `main` 时（`init.defaultBranch` 可能是 `main`，`git remote -v` 可能为空），先确认是"用现有 main"还是"新建 master"——新建等于分叉命名，会把 `main` 留在旧提交上。
- **多分支仓库要分开看。** 项目若有嵌套的独立 `.git`（子目录独立仓库），它不在根仓库合并范围内，操作后单独确认其状态未被波及。
- **`worktree list` 目录名 ≠ 分支名**，按路径删，别按名字猜。
- **worktree 根目录下可能残留同 session 的空目录**，也可能有**属于其他 session 的活跃 worktree**（如 `opencode/worktree/<hash>/lucky-otter`）——不在本仓库 `git worktree list` 里的目录一律不动。
- 分支删除后仍在 `git reflog` 中，短期可恢复；但已 push 到远程的分支才真正安全，本地无远程时清理前先确认提交已被主线包含。
- push 前先跑 `git remote -v`：有远程才显式 push；无远程时清理只落在本地 reflog 里，短期可恢复。