// check-rules.mjs L4（文档审计）集成测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = path.join(CONFIG_ROOT, 'check-rules.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'check-rules-l4-'));

const buildRoot = (agents) => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), agents, 'utf8');
  fs.mkdirSync(path.join(root, 'skills', 'demo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'INDEX.md'), '| demo | 演示技能 |\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'skills', 'demo', 'SKILL.md'),
    '---\nname: demo\ndescription: "演示。Triggers: 演示"\n---\n\n# Demo\n\n当前做法。\n',
    'utf8',
  );
  return root;
};

test('L4：含墓碑描述时 check-rules 失败并指出文件行', () => {
  const root = buildRoot('# AGENTS\n\n旧版用 Express 启动服务。\n');
  const r = spawnSync(process.execPath, [CHECK, root], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /L4 墓碑描述：AGENTS\.md:3/);
});

test('L4：干净语料通过且输出 0 高置信', () => {
  const root = buildRoot('# AGENTS\n\n当前做法：先创建再赋权。\n');
  const r = spawnSync(process.execPath, [CHECK, root], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /L4 文档审计: 0 高置信/);
});
