/// <reference types="node" />
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const json = (p: string) => JSON.parse(read(p));

describe('app.json (Task 1, Step 2)', () => {
  const { expo } = json('app.json');

  it('has the display name and slug', () => {
    expect(expo.name).toBe('Vacinas do Pet');
    expect(expo.slug).toBe('petvaccines');
  });
  it('uses the same package id on Android and iOS', () => {
    expect(expo.android.package).toBe('com.simplifica.petvaccines');
    expect(expo.ios.bundleIdentifier).toBe('com.simplifica.petvaccines');
  });
  it('follows the system theme', () => {
    expect(expo.userInterfaceStyle).toBe('automatic');
  });
  it('does not ship template leftovers', () => {
    const raw = read('app.json');
    expect(raw).not.toMatch(/expo-badge|react-logo|tutorial-web/);
  });
  it('declares no network-related permissions or analytics plugins', () => {
    expect(JSON.stringify(expo)).not.toMatch(/analytics|firebase|sentry|admob/i);
  });
});

describe('app.json photo permissions (Task 7)', () => {
  const { expo } = json('app.json');
  const picker = expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');

  it('configures expo-image-picker with Portuguese texts that say the photos stay on the device', () => {
    expect(picker).toBeDefined();
    const { cameraPermission, photosPermission } = picker[1];
    expect(cameraPermission).toMatch(/c[âa]mera/i);
    expect(photosPermission).toMatch(/fotos/i);
    for (const text of [cameraPermission, photosPermission]) {
      expect(text).toMatch(/comprovante/i);
      expect(text).toMatch(/aparelho/i);
    }
  });

  it('does not ask for the microphone: no video is recorded', () => {
    expect(picker[1].microphonePermission).toBe(false);
  });
});

describe('tsconfig.json', () => {
  it('has strict mode enabled', () => {
    expect(json('tsconfig.json').compilerOptions.strict).toBe(true);
  });
});

describe('package.json', () => {
  const pkg = json('package.json');
  it('exposes test, lint and typecheck scripts', () => {
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.scripts.lint).toBe('expo lint');
    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
  });
  it('is GPL-3.0', () => {
    expect(pkg.license).toMatch(/^GPL-3\.0/);
  });
  it('does not add libraries outside the spec (no analytics/ads/network SDKs)', () => {
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(deps).not.toMatch(/firebase|sentry|amplitude|mixpanel|admob|axios|segment/i);
  });
  it('has the testing stack installed', () => {
    expect(pkg.devDependencies['jest-expo']).toBeDefined();
    expect(pkg.devDependencies['@testing-library/react-native']).toBeDefined();
  });
});

describe('template cleanup (Task 1, Step 1)', () => {
  it.each([
    'src/app/explore.tsx',
    'scripts/reset-project.js',
    'src/components/app-tabs.tsx',
    'src/components/themed-text.tsx',
    'src/constants/theme.ts',
  ])('%s was removed', (p) => {
    expect(fs.existsSync(path.join(root, p))).toBe(false);
  });
  it('preserves docs/', () => {
    expect(fs.existsSync(path.join(root, 'docs/superpowers/plans/2026-11-12-pet-vaccines-mvp.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'docs/superpowers/specs/2026-11-12-pet-vaccines-design.md'))).toBe(true);
  });
});

describe('eas.json (Task 1, Step 8)', () => {
  it('has development, preview and production profiles', () => {
    const { build } = json('eas.json');
    expect(Object.keys(build)).toEqual(expect.arrayContaining(['development', 'preview', 'production']));
    expect(build.development.developmentClient).toBe(true);
  });
});

describe('ci.yml (Task 1, Step 8)', () => {
  const ci = read('.github/workflows/ci.yml');
  it('runs on pull requests and on main', () => {
    expect(ci).toMatch(/pull_request/);
    expect(ci).toMatch(/branches:\s*\[main\]/);
  });
  it.each(['npm ci', 'npm run lint', 'npm run typecheck', 'npm test'])('runs %s', (cmd) => {
    expect(ci).toContain(cmd);
  });
});

describe('open-source files (Task 1, Step 7)', () => {
  it.each([
    'LICENSE',
    'README.md',
    'README.en.md',
    'CONTRIBUTING.md',
    'CONTRIBUTING.en.md',
    'CODE_OF_CONDUCT.md',
    '.github/ISSUE_TEMPLATE/bug.yml',
    '.github/ISSUE_TEMPLATE/feature.yml',
    '.github/ISSUE_TEMPLATE/catalog-vaccine.yml',
    '.github/pull_request_template.md',
  ])('%s exists and is not empty', (p) => {
    expect(read(p).trim().length).toBeGreaterThan(50);
  });

  it('LICENSE is the full GPLv3 text', () => {
    const lic = read('LICENSE');
    expect(lic).toContain('GNU GENERAL PUBLIC LICENSE');
    expect(lic).toContain('Version 3, 29 June 2007');
    expect(lic).toContain('END OF TERMS AND CONDITIONS');
    expect(lic).toContain('How to Apply These Terms to Your New Programs');
    expect(lic.split('\n').length).toBeGreaterThanOrEqual(670);
  });

  it('README pair links to each other at the top', () => {
    expect(read('README.md').split('\n').slice(0, 5).join('\n')).toContain('README.en.md');
    expect(read('README.en.md').split('\n').slice(0, 5).join('\n')).toContain('README.md');
  });
  it('CONTRIBUTING pair links to each other at the top', () => {
    expect(read('CONTRIBUTING.md').split('\n').slice(0, 5).join('\n')).toContain('CONTRIBUTING.en.md');
    expect(read('CONTRIBUTING.en.md').split('\n').slice(0, 5).join('\n')).toContain('CONTRIBUTING.md');
  });
  it('CONTRIBUTING covers run, commits, catalog proposals and translation', () => {
    const c = read('CONTRIBUTING.md');
    expect(c).toMatch(/Conventional Commits/);
    expect(c).toMatch(/[Pp]ropor uma vacina/);
    expect(c).toMatch(/[Tt]raduzir/);
    expect(c).toMatch(/npm (install|ci)/);
    expect(c).toMatch(/npm test|npx jest/);
  });
  it('README links point to existing local files', () => {
    for (const file of ['README.md', 'README.en.md', 'CONTRIBUTING.md', 'CONTRIBUTING.en.md']) {
      const links = [...read(file).matchAll(/\]\(((?!https?:|#|mailto:)[^)\s]+)\)/g)].map((m) => m[1]);
      for (const l of links) {
        expect({ file, link: l, exists: fs.existsSync(path.join(root, l.split('#')[0])) }).toEqual({
          file,
          link: l,
          exists: true,
        });
      }
    }
  });
  it('issue templates are valid-looking YAML forms with name and description', () => {
    for (const f of ['bug', 'feature', 'catalog-vaccine']) {
      const y = read(`.github/ISSUE_TEMPLATE/${f}.yml`);
      expect(y).toMatch(/^name:/m);
      expect(y).toMatch(/^description:/m);
      expect(y).toMatch(/^body:/m);
    }
  });
});
