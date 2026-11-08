// check-rules.mjs — opencode 自我进化系统规则体检
// 检查四项，任一失败退出码非 0：
//   L1 索引一致性：skills/ 目录 <-> INDEX.md 双向一致（孤儿技能 / 悬空条目）
//   L2 白熊安全   ：负面指令只允许出现在「红线兜底」节内，正文须正面引导（排除代码块/行内代码）
//   L3 乱码检测   ：UTF-8-as-GBK 常见乱码签名零命中
//   L4 文档审计   ：墓碑描述高置信零命中（复用 audit-docs.mjs 的 RULES/auditText）
// 用法：node check-rules.mjs [目录]   （默认取脚本所在目录，即全局配置根）
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditText } from './audit-docs.mjs';

const root = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.dirname(fileURLToPath(import.meta.url));

const NEG_RE = /禁止|不得|严禁|绝不允许|不要|\bnever\b|\bdon't\b|\bmust not\b|\bshould not\b|\bdo not\b/g;
const POS_RE = /一律|应当|务必|先找|优先|先做|先拆|先列/g;
const REDLINE_MARK = /##\s*(红线|红线兜底|注意事项（红线）)/g;
const MOJIBAKE_RE = /锟斤拷|鎺掑|掑簭|缁撴|娴嬭|鐨勶|鍦ㄤ|鏄痯|镄勩|鍦ㄣ|U\+FFFD/g;

const codeStrip = (s) =>
  s
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');

const collect = (dir) => {
  const skills = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
  return skills
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, dir, d.name, 'SKILL.md')))
    .map((d) => d.name)
    .sort();
};

const read = (p) => fs.readFileSync(path.isAbsolute(p) ? p : path.join(root, p), 'utf8');

const indexNames = (content) => {
  const names = [];
  for (const line of content.split('\n')) {
    const m = line.match(/^\|\s*([a-z0-9-]*[a-z][a-z0-9-]*)\s*\|/);
    if (m) names.push(m[1]);
  }
  return names;
};

const failures = [];
const rows = [];

const report = (file, neg, pos, violations) => {
  rows.push({ file, neg, pos, violations });
  violations.forEach((v) => failures.push(`${file}: 正文出现负面指令「${v}」（红线兜底之外）`));
};

// —— L1 索引一致性 ——
const dirs = collect('skills');
const idx = indexNames(read(path.join('skills', 'INDEX.md')));
const orphans = dirs.filter((d) => !idx.includes(d));
const dangling = idx.filter((n) => !dirs.includes(n));
orphans.forEach((o) => failures.push(`L1 孤儿技能：skills/${o} 无 INDEX 条目`));
dangling.forEach((d) => failures.push(`L1 悬空条目：INDEX 含 ${d} 但无对应目录`));

// —— L2 白熊安全 ——
const targets = [
  'AGENTS.md',
  path.join('skills', 'INDEX.md'),
  ...dirs.map((d) => path.join('skills', d, 'SKILL.md')),
];

// 仓库内的 DSH 全局规则同样受白熊/乱码/墓碑约束（存在时纳入，CI 也能体检到）。
if (fs.existsSync(path.join(root, 'dsh', 'AGENTS.md'))) targets.push(path.join('dsh', 'AGENTS.md'));

// 默认根（本机规则库）体检时，把 DSH 用户级 AGENTS.md 一并纳入：
// DSH 每轮加载 ~/.dsh/AGENTS.md，它与共享库 AGENTS.md 同受白熊/乱码/墓碑约束。
// 传入显式根（测试或审计其他目录）时保持原行为。
if (process.argv[2] === undefined) {
  const home = os.homedir();
  const dshHome = process.env.DSH_HOME?.trim() || path.join(home, '.dsh');
  const agentsHome = process.env.DSH_AGENTS_HOME?.trim() || path.join(home, '.agents');
  for (const file of [path.join(dshHome, 'AGENTS.md'), path.join(agentsHome, 'AGENTS.md')]) {
    if (fs.existsSync(file) && !targets.includes(file)) targets.push(file);
  }
}
for (const file of targets) {
  const raw = read(file);
  const stripped = codeStrip(raw);
  const redIdx = stripped.search(REDLINE_MARK);
  const body = redIdx >= 0 ? stripped.slice(0, redIdx) : stripped;
  const negAll = [...stripped.matchAll(NEG_RE)].map((m) => m[0]);
  const negBody = [...body.matchAll(NEG_RE)].map((m) => m[0]);
  const pos = [...stripped.matchAll(POS_RE)].length;
  report(file, negAll.length, pos, negBody);
}

// —— L3 乱码检测 ——
for (const file of targets) {
  const raw = read(file);
  if (MOJIBAKE_RE.test(codeStrip(raw))) failures.push(`L3 乱码：${file} 命中乱码签名`);
}

// —— L4 文档审计（墓碑描述，复用 audit-docs.mjs）——
let l4High = 0;
let l4Candidates = 0;
for (const file of targets) {
  const audit = auditText(read(file));
  l4Candidates += audit.candidates.length;
  for (const h of audit.high) {
    l4High += 1;
    failures.push(`L4 墓碑描述：${file}:${h.line}「${h.word}」`);
  }
}

// —— 输出 ——
const w = (s, n) => s.padEnd(n, ' ');
console.log(w('文件', 48) + w('负面', 6) + w('正面', 6) + ' 状态');
for (const r of rows) {
  const ok = r.violations.length === 0;
  console.log(w(r.file, 48) + w(String(r.neg), 6) + w(String(r.pos), 6) + (ok ? 'ok' : 'FAIL'));
}
console.log('---');
console.log(`L1 索引: ${orphans.length + dangling.length} 问题`);
console.log(`L2 白熊: ${targets.length} 文件，正文负面 ${rows.reduce((a, r) => a + r.violations.length, 0)} 处`);
console.log(`L3 乱码: 0 期望`);
console.log(`L4 文档审计: ${l4High} 高置信 / ${l4Candidates} 复查候选`);
if (failures.length) {
  console.log('FAILURES:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('PASS');
}
