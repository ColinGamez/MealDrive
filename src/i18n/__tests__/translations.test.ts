import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { translations } from '../translations';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('translations', () => {
  const englishKeys = flattenKeys(translations.en).sort();

  for (const language of ['ja', 'ko'] as const) {
    it(`${language} has the same keys as English`, () => {
      assert.deepEqual(flattenKeys(translations[language]).sort(), englishKeys);
    });
  }

  it('does not contain unresolved string values', () => {
    for (const language of ['en', 'ja', 'ko'] as const) {
      for (const key of flattenKeys(translations[language])) {
        const value = key.split('.').reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)[part],
          translations[language],
        );
        assert.equal(typeof value, 'string', `${language}.${key} must resolve to a string`);
        assert.notEqual(value, '', `${language}.${key} must not be empty`);
      }
    }
  });

  it('resolves every literal translation key used by the UI', () => {
    const english = new Set(englishKeys);
    const unresolved = sourceFiles(path.join(process.cwd(), 'src'))
      .flatMap((file) => {
        const source = fs.readFileSync(file, 'utf8');
        return Array.from(source.matchAll(/\bt\(\s*['"]([^'"]+)['"]/g), (match) => ({
          file: path.relative(process.cwd(), file),
          key: match[1],
        }));
      })
      .filter(({ key }) => !english.has(key));

    assert.deepEqual(unresolved, []);
  });
});
