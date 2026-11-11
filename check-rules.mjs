// check-rules.mjs — opencode 自我进化系统规则体检
// 检查五项，任一失败退出码非 0：
//   L1 索引一致性：skills/ 目录 <-> INDEX.md 双向一致（孤儿技能 / 悬空条目）
//   L2 白熊安全   ：负面指令只允许出现在「红线兜底」节内，正文须正面引导（排除代码块/行内代码）
//   L3 乱码检测   ：UTF-8-as-GBK 常见乱码签名零命中（含 env/*.md）
//   L4 文档审计   ：墓碑描述高置信零命中（复用 audit-docs.mjs 的 RULES/auditText，含 env/*.md）
//   L5 结构       ：kind 归属与取值、catalog 字符/关键词预算（含 whenToUse）、review-by 生命周期、env 档案字段、INDEX Kind 列
//   L6 职责重叠   ：跨技能 Triggers 交集 ≥2 时提醒（人工判定合并或改写，不阻断）
//   L7 红线相斥   ：不同技能「红线兜底」节对同一标识符一正一反时提醒（弱检测，不阻断）
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
// 无 /g：避免 .test() 的 lastIndex 跨文件残留导致隔文件漏报；\uFFFD 匹配真正的替换字符，不用字面量 "U+FFFD"。
const MOJIBAKE_RE = /锟斤拷|鎺掑|搴|缁撴|娴嬭|鐨勶|鍦ㄤ|鏄痯|镄勩|鍦ㄣ|\uFFFD/;

// L5：kind 归属与 catalog 预算（字符口径 = description 整串去引号；关键词口径 = Triggers 段按逗号切分）
const KIND_CAP = {
  discipline: { chars: 180, words: 12 },
  runbook: { chars: 240, words: 15 },
  domain: { chars: 320, words: 25 },
};
const SKILL_KINDS = new Set(['discipline', 'runbook', 'domain']);
const DISCIPLINE_MAX = 8;
const TOTAL_CHARS_WARN = 3000;

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

const frontmatter = (raw) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  return m ? m[1] : '';
};

// 取单行字段值；剥掉首尾引号，与技能插件解析口径一致
const field = (header, key) => {
  const m = new RegExp(`(?:^|\\n)${key}:[ \\t]*(.*)`).exec(header);
  if (!m) return undefined;
  return m[1].trim().replace(/^["']|["']$/g, '');
};

const parseDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!m) return undefined;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? t : undefined;
};

const failures = [];
const warnings = [];
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

// env/ 环境档案（不是技能）：参与 L3/L4，且由 L5 校验字段
const envDirAbs = path.join(root, 'env');
const envFiles = fs.existsSync(envDirAbs)
  ? fs
      .readdirSync(envDirAbs, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => path.join('env', e.name))
  : [];

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
const docTargets = [...targets, ...envFiles];
let l3Checked = 0;
let l3Hits = 0;
for (const file of docTargets) {
  l3Checked += 1;
  if (MOJIBAKE_RE.test(codeStrip(read(file)))) {
    l3Hits += 1;
    failures.push(`L3 乱码：${file} 命中乱码签名`);
  }
}

// —— L4 文档审计（墓碑描述，复用 audit-docs.mjs）——
let l4High = 0;
let l4Candidates = 0;
for (const file of docTargets) {
  const audit = auditText(read(file));
  l4Candidates += audit.candidates.length;
  for (const h of audit.high) {
    l4High += 1;
    failures.push(`L4 墓碑描述：${file}:${h.line}「${h.word}」`);
  }
}

// —— L5 结构：kind 归属 / catalog 预算 / review-by / env 档案 / INDEX Kind 列 ——
let l5Problems = 0;
const l5fail = (msg) => {
  l5Problems += 1;
  failures.push(`L5 ${msg}`);
};
const warn = (msg) => warnings.push(msg);

const skillMeta = [];
let totalChars = 0;
for (const name of dirs) {
  const file = path.join('skills', name, 'SKILL.md');
  const header = frontmatter(read(file));
  const kind = field(header, 'kind');
  const reviewBy = field(header, 'review-by');
  const desc = field(header, 'description');
  skillMeta.push({ name, kind, reviewBy });

  if (kind === undefined) l5fail(`缺少 kind：skills/${name}/SKILL.md（允许 discipline/runbook/domain）`);
  else if (kind === 'inventory') l5fail(`inventory 不是技能：skills/${name}/SKILL.md 应移到 env/<host>.md`);
  else if (!SKILL_KINDS.has(kind)) l5fail(`kind 取值非法「${kind}」：skills/${name}/SKILL.md`);

  if (desc === undefined) {
    l5fail(`缺少 description：skills/${name}/SKILL.md`);
    continue;
  }
  totalChars += desc.length;
  const whenToUse = field(header, 'whenToUse');
  if (whenToUse !== undefined) {
    totalChars += whenToUse.length;
    if (whenToUse.length > 120) l5fail(`whenToUse 超字符（${whenToUse.length}>120）：skills/${name}/SKILL.md`);
  }
  const ti = desc.indexOf('Triggers:');
  if (ti < 0) l5fail(`触发段须命名为 Triggers:：skills/${name}/SKILL.md`);
  const words = ti < 0 ? 0 : desc.slice(ti + 9).split(',').filter((w) => w.trim().length > 0).length;
  const cap = KIND_CAP[kind];
  if (cap) {
    if (desc.length > cap.chars) l5fail(`catalog 超字符（${desc.length}>${cap.chars}）：skills/${name}/SKILL.md`);
    if (words > cap.words) l5fail(`catalog 关键词超量（${words}>${cap.words}）：skills/${name}/SKILL.md`);
  }

  if (kind === 'runbook' || kind === 'domain') {
    if (reviewBy === undefined) l5fail(`缺少 review-by：skills/${name}/SKILL.md`);
    else if (parseDate(reviewBy) === undefined) l5fail(`review-by 须为 yyyy-mm-dd：skills/${name}/SKILL.md`);
    else if (parseDate(reviewBy) < Date.now()) warn(`review-by 已过期，候选归档：skills/${name}（${reviewBy}）`);
  }
}

// 插件会加载 skills/<name>.md 扁平技能，而索引与体检只认目录：统一要求目录形式
for (const entry of fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'INDEX.md') {
    l5fail(`技能须用目录形式：skills/${entry.name} → 改为 skills/<name>/SKILL.md`);
  }
}

const disciplineCount = skillMeta.filter((s) => s.kind === 'discipline').length;
if (disciplineCount > DISCIPLINE_MAX) {
  l5fail(`discipline 超过上限 ${DISCIPLINE_MAX} 条（现 ${disciplineCount} 条）：先合并或归档再新增`);
}

if (totalChars > TOTAL_CHARS_WARN) warn(`catalog 合计 ${totalChars} 字符，超过告警线 ${TOTAL_CHARS_WARN}（逐条上限之和仍为准）`);

// INDEX 的 Kind 列必须与 SKILL.md 的 kind 一致
const indexContent = read(path.join('skills', 'INDEX.md'));
for (const line of indexContent.split('\n')) {
  const m = /^\|\s*([a-z0-9-]*[a-z][a-z0-9-]*)\s*\|(.*)$/.exec(line);
  if (!m) continue;
  const name = m[1];
  const meta = skillMeta.find((s) => s.name === name);
  if (meta === undefined) continue;
  const cells = m[2].split('|').map((s) => s.trim());
  while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  if (cells.length < 2 || cells[0] === '') {
    warn(`INDEX 缺少 Kind 列：${name}`);
    continue;
  }
  if (cells[0] !== meta.kind) l5fail(`INDEX Kind 与技能不一致：${name}（INDEX=${cells[0]} SKILL=${meta.kind}）`);
}

// env/*.md：环境档案字段齐全，kind 固定 inventory
for (const file of envFiles) {
  const header = frontmatter(read(file));
  if (field(header, 'kind') !== 'inventory') l5fail(`env 档案 kind 须为 inventory：${file}`);
  for (const key of ['host', 'updated', 'review-by']) {
    if (field(header, key) === undefined) l5fail(`env 档案缺 ${key}：${file}`);
  }
  const updated = field(header, 'updated');
  const reviewBy = field(header, 'review-by');
  if (updated !== undefined && parseDate(updated) === undefined) l5fail(`env updated 须为 yyyy-mm-dd：${file}`);
  if (reviewBy !== undefined) {
    const t = parseDate(reviewBy);
    if (t === undefined) l5fail(`env review-by 须为 yyyy-mm-dd：${file}`);
    else if (t < Date.now()) warn(`env review-by 已过期：${file}（${reviewBy}）`);
  }
}

// —— L6 职责重叠候选：跨技能 Triggers 交集 ——
const triggerList = (name) => {
  const desc = field(frontmatter(read(path.join('skills', name, 'SKILL.md'))), 'description') ?? '';
  const ti = desc.indexOf('Triggers:');
  return ti < 0 ? [] : desc.slice(ti + 9).split(',').map((item) => item.trim()).filter(Boolean);
};
let l6Count = 0;
const triggerMap = new Map(dirs.map((name) => [name, triggerList(name)]));
for (let i = 0; i < dirs.length; i += 1) {
  for (let j = i + 1; j < dirs.length; j += 1) {
    const leftSet = new Set(triggerMap.get(dirs[i]).map((item) => item.toLowerCase()));
    const shared = triggerMap.get(dirs[j]).filter((item) => leftSet.has(item.toLowerCase()));
    if (shared.length >= 2) {
      l6Count += 1;
      warn(`L6 职责重叠候选：${dirs[i]} ↔ ${dirs[j]} 共享 ${shared.length} 个触发词（${shared.join(' | ')}），人工判定合并或改写`);
    }
  }
}

// —— L7 红线相斥候选（弱检测）：同一标识符在不同技能的红线节里一正一反 ——
const REDLINE_RE = /##\s*(?:红线兜底|红线|注意事项（红线）)\s*\n([\s\S]*?)(?:\n##\s|$)/;
const NEG_CLAUSE_RE = /不要|不得|禁止|绝不|别(?![人的])|\bnever\b|\bdon't\b|\bmust not\b|\bshould not\b/i;
const TOKEN_RE = /`([^`]{2,40})`|([A-Za-z][A-Za-z0-9_.:\\/-]{2,})/g;

const redlineClauses = (name) => {
  const m = REDLINE_RE.exec(read(path.join('skills', name, 'SKILL.md')));
  if (!m) return [];
  return m[1]
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter((line) => line.length >= 8)
    .map((text) => {
      const tokens = new Set();
      const re = new RegExp(TOKEN_RE.source, 'g');
      let hit;
      while ((hit = re.exec(text)) !== null) {
        const token = (hit[1] ?? hit[2] ?? '').trim().toLowerCase();
        if (token.length >= 3) tokens.add(token);
      }
      return { text, tokens, negative: NEG_CLAUSE_RE.test(text) };
    });
};

let l7Count = 0;
const redlineMap = new Map(dirs.map((name) => [name, redlineClauses(name)]));
for (let i = 0; i < dirs.length; i += 1) {
  for (let j = i + 1; j < dirs.length; j += 1) {
    for (const leftClause of redlineMap.get(dirs[i])) {
      for (const rightClause of redlineMap.get(dirs[j])) {
        if (leftClause.negative === rightClause.negative) continue;
        const sharedToken = [...leftClause.tokens].find((token) => rightClause.tokens.has(token));
        if (sharedToken === undefined) continue;
        l7Count += 1;
        warn(`L7 红线相斥候选：${dirs[i]} 与 ${dirs[j]} 对 \`${sharedToken}\` 一正一反，人工判定（${dirs[i]}: ${leftClause.text.slice(0, 40)}… / ${dirs[j]}: ${rightClause.text.slice(0, 40)}…）`);
      }
    }
  }
}

// DSH 用户级规则漂移：~/.dsh/AGENTS.md 是库内 dsh/AGENTS.md 的复制件（非链接）
if (process.argv[2] === undefined) {
  const libraryCopy = path.join(root, 'dsh', 'AGENTS.md');
  const dshHome = process.env.DSH_HOME?.trim() || path.join(os.homedir(), '.dsh');
  const installed = path.join(dshHome, 'AGENTS.md');
  if (fs.existsSync(libraryCopy) && fs.existsSync(installed)) {
    const normalize = (s) => s.replace(/\r\n/g, '\n');
    if (normalize(fs.readFileSync(libraryCopy, 'utf8')) !== normalize(fs.readFileSync(installed, 'utf8'))) {
      warn('DSH 用户级规则未同步：~/.dsh/AGENTS.md 与库内 dsh/AGENTS.md 内容不一致，重新复制一份');
    }
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
console.log(`L3 乱码: ${l3Hits} 命中 / ${l3Checked} 文件`);
console.log(`L4 文档审计: ${l4High} 高置信 / ${l4Candidates} 复查候选`);
console.log(`L5 结构: ${l5Problems} 问题`);
console.log(`L6 职责重叠: ${l6Count} 组候选`);
console.log(`L7 红线相斥: ${l7Count} 组候选`);
if (warnings.length) {
  console.log(`提醒（不改退出码）:`);
  warnings.forEach((item) => console.log('  ! ' + item));
}
if (failures.length) {
  console.log('FAILURES:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('PASS');
}
