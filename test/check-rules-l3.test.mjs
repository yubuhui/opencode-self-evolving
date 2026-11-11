// check-rules.mjs L3（乱码检测）回归测试：
//   1) 正则不得带 /g（.test() 的 lastIndex 会跨文件残留，导致隔文件漏报）
//   2) 替换字符 \uFFFD 必须命中（旧规则写的是字面量 "U+FFFD"，匹配不到真字符）
//   3) 输出真实命中数，不再是写死的 0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = path.join(CONFIG_ROOT, 'check-rules.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'check-rules-l3-'));
const run = (root) => spawnSync(process.execPath, [CHECK, root], { encoding: 'utf8' });

const SKILL = (body) =>
  `---\nname: demo\nkind: runbook\nreview-by: 2099-12-31\ndescription: "演示。Triggers: 演示"\n---\n\n# Demo\n\n${body}\n`;

const makeRoot = (bodies) => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# AGENTS\n\n当前做法：先创建再赋权。\n', 'utf8');
  fs.mkdirSync(path.join(root, 'skills'), { recursive: true });
  const rows = [];
  bodies.forEach((body, index) => {
    const name = `demo${index}`;
    fs.mkdirSync(path.join(root, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), SKILL(body), 'utf8');
    rows.push(`| ${name} | runbook | 演示 |`);
  });
  fs.writeFileSync(path.join(root, 'skills', 'INDEX.md'), rows.join('\n') + '\n', 'utf8');
  return root;
};

test('L3：同一乱码签名在两个文件都命中（防 /g lastIndex 隔文件漏报）', () => {
  const r = run(makeRoot(['当前做法。锟斤拷', '当前做法。锟斤拷']));
  assert.equal(r.status, 1);
  const hits = [...r.stdout.matchAll(/L3 乱码：/g)].length;
  assert.equal(hits, 2, r.stdout);
});

test('L3：替换字符 U+FFFD 命中', () => {
  const r = run(makeRoot(['当前做法。\uFFFD']));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /L3 乱码：skills[\\/]demo0[\\/]SKILL\.md/);
});

test('L3：干净文件零命中且输出真实统计', () => {
  const r = run(makeRoot(['当前做法：先创建再赋权。', '当前做法：复用共享组件。']));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L3 乱码: 0 命中 \/ \d+ 文件/);
});
