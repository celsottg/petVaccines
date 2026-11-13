/// <reference types="node" />
import fs from 'fs';
import path from 'path';

// Constraint: texts de interface só em src/i18n/pt-BR.json, nunca nas telas.
const appDir = path.resolve(__dirname, '../../app');
const files = fs.readdirSync(appDir, { recursive: true, encoding: 'utf8' }).filter((f: string) => /\.tsx$/.test(f));

describe('no hardcoded UI text in screens', () => {
  it('found screens to check', () => expect(files.length).toBeGreaterThan(0));
  it.each(files)('%s has no literal text inside JSX', (f) => {
    const src = fs.readFileSync(path.join(appDir, f), 'utf8');
    const literals = [...src.matchAll(/>\s*([^<>{}\n]*[A-Za-zÀ-ÿ]{2,}[^<>{}\n]*)\s*</g)].map((m) => m[1].trim());
    expect(literals).toEqual([]);
  });
});
