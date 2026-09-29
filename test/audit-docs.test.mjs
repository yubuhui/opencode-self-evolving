// audit-docs.mjs 测试 —— 高置信/候选/允许形式/豁免/排除/CLI/git 模式
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditText, collectDocFiles, auditStaged, auditChanged } from '../audit-docs.mjs';

const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT = path.join(CONFIG_ROOT, 'audit-docs.mjs');
const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'audit-docs-test-'));

// —— 高置信矩阵 ——
const HIGH_SAMPLES = [
  '旧版用 Express 启动服务。',
  '原实现直接读取全表。',
  '原方案通过轮询刷新。',
  '该入口以前是同步的。',
  '该字段曾是必填项。',
  '该接口不再支持分页。',
  '该命令已被移除。',
  '该功能已废弃。',
  'The API was removed in v2.',
  'Previously we used callbacks.',
];
for (const s of HIGH_SAMPLES) {
  test(`高置信命中：${s}`, () => {
    assert.ok(auditText(s).high.length >= 1, s);
  });
}

// —— 复查候选矩阵（只提示、不失败）——
const CAND_SAMPLES = [
  '以前同步请求，现在改为异步。',
  '该目录之前用轮询方式刷新。',
  '已彻底删除的临时文件。',
  '原本放在 utils 里。',
  '该 API 标记为 deprecated。',
];
for (const s of CAND_SAMPLES) {
  test(`复查候选命中：${s}`, () => {
    const r = auditText(s);
    assert.equal(r.high.length, 0, s);
    assert.ok(r.candidates.length >= 1, s);
  });
}

test('更长候选词优先于高置信短词（旧版本 / 旧版逻辑）', () => {
  const a = auditText('旧版本的行为。');
  assert.equal(a.high.length, 0);
  assert.ok(a.candidates.some((c) => c.word === '旧版本'));
  const b = auditText('旧版逻辑已迁移。');
  assert.equal(b.high.length, 0);
  assert.ok(b.candidates.some((c) => c.word === '旧版逻辑'));
  assert.ok(auditText('旧版用 Express。').high.length >= 1);
  assert.ok(auditText('该入口以前是同步的。').high.length >= 1);
});

test('允许形式：「曾经的坑 → 现修法」与「复发 + 怎么防」', () => {
  const a = auditText('曾经的坑：旧写法权限失效 → 现修法：先创建再赋权。');
  assert.ok(a.allowed.length >= 1);
  assert.equal(a.high.length, 0);
  assert.equal(a.candidates.length, 0);
  const b = auditText('该坑可能复发，怎么防：换模板后先回读 styleId。');
  assert.ok(b.allowed.length >= 1);
  assert.equal(b.high.length, 0);
});

test('剔除：围栏代码块 / 行内代码 / allow 标记', () => {
  assert.equal(auditText('```\n旧版用 Express 启动服务。\n```').high.length, 0);
  assert.equal(auditText('~~~sh\n旧版用 Express 启动服务。\n~~~').high.length, 0);
  assert.equal(auditText('`旧版用 Express 启动服务。`').high.length, 0);
  const r = auditText('旧版用 Express 启动服务。<!-- docs-audit:allow -->');
  assert.equal(r.high.length, 0);
  assert.ok(r.allowed.length >= 1);
});

test('引号内高置信词降级为候选', () => {
  const r = auditText('（如"旧版用 xx""原来是…"）');
  assert.equal(r.high.length, 0);
  assert.ok(r.candidates.length >= 2);
  assert.equal(auditText('「旧版用 Express。」').high.length, 0);
});

// —— 文件收集 ——
test('collectDocFiles：目录与文件排除规则', () => {
  const root = tmpDir();
  const write = (p, s = '内容') => {
    fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
    fs.writeFileSync(path.join(root, p), s, 'utf8');
  };
  write('a.md');
  write('AGENTS.md');
  write('node_modules/n.md');
  write('plans/p.md');
  write('backup-x/b.md');
  write('CHANGELOG.md');
  write('docs/HISTORY.md');
  write('sub/.venv/v.md');
  write('docs/guide.md');
  write('notes.bak-20260101');
  const files = collectDocFiles(root).map((p) => path.relative(root, p).split(path.sep).join('/'));
  assert.deepEqual(files, ['AGENTS.md', 'a.md', 'docs/guide.md']);
});

// —— CLI ——
test('CLI：墓碑命中退出码 1 并输出 file:line', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'bad.md'), '旧版用 Express 启动服务。\n', 'utf8');
  const r = spawnSync(process.execPath, [AUDIT], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /bad\.md:1/);
});

test('CLI：干净文档退出码 0，--json 可解析', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'ok.md'), '当前做法：先创建再赋权。\n', 'utf8');
  const r = spawnSync(process.execPath, [AUDIT, '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.high.length, 0);
  assert.equal(parsed.scanned, 1);
});

// —— git 模式 ——
const hasGit = (() => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
const git = (args, cwd) =>
  execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd, encoding: 'utf8' });
const mkRepo = () => {
  const d = tmpDir();
  git(['init', '-q'], d);
  git(['config', 'user.email', 'test@example.com'], d);
  git(['config', 'user.name', 'test'], d);
  git(['config', 'commit.gpgsign', 'false'], d);
  return d;
};

test('git：--staged 只读暂存区；--changed 覆盖工作区与未跟踪', { skip: !hasGit }, () => {
  const d = mkRepo();
  const file = path.join(d, 'AGENTS.md');
  fs.writeFileSync(file, '# AGENTS\n\n当前做法。\n', 'utf8');
  git(['add', '-A'], d);
  git(['commit', '-q', '-m', 'init'], d);

  fs.writeFileSync(file, '# AGENTS\n\n旧版用 Express 启动服务。\n', 'utf8');
  assert.equal(auditStaged(d).high.length, 0, '未 add 的改动不应进入 --staged');
  assert.ok(auditChanged(d).high.length >= 1, '--changed 应拦截工作区改动');

  git(['add', 'AGENTS.md'], d);
  assert.ok(auditStaged(d).high.length >= 1, 'add 后 --staged 应拦截');

  fs.writeFileSync(path.join(d, 'new.md'), '该接口不再支持分页。\n', 'utf8');
  const ch = auditChanged(d);
  assert.ok(ch.high.some((h) => h.file.split('\\').join('/') === 'new.md'));
});

// —— 仓库语料自检：规则体系文件零高置信（改坏语料即测试红）——
test('仓库语料零高置信（AGENTS.md + skills + git-hooks/README.md）', () => {
  const files = collectDocFiles(CONFIG_ROOT).filter((p) => {
    const rel = path.relative(CONFIG_ROOT, p).split(path.sep).join('/');
    return rel === 'AGENTS.md' || rel.startsWith('skills/') || rel === 'git-hooks/README.md';
  });
  const offenders = [];
  for (const f of files) {
    const r = auditText(fs.readFileSync(f, 'utf8'));
    for (const h of r.high) offenders.push(`${path.relative(CONFIG_ROOT, f)}:${h.line} ${h.word}`);
  }
  assert.deepEqual(offenders, []);
});
