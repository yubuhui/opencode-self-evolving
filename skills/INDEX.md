# Skills Index

| Skill | Description |
|-------|-------------|
| android-apk-download-verify | 下载安卓 APK 并核验完整性：豌豆荚 /download/dot 302 直链、AXML 包名版本、apksig 扁平 chunk v2 摘要 + openssl 验签 |
| auto-skill-creator | 任务内自我进化：把已验证、会复发的做法沉淀为 DSH 技能，更新过时条目并保持技能库精简 |
| docs-stale-audit | 文档/技能改动后的墓碑描述审计闭环：audit-docs.mjs --changed/--staged、判级与豁免、git 钩子拦截 |
| dsh-turn-failure-diagnosis | DeepSeek Harness 每轮立即失败排查：解压 session.v4.jsonl.zstd 读 turn/end 错误，修 persona 里非法的 {{cwd}} 等提示词变量 |
| git-branch-consolidation | Git 分支合并/清理安全流程：脏工作区用 branch -f 快进而非 checkout+merge、线性链判定、删 worktree 前验干净 |
| opencode-oauth-context-cap | OpenCode V2 ChatGPT OAuth 上下文限额排查：/api/model 看生效 400k/272k，区分客户端目录与官方百万规格、端点真实能力 |
| opencode-share-kit | 将 opencode 自我进化/开发规范配置打包成可分享仓库（脱敏密钥 + 安装脚本 + README） |
| phased-refactor-and-report | 大型改造分阶段实现、按风险验证、git 提交与五要素报告，明确待人工体验项 |
| plan-review | 涉规范/红线/技能体系的改造由子代理出计划、主代理按硬清单复核；普通大型改造走 DSH 原生 plan mode |
| powershell-utf8-safety | 写/改含中文文件一律用 Write/Edit（UTF-8）；命令行写文件用显式 UTF-8 API，乱码检测签名见技能 |
| quality-baseline | 通用质量五原则；明确契约客观核对，主观视觉与体验交人工，测试按风险选择 |
| test-verification | 轻量测试总控：直接路径优先、按风险追加、运行信号与证据判定完成；界面/场景方法在 references |
| white-bear-safe-rules | 白熊安全规则写作：禁令必配正面替代、行为指令与检测信息分离、正面先行红线兜底 |
| windows-openssh-server | 在 Windows（含家庭版）真正跑起 OpenSSH 服务端并可被其它设备登录：DISM 装能力绕开 0x80040154、服务 1067 按 SYSTEM 上下文主机密钥 ACL 定位、计划任务+.cmd wrapper 替代服务、客户端填写与「端口监听+认证应答」验证证据 |
