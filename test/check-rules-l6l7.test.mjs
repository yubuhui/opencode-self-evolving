// check-rules.mjs L6（职责重叠候选）与 L7（红线相斥候选）回归测试：
// 两项只提醒、不改退出码；健康库应为 0 组。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = path.join(CONFIG_ROOT, 'check-rules.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'check-rules-l6l7-'));
const run = (root) => spawnSync(process.execPath, [CHECK, root], { encoding: 'utf8' });

const skill = ({ name, triggers, redline = '' }) =>
  [
    '---',
    `name: ${name}`,
    'kind: runbook',
    'review-by: 2099-12-31',
    `description: "演示技能。Triggers: ${triggers}"`,
    '---',
    '',
    `# ${name}`,
    '',
    '当前做法。',
    '',
    ...(redline === '' ? [] : ['## 红线兜底', '', redline, '']),
  ].join('\n');

const makeRoot = (skills) => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# AGENTS\n\n当前做法：先创建再赋权。\n', 'utf8');
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  for (const [name, text] of Object.entries(skills)) {
    fs.mkdirSync(path.join(root, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), text, 'utf8');
  }
  fs.writeFileSync(
    path.join(root, 'skills', 'INDEX.md'),
    Object.keys(skills).map((name) => `| ${name} | runbook | 演示 |`).join('\n') + '\n',
    'utf8',
  );
  return root;
};

test('L6：两个技能共享 ≥2 个触发词时提醒，但退出码仍为 0', () => {
  const r = run(makeRoot({
    alpha: skill({ name: 'alpha', triggers: '共享词一, 共享词二, 独有甲' }),
    beta: skill({ name: 'beta', triggers: '共享词一, 共享词二, 独有乙' }),
  }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L6 职责重叠: 1 组候选/);
  assert.match(r.stdout, /L6 职责重叠候选：alpha ↔ beta/);
});

test('L6：触发词不重叠时 0 组', () => {
  const r = run(makeRoot({
    alpha: skill({ name: 'alpha', triggers: '甲词, 乙词' }),
    beta: skill({ name: 'beta', triggers: '丙词, 丁词' }),
  }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L6 职责重叠: 0 组候选/);
});

test('L7：红线节对同一标识符一正一反时提醒，但退出码仍为 0', () => {
  const r = run(makeRoot({
    alpha: skill({ name: 'alpha', triggers: '甲词', redline: '- 不要给 Everyone 写权限。' }),
    beta: skill({ name: 'beta', triggers: '乙词', redline: '- 给 Everyone 写权限即可。' }),
  }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L7 红线相斥: 1 组候选/);
  assert.match(r.stdout, /L7 红线相斥候选：alpha 与 beta/);
});

test('L7：两边同为禁令时不算相斥', () => {
  const r = run(makeRoot({
    alpha: skill({ name: 'alpha', triggers: '甲词', redline: '- 不要给 Everyone 写权限。' }),
    beta: skill({ name: 'beta', triggers: '乙词', redline: '- 禁止给 Everyone 写权限。' }),
  }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L7 红线相斥: 0 组候选/);
});

test('健康库（无重叠、无红线节）两项均为 0 组', () => {
  const r = run(makeRoot({
    alpha: skill({ name: 'alpha', triggers: '甲词, 乙词' }),
    beta: skill({ name: 'beta', triggers: '丙词, 丁词' }),
  }));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L6 职责重叠: 0 组候选/);
  assert.match(r.stdout, /L7 红线相斥: 0 组候选/);
});
