// check-rules.mjs L5（kind 归属 / catalog 预算 / review-by / env 档案 / INDEX Kind）集成测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = path.join(CONFIG_ROOT, 'check-rules.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'check-rules-l5-'));
const run = (root) => spawnSync(process.execPath, [CHECK, root], { encoding: 'utf8' });

const skill = ({ name = 'demo', kind = 'runbook', reviewBy = '2099-12-31', desc = '"演示。Triggers: 演示"' } = {}) => {
  const lines = ['---', `name: ${name}`];
  if (kind !== null) lines.push(`kind: ${kind}`);
  if (reviewBy !== null) lines.push(`review-by: ${reviewBy}`);
  if (desc !== null) lines.push(`description: ${desc}`);
  lines.push('---', '', '# Demo', '', '当前做法。', '');
  return lines.join('\n');
};

const makeRoot = ({ skills = {}, index, env = {} } = {}) => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# AGENTS\n\n当前做法：先创建再赋权。\n', 'utf8');
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  const names = Object.keys(skills);
  for (const name of names) {
    fs.mkdirSync(path.join(root, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), skills[name], 'utf8');
  }
  const rows = index ?? names.map((name) => `| ${name} | runbook | 演示 |`);
  fs.writeFileSync(path.join(root, 'skills', 'INDEX.md'), rows.length ? rows.join('\n') + '\n' : '', 'utf8');
  const envNames = Object.keys(env);
  if (envNames.length) {
    fs.mkdirSync(path.join(root, 'env'), { recursive: true });
    for (const name of envNames) fs.writeFileSync(path.join(root, 'env', name), env[name], 'utf8');
  }
  return root;
};

const ENV_OK = '---\nkind: inventory\nhost: DEMO\nupdated: 2026-01-01\nreview-by: 2099-12-31\n---\n\n# 档案\n';

test('L5：标注完整且入预算的树通过', () => {
  const root = makeRoot({ skills: { demo: skill() }, env: { 'host.md': ENV_OK } });
  const r = run(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L5 结构: 0 问题/);
  assert.match(r.stdout, /L3 乱码: 0 命中 \/ \d+ 文件/);
});

test('L5：缺 kind / 非法 kind / skills 下放 inventory 均失败', () => {
  const missing = run(makeRoot({ skills: { demo: skill({ kind: null }) } }));
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /L5 缺少 kind/);

  const invalid = run(makeRoot({ skills: { demo: skill({ kind: 'policy' }) } }));
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout, /L5 kind 取值非法/);

  const inventory = run(makeRoot({ skills: { demo: skill({ kind: 'inventory' }) } }));
  assert.equal(inventory.status, 1);
  assert.match(inventory.stdout, /L5 inventory 不是技能/);
});

test('L5：catalog 超字符与关键词超量分别失败', () => {
  const longDesc = `"${'字'.repeat(200)} Triggers: 演示"`;
  const overChars = run(makeRoot({ skills: { demo: skill({ kind: 'discipline', desc: longDesc }) } }));
  assert.equal(overChars.status, 1);
  assert.match(overChars.stdout, /L5 catalog 超字符/);

  const words = Array.from({ length: 13 }, (_, i) => `词${i}`).join(', ');
  const overWords = run(makeRoot({ skills: { demo: skill({ kind: 'discipline', desc: `"演示。Triggers: ${words}"` }) } }));
  assert.equal(overWords.status, 1);
  assert.match(overWords.stdout, /L5 catalog 关键词超量/);
});

test('L5：触发段必须叫 Triggers:，review-by 必填且格式合法', () => {
  const segment = run(makeRoot({ skills: { demo: skill({ desc: '"演示。触发词: 演示"' }) } }));
  assert.equal(segment.status, 1);
  assert.match(segment.stdout, /L5 触发段须命名为 Triggers:/);

  const missing = run(makeRoot({ skills: { demo: skill({ reviewBy: null }) } }));
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /L5 缺少 review-by/);

  const badFormat = run(makeRoot({ skills: { demo: skill({ reviewBy: 'next-year' }) } }));
  assert.equal(badFormat.status, 1);
  assert.match(badFormat.stdout, /L5 review-by 须为 yyyy-mm-dd/);
});

test('L5：review-by 过期只提醒、不改退出码', () => {
  const root = makeRoot({ skills: { demo: skill({ reviewBy: '2000-01-01' }) } });
  const r = run(root);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /review-by 已过期，候选归档/);
});

test('L5：扁平技能文件、INDEX Kind 不一致、discipline 超上限均失败', () => {
  const flat = makeRoot({ skills: { demo: skill() } });
  fs.writeFileSync(path.join(flat, 'skills', 'flat.md'), '# flat\n', 'utf8');
  const flatRun = run(flat);
  assert.equal(flatRun.status, 1);
  assert.match(flatRun.stdout, /L5 技能须用目录形式/);

  const mismatch = run(makeRoot({ skills: { demo: skill() }, index: ['| demo | discipline | 演示 |'] }));
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stdout, /L5 INDEX Kind 与技能不一致/);

  const many = {};
  for (let i = 0; i < 9; i += 1) many[`demo${i}`] = skill({ name: `demo${i}`, kind: 'discipline' });
  const limit = run(makeRoot({ skills: many, index: Object.keys(many).map((n) => `| ${n} | discipline | 演示 |`) }));
  assert.equal(limit.status, 1);
  assert.match(limit.stdout, /L5 discipline 超过上限 8 条/);
});

test('L5：INDEX 缺 Kind 列只提醒；env 档案字段与 kind 缺失失败', () => {
  const noColumn = run(makeRoot({ skills: { demo: skill() }, index: ['| demo | 演示 |'] }));
  assert.equal(noColumn.status, 0, noColumn.stdout + noColumn.stderr);
  assert.match(noColumn.stdout, /INDEX 缺少 Kind 列/);

  const noHost = run(makeRoot({ env: { 'host.md': '---\nkind: inventory\nupdated: 2026-01-01\nreview-by: 2099-12-31\n---\n\n# 档案\n' } }));
  assert.equal(noHost.status, 1, noHost.stdout + noHost.stderr);
  assert.match(noHost.stdout, /L5 env 档案缺 host/);

  const wrongKind = run(makeRoot({ env: { 'host.md': '---\nkind: runbook\nhost: DEMO\nupdated: 2026-01-01\nreview-by: 2099-12-31\n---\n\n# 档案\n' } }));
  assert.equal(wrongKind.status, 1, wrongKind.stdout + wrongKind.stderr);
  assert.match(wrongKind.stdout, /L5 env 档案 kind 须为 inventory/);
});
