import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCache } from '../src/cache.js';
import * as config from '../src/config.js';
import * as format from '../src/format.js';
import * as math from '../src/math.js';
import * as safePath from '../src/safe-path.js';
import * as todos from '../src/todo-store.js';

const task = process.env.ECHOAI_EVAL_TASK_ID;

switch (task) {
  case 'eval-bugfix-divide-zero':
    assert.equal(math.divide(10, 2), 5);
    assert.throws(() => math.divide(10, 0), /zero|divide/i);
    break;
  case 'eval-bugfix-average-empty':
    assert.equal(math.average([]), 0);
    assert.equal(math.average([2, 4, 6]), 4);
    break;
  case 'eval-feature-percentile': {
    const values = [10, 30, 20, 40];
    assert.equal(math.percentile(values, 50), 20);
    assert.deepEqual(values, [10, 30, 20, 40]);
    assert.throws(() => math.percentile(values, 101), /percent|range/i);
    break;
  }
  case 'eval-refactor-todo-immutable': {
    const input = [{ id: '1', title: 'A', completed: false }];
    const output = todos.updateTodo(input, '1', { completed: true });
    assert.notEqual(output, input);
    assert.equal(input[0].completed, false);
    assert.equal(output[0].completed, true);
    break;
  }
  case 'eval-bugfix-todo-completed-count':
    assert.equal(todos.completedCount([{ completed: true }, { completed: false }, { completed: true }]), 2);
    break;
  case 'eval-feature-todo-filter': {
    const input = [{ completed: true }, { completed: false }];
    assert.equal(todos.filterTodos(input, 'all').length, 2);
    assert.equal(todos.filterTodos(input, 'active').length, 1);
    assert.equal(todos.filterTodos(input, 'completed').length, 1);
    break;
  }
  case 'eval-security-safe-path-traversal': {
    const root = process.cwd();
    assert.equal(safePath.resolveUserPath(root, 'src/math.js'), path.join(root, 'src/math.js'));
    assert.throws(() => safePath.resolveUserPath(root, '../secret.txt'), /outside|traversal|workspace/i);
    assert.throws(() => safePath.resolveUserPath(root, '/etc/passwd'), /outside|traversal|workspace/i);
    break;
  }
  case 'eval-security-redact-secrets':
    assert.equal(format.redactSecrets('api_key=sk-1234567890abcdef'), 'api_key=[REDACTED]');
    assert.equal(format.redactSecrets('hello'), 'hello');
    break;
  case 'eval-testfix-cache-ttl': {
    const cache = createCache();
    cache.set('a', 1, -1);
    assert.equal(cache.get('a'), undefined);
    cache.set('b', 2);
    assert.equal(cache.get('b'), 2);
    break;
  }
  case 'eval-feature-cache-delete': {
    const cache = createCache();
    cache.set('a', 1);
    assert.equal(cache.delete('a'), true);
    assert.equal(cache.delete('a'), false);
    assert.equal(cache.get('a'), undefined);
    break;
  }
  case 'eval-types-config-validation':
    assert.deepEqual(config.validateConfig({ provider: 'deepseek', budgetUsd: 10 }), { provider: 'deepseek', budgetUsd: 10 });
    assert.throws(() => config.validateConfig({ budgetUsd: 10 }), /provider/i);
    assert.throws(() => config.validateConfig({ provider: 'deepseek', budgetUsd: 0 }), /budget/i);
    break;
  case 'eval-docs-usage-section': {
    const readme = await readFile('README.md', 'utf8');
    assert.match(readme, /## Usage/i);
    assert.match(readme, /npm test|node scripts\/check\.mjs/i);
    break;
  }
  case 'eval-bugfix-slugify-spaces':
    assert.equal(format.slugify('  Hello,   Echo AI!! '), 'hello-echo-ai');
    break;
  case 'eval-feature-currency-format':
    assert.equal(format.formatCurrency(12345), '$123.45');
    assert.equal(format.formatCurrency(-50), '-$0.50');
    break;
  case 'eval-refactor-math-numeric-inputs':
    assert.equal(math.sum([1, 2, 3]), 6);
    assert.throws(() => math.sum([1, '2']), /number|finite/i);
    assert.throws(() => math.average([Number.NaN]), /number|finite/i);
    break;
  case 'eval-security-command-allowlist':
    assert.equal(safePath.isAllowedCommand('git status --short'), true);
    assert.equal(safePath.isAllowedCommand('rg "hello" .'), true);
    assert.equal(safePath.isAllowedCommand('rm -rf .'), false);
    assert.equal(safePath.isAllowedCommand('curl https://example.com'), false);
    break;
  case 'eval-feature-config-env':
    assert.deepEqual(
      config.configFromEnv({ ECHOAI_PROVIDER: 'kimi', ECHOAI_BUDGET_USD: '5' }),
      { provider: 'kimi', budgetUsd: 5 }
    );
    assert.throws(() => config.configFromEnv({ ECHOAI_PROVIDER: 'kimi', ECHOAI_BUDGET_USD: 'nope' }), /budget/i);
    break;
  case 'eval-bugfix-cache-clear-prefix': {
    const cache = createCache();
    cache.set('user:1', 1);
    cache.set('user:2', 2);
    cache.set('team:1', 3);
    assert.equal(cache.clearPrefix('user:'), 2);
    assert.equal(cache.get('user:1'), undefined);
    assert.equal(cache.get('team:1'), 3);
    break;
  }
  case 'eval-docs-security-note': {
    const readme = await readFile('README.md', 'utf8');
    assert.match(readme, /## Security/i);
    assert.match(readme, /traversal/i);
    assert.match(readme, /allowlist/i);
    break;
  }
  case 'eval-testfix-statistics-median': {
    const values = [5, 1, 10, 2];
    assert.equal(math.median(values), 3.5);
    assert.deepEqual(values, [5, 1, 10, 2]);
    assert.equal(math.median([1, 9, 3]), 3);
    break;
  }
  case 'eval-feature-math-clamp':
    assert.equal(math.clamp(5, 0, 10), 5);
    assert.equal(math.clamp(-1, 0, 10), 0);
    assert.equal(math.clamp(99, 0, 10), 10);
    break;
  case 'eval-feature-format-truncate':
    assert.equal(format.truncate('hello world', 5), 'hell\u2026');
    assert.equal(format.truncate('hi', 5), 'hi');
    break;
  case 'eval-feature-todo-toggle': {
    const input = [{ id: '1', completed: false }, { id: '2', completed: true }];
    const output = todos.toggleTodo(input, '1');
    assert.notEqual(output, input);
    assert.equal(input[0].completed, false);
    assert.equal(output[0].completed, true);
    assert.equal(output[1].completed, true);
    break;
  }
  case 'eval-feature-cache-keys': {
    const cache = createCache();
    cache.set('a', 1);
    cache.set('b', 2, -1);
    const keys = cache.keys();
    assert.ok(keys.includes('a'));
    assert.ok(!keys.includes('b'));
    break;
  }
  case 'eval-refactor-config-merge': {
    const merged = config.mergeConfig({ provider: 'deepseek', budgetUsd: 5 }, { budgetUsd: 12 });
    assert.deepEqual(merged, { provider: 'deepseek', budgetUsd: 12 });
    assert.throws(() => config.mergeConfig({ provider: 'deepseek', budgetUsd: 5 }, { budgetUsd: 0 }), /budget/i);
    break;
  }
  default:
    throw new Error(`Unknown ECHOAI_EVAL_TASK_ID: ${task}`);
}

console.log(`ok ${task}`);
