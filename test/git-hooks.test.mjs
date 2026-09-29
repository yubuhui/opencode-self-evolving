// git-hooks/pre-commit 集成测试：临时仓库真跑 git commit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOK_DIR = path.join(CONFIG_ROOT, 'git-hooks');
const HOOKS_PATH = HOOK_DIR.split(path.sep).join('/');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'git-hooks-test-'));
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' });

const mkRepo = () => {
  const d = tmp();
  git(['init', '-q'], d);
  git(['config', 'user.email', 'test@example.com'], d);
  git(['config', 'user.name', 'test'], d);
  git(['config', 'commit.gpgsign', 'false'], d);
  return d;
};

const commit = (d, extra = []) => {
  try {
    git(['-c', `core.hooksPath=${HOOKS_PATH}`, 'commit', '-q', ...extra, '-m', 'msg'], d);
    return { ok: true, out: '' };
  } catch (e) {
    return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

test('pre-commit：干净提交放行，墓碑文档被拦截且不产生提交', () => {
  const d = mkRepo();
  fs.writeFileSync(path.join(d, 'AGENTS.md'), '# AGENTS\n\n当前做法：先创建再赋权。\n', 'utf8');
  git(['add', '-A'], d);
  assert.equal(commit(d).ok, true, '干净提交应放行');
  const before = git(['rev-list', '--count', 'HEAD'], d).trim();

  fs.writeFileSync(path.join(d, 'notes.md'), '旧版用 Express 启动服务。\n', 'utf8');
  git(['add', 'notes.md'], d);
  const blocked = commit(d);
  assert.equal(blocked.ok, false, '墓碑文档应被拦截');
  assert.match(blocked.out, /pre-commit/);
  assert.equal(git(['rev-list', '--count', 'HEAD'], d).trim(), before, '拦截后提交数不应变化');

  fs.writeFileSync(path.join(d, 'notes.md'), '当前用内置 http 服务启动。\n', 'utf8');
  git(['add', 'notes.md'], d);
  assert.equal(commit(d).ok, true, '修复后应放行');
});

test('pre-commit：--no-verify 为逃生口', () => {
  const d = mkRepo();
  fs.writeFileSync(path.join(d, 'a.md'), '当前做法。\n', 'utf8');
  git(['add', '-A'], d);
  assert.equal(commit(d).ok, true);

  fs.writeFileSync(path.join(d, 'bad.md'), '该接口不再支持分页。\n', 'utf8');
  git(['add', 'bad.md'], d);
  assert.equal(commit(d).ok, false, '先确认默认拦截');
  git(['-c', `core.hooksPath=${HOOKS_PATH}`, 'commit', '-q', '--no-verify', '-m', 'skip'], d);
  assert.match(git(['log', '--oneline'], d), /skip/);
});

test('pre-commit：暂存区无文档时快速放行', () => {
  const d = mkRepo();
  fs.writeFileSync(path.join(d, 'code.txt'), 'plain text\n', 'utf8');
  git(['add', '-A'], d);
  assert.equal(commit(d).ok, true);
});

test('pre-commit：仓库根 == 钩子配置根时联动 check-rules（模拟配置库）', () => {
  const fakeRoot = tmp();
  fs.mkdirSync(path.join(fakeRoot, 'git-hooks'));
  fs.copyFileSync(path.join(HOOK_DIR, 'pre-commit'), path.join(fakeRoot, 'git-hooks', 'pre-commit'));
  fs.writeFileSync(path.join(fakeRoot, 'audit-docs.mjs'), 'process.exitCode = 0;\n', 'utf8');
  fs.writeFileSync(
    path.join(fakeRoot, 'check-rules.mjs'),
    'import fs from "node:fs";\nfs.writeFileSync("check-rules-ran.flag", "1");\n',
    'utf8',
  );
  git(['init', '-q'], fakeRoot);
  git(['config', 'user.email', 'test@example.com'], fakeRoot);
  git(['config', 'user.name', 'test'], fakeRoot);
  git(['config', 'commit.gpgsign', 'false'], fakeRoot);
  fs.writeFileSync(path.join(fakeRoot, 'a.md'), '当前做法。\n', 'utf8');
  git(['add', 'a.md'], fakeRoot);
  const fakeHooks = path.join(fakeRoot, 'git-hooks').split(path.sep).join('/');
  git(['-c', `core.hooksPath=${fakeHooks}`, 'commit', '-q', '-m', 'msg'], fakeRoot);
  assert.ok(fs.existsSync(path.join(fakeRoot, 'check-rules-ran.flag')), '配置库内提交应联动 check-rules');
});
