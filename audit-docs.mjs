#!/usr/bin/env node
// audit-docs.mjs — 文档墓碑描述审计（docs-current-state-only 闭环）
//
// 用法：
//   node audit-docs.mjs [--changed|--staged] [--json] [路径...]
//     --changed  审计相对 HEAD 的改动文件（工作区 + 暂存区 + 未跟踪）
//     --staged   审计暂存区内容（供 git pre-commit 钩子调用）
//     默认       审计 cwd 下 AGENTS.md 与全部 *.md（跳过排除目录/历史文件）
//     路径参数   显式文件或目录（显式文件绕过排除规则，显式目录沿用排除规则）
//
// 退出码：0 通过（可含复查候选）/ 1 高置信墓碑命中 / 2 用法或 git 错误
// 豁免：行内注释 docs-audit:allow；允许形式：「曾经的坑 → 现修法」句式
//
// 单一来源：RULES / auditText 等同时被 check-rules.mjs（L4）与 git 钩子复用。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ALLOW_MARK = 'docs-audit:allow';

// 高置信：叙述已消失/被替换对象的旧形态，无「坑 → 现修法」价值
export const HIGH_RULES = [
  { id: '旧版', re: /旧版(?!本)/g },
  { id: '原实现/原方案', re: /原(?:实现|方案|先是|来是|来用|来叫)/g },
  { id: '以前是/曾是/旧称', re: /以前是|曾是|曾用名|旧称/g },
  { id: '不再X', re: /不再(?:支持|使用|提供|需要|维护|推荐|生效|可用|返回)/g },
  { id: '已移除/废弃', re: /已(?:被)?(?:移除|废弃|弃用|下线|停用)/g },
  { id: 'EN previously/used to/no longer', re: /\b(?:no longer|used to|previously)\b/gi },
  { id: 'EN was removed/replaced/deleted', re: /\bwas (?:removed|replaced|deleted)\b/gi },
];

// 复查候选：过去时痕迹，可能仍有当前价值（人工判断）
export const WARN_RULES = [
  { id: '曾经/以前', re: /曾经|以前/g },
  { id: '之前用/是', re: /之前(?:用|是)/g },
  { id: '旧形态', re: /历史(?:上|遗留)|旧版本|旧写法|旧做法|旧实现|旧接口|旧方案|旧界面|旧 ?UI|旧字段|旧命令|旧版逻辑/g },
  { id: '已删除/替换', re: /已(?:彻底)?删(?:除|去|掉)|已(?:被)?(?:替换|更换)/g },
  { id: '原来/原本', re: /原来(?:的|版|有)|原本/g },
  { id: '重命名/迁移前', re: /重命名|更名|改名|迁移前/g },
  { id: 'deprecated', re: /\bdeprecated\b/gi },
];

export const RULES = { high: HIGH_RULES, warn: WARN_RULES };

// 允许形式：同一行同时含「坑线索」与「修法线索」
const ALLOWED_PAST = /曾经的坑|复发|防回归/;
const ALLOWED_FIX = /→|现修法|怎么防|判定方法/;
const isAllowedForm = (s) => ALLOWED_PAST.test(s) && ALLOWED_FIX.test(s);

const QUOTE_PAIRS = [
  ['「', '」'],
  ['“', '”'],
  ['‘', '’'],
  ['"', '"'],
  ["'", "'"],
];

const quoteSpans = (line) => {
  const spans = [];
  for (const [open, close] of QUOTE_PAIRS) {
    let idx = 0;
    for (;;) {
      const s = line.indexOf(open, idx);
      if (s < 0) break;
      const e = line.indexOf(close, s + 1);
      if (e < 0) break;
      spans.push([s, e + 1]);
      idx = e + 1;
    }
  }
  return spans;
};

const collectMatches = (text, rules) => {
  const out = [];
  for (const rule of rules) {
    for (const m of text.matchAll(rule.re)) out.push(m);
  }
  return out.sort((a, b) => a.index - b.index || b[0].length - a[0].length);
};

const rec = (line, word, text) => ({ line, word, text: text.trim().slice(0, 160) });

/**
 * 审计一段文本，返回 { high, candidates, allowed }，条目为 { line, word, text }。
 */
export function auditText(text) {
  const out = { high: [], candidates: [], allowed: [] };
  const lines = String(text).split(/\r?\n/);
  let inFence = false;
  let fenceChar = '';
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence[1][0];
      } else if (fence[1][0] === fenceChar) {
        inFence = false;
      }
      continue;
    }
    if (inFence) continue;
    if (raw.includes(ALLOW_MARK)) {
      out.allowed.push(rec(i + 1, ALLOW_MARK, raw));
      continue;
    }
    // 行内代码置空（保留长度以维持索引位置）
    const stripped = raw.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length));
    if (isAllowedForm(stripped)) {
      out.allowed.push(rec(i + 1, '坑→现修法', raw));
      continue;
    }
    const spans = quoteSpans(stripped);
    const inQuote = (idx) => spans.some(([s, e]) => idx >= s && idx < e);
    const highMatches = collectMatches(stripped, HIGH_RULES);
    const warnMatches = collectMatches(stripped, WARN_RULES);
    const usedWarn = new Set();
    const finalHigh = [];
    // 更长的候选词与高置信词同位置重叠时，按候选（更具体形态）处理
    for (const h of highMatches) {
      const longer = warnMatches.find((w) => w.index === h.index && w[0].length > h[0].length);
      if (longer) {
        usedWarn.add(longer);
        out.candidates.push(rec(i + 1, longer[0], raw));
        continue;
      }
      if (inQuote(h.index)) {
        out.candidates.push(rec(i + 1, h[0], raw));
        continue;
      }
      finalHigh.push(h);
    }
    for (const w of warnMatches) {
      if (usedWarn.has(w)) continue;
      const covered = finalHigh.some(
        (h) => h.index <= w.index && w.index + w[0].length <= h.index + h[0].length,
      );
      if (covered) continue;
      out.candidates.push(rec(i + 1, w[0], raw));
    }
    for (const h of finalHigh) out.high.push(rec(i + 1, h[0], raw));
  }
  return out;
}

// —— 文件收集 ——
const EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'vendor', '.venv', 'plans']);
const isExcludedDir = (name) => EXCLUDE_DIRS.has(name) || name.startsWith('backup-');
const isExcludedBasename = (name) =>
  /^changelog/i.test(name) || /^history/i.test(name) || /changes/i.test(name) || /\.bak-/.test(name) || /\.bak$/i.test(name);
export const isDocFile = (p) => {
  const b = path.basename(p);
  return b === 'AGENTS.md' || /\.md$/i.test(b);
};
const pathExcluded = (p) => {
  const parts = p.split(/[\\/]/);
  if (parts.slice(0, -1).some(isExcludedDir)) return true;
  return isExcludedBasename(parts[parts.length - 1]);
};

/** 收集目录下全部 AGENTS.md 与 *.md（跳过排除目录/历史文件），返回绝对路径数组。 */
export function collectDocFiles(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!isExcludedDir(e.name)) walk(path.join(dir, e.name));
      } else if (e.isFile() && isDocFile(e.name) && !isExcludedBasename(e.name)) {
        out.push(path.join(dir, e.name));
      }
    }
  };
  walk(root);
  return out.sort();
}

/** 用 [{file, text}] 跑审计，返回 { mode, scanned, high, candidates, allowed, warnings }。 */
export function auditEntries(entries, mode) {
  const result = { mode, scanned: entries.length, high: [], candidates: [], allowed: [], warnings: [] };
  for (const { file, text } of entries) {
    const r = auditText(text);
    for (const k of ['high', 'candidates', 'allowed']) {
      for (const item of r[k]) result[k].push({ file, ...item });
    }
  }
  return result;
}

// —— git 读取 ——
const git = (args, cwd) =>
  execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
const splitZ = (s) => s.split('\0').filter(Boolean);

export function stagedPaths(cwd = process.cwd()) {
  return splitZ(git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], cwd)).filter(
    (p) => isDocFile(p) && !pathExcluded(p),
  );
}

export function changedPaths(cwd = process.cwd()) {
  const set = new Set();
  let fellBack = false;
  try {
    splitZ(git(['diff', '--name-only', '-z', '--diff-filter=ACMR', 'HEAD'], cwd)).forEach((p) => set.add(p));
  } catch {
    fellBack = true;
    splitZ(git(['ls-files', '-z'], cwd)).forEach((p) => set.add(p));
  }
  try {
    splitZ(git(['ls-files', '--others', '--exclude-standard', '-z'], cwd)).forEach((p) => set.add(p));
  } catch {
    /* 未跟踪列表读取失败时忽略 */
  }
  return { paths: [...set].filter((p) => isDocFile(p) && !pathExcluded(p)), fellBack };
}

/** 审计暂存区文档内容（读 index，不读工作区）。 */
export function auditStaged(cwd = process.cwd()) {
  const entries = [];
  const warnings = [];
  for (const p of stagedPaths(cwd)) {
    try {
      entries.push({ file: p, text: git(['show', `:${p}`], cwd) });
    } catch {
      warnings.push(`读取暂存内容失败，已跳过：${p}`);
    }
  }
  return auditEntries(entries, 'staged');
}

/** 审计相对 HEAD 的改动文档（含未跟踪），内容取工作区。 */
export function auditChanged(cwd = process.cwd()) {
  const { paths, fellBack } = changedPaths(cwd);
  const entries = [];
  const warnings = [];
  if (fellBack) warnings.push('仓库尚无 HEAD，已回退为全量 tracked + untracked 扫描');
  for (const p of paths) {
    try {
      entries.push({ file: p, text: fs.readFileSync(path.join(cwd, p), 'utf8') });
    } catch {
      warnings.push(`读取工作区文件失败，已跳过：${p}`);
    }
  }
  return auditEntries(entries, 'changed');
}

// —— CLI ——
const relDisplay = (p) => {
  const r = path.isAbsolute(p) ? path.relative(process.cwd(), p) : p;
  return (r || p).split(path.sep).join('/');
};

const printHelp = () => {
  console.log('用法：node audit-docs.mjs [--changed|--staged] [--json] [路径...]');
  console.log('  --changed  审计相对 HEAD 的改动文件（工作区+暂存区+未跟踪）');
  console.log('  --staged   审计暂存区内容（供 git pre-commit 钩子调用）');
  console.log('  默认       审计 cwd 下 AGENTS.md 与全部 *.md');
  console.log('  豁免       行内 docs-audit:allow；允许形式「曾经的坑 → 现修法」');
  console.log('退出码：0 通过 / 1 高置信命中 / 2 用法或 git 错误');
};

const readEntriesForPaths = (paths) => {
  const entries = [];
  const warnings = [];
  for (const p of paths) {
    let stat;
    try {
      stat = fs.statSync(p);
    } catch {
      warnings.push(`路径不存在，已跳过：${p}`);
      continue;
    }
    const files = stat.isDirectory() ? collectDocFiles(p) : [p];
    for (const f of files) {
      try {
        entries.push({ file: f, text: fs.readFileSync(f, 'utf8') });
      } catch {
        warnings.push(`读取失败，已跳过：${f}`);
      }
    }
  }
  return { entries, warnings };
};

const printResult = (result, json) => {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const h of result.high) {
      console.log(
        `FAIL ${relDisplay(h.file)}:${h.line} 高置信「${h.word}」→ 删除该墓碑描述，或改写成「曾经的坑 → 现修法」；确需保留时行内加 ${ALLOW_MARK}`,
      );
    }
    for (const c of result.candidates) {
      console.log(
        `WARN ${relDisplay(c.file)}:${c.line} 复查候选「${c.word}」→ 人工判断：复发性坑写成「怎么防」保留，纯历史叙述删除`,
      );
    }
    for (const w of result.warnings) console.log(`NOTE ${w}`);
    const verdict = result.high.length ? 'FAIL' : 'PASS';
    console.log(
      `${verdict} 高置信 ${result.high.length} / 复查候选 ${result.candidates.length} / 豁免 ${result.allowed.length}（扫描 ${result.scanned} 文件）`,
    );
  }
};

export function main(argv = process.argv.slice(2)) {
  const paths = [];
  const modes = [];
  let json = false;
  for (const a of argv) {
    if (a === '--changed') modes.push('changed');
    else if (a === '--staged') modes.push('staged');
    else if (a === '--json') json = true;
    else if (a === '--help' || a === '-h') {
      printHelp();
      return 0;
    } else if (a.startsWith('-')) {
      console.error(`未知参数：${a}`);
      return 2;
    } else {
      paths.push(a);
    }
  }
  if (modes.length > 1 || (modes.length === 1 && paths.length)) {
    console.error('--changed / --staged / 显式路径三者互斥');
    return 2;
  }
  let result;
  try {
    if (modes[0] === 'staged') result = auditStaged(process.cwd());
    else if (modes[0] === 'changed') result = auditChanged(process.cwd());
    else {
      const roots = paths.length ? paths : [process.cwd()];
      const { entries, warnings } = readEntriesForPaths(roots);
      result = auditEntries(entries, 'dir');
      result.warnings.push(...warnings);
    }
  } catch (e) {
    console.error(`git 读取失败：${e.message}`);
    return 2;
  }
  printResult(result, json);
  return result.high.length ? 1 : 0;
}

const isMain = (() => {
  if (!process.argv[1]) return false;
  const arg = path.resolve(process.argv[1]);
  const self = path.resolve(fileURLToPath(import.meta.url));
  return process.platform === 'win32' ? arg.toLowerCase() === self.toLowerCase() : arg === self;
})();

if (isMain) {
  process.exitCode = main();
}
