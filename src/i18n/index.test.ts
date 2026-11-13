/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import i18n, { t } from '@/i18n';
import ptBR from '@/i18n/pt-BR.json';

describe('i18n', () => {
  it('is initialised in pt-BR', () => {
    expect(i18n.language).toBe('pt-BR');
  });
  it('resolves the Task 1 keys', () => {
    expect(t('pets.title')).toBe('Meus pets');
    expect(t('pets.add')).toBe('Adicionar pet');
    expect(t('pets.empty.title')).not.toBe('pets.empty.title');
    expect(t('pets.empty.description')).not.toBe('pets.empty.description');
  });
  it('returns the key for a missing translation (visible, not a crash)', () => {
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
  it('has no empty strings', () => {
    const walk = (o: unknown): void => {
      if (typeof o === 'string') expect(o.trim()).not.toBe('');
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(ptBR);
  });
  it('keeps accents intact (no ASCII-fied text)', () => {
    expect(t('pets.empty.description')).toMatch(/cão/);
  });
  it('every t("...") key used in src/ exists in pt-BR.json', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
      }
    };
    walk(path.resolve(__dirname, '..'));
    const missing: string[] = [];
    for (const f of files) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([^']+)'/g)) {
        // `count` lets plural keys (`key_one`, `key_other`) resolve.
        if (t(m[1], { count: 1 }) === m[1]) missing.push(`${path.basename(f)}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
