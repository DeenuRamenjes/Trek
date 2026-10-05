import * as fs from 'node:fs';
import * as path from 'node:path';

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p);
    return p.endsWith('.ts') && !/\.test\.ts$/.test(p) ? [p] : [];
  });
}

describe('domain purity', () => {
  const files = walk(path.join(__dirname, '..'));
  it('finds domain files', () => expect(files.length).toBeGreaterThan(0));
  it.each(files.map((f) => [path.relative(path.join(__dirname, '..'), f), f]))('%s has no forbidden imports', (_n, f) => {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).not.toMatch(/from ['"]react/);
    expect(src).not.toMatch(/from ['"]expo/);
    expect(src).not.toMatch(/from ['"]react-native/);
    expect(src).not.toMatch(/require\(\s*['"](react|expo)/);
    expect(src).not.toMatch(/^\s*import\s+['"](react|expo)/m);
    const dbImports = src.split('\n').filter((l) => /^\s*import\b/.test(l) && /from ['"](\.\.\/)+db/.test(l));
    for (const l of dbImports) expect(l).toMatch(/^\s*import type\b/);
  });
});
