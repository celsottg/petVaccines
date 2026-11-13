/// <reference types="node" />
import fs from 'fs';
import path from 'path';

// Constraint: textos de interface só em src/i18n/pt-BR.json, nunca nas telas
// nem nos componentes. Cobre texto solto no JSX, props/opções de texto
// (title, placeholder, accessibilityLabel, accessibilityHint, ...) e Alert.

const TEXT_PROPS = [
  'title',
  'placeholder',
  'accessibilityLabel',
  'accessibilityHint',
  'aria-label',
  'label',
  'headerTitle',
  'headerBackTitle',
];

// Literal de string com ao menos uma letra (ignora '', '/', '#fff', '--').
const STR = String.raw`(?:'[^'\n]*[A-Za-zÀ-ÿ][^'\n]*'|"[^"\n]*[A-Za-zÀ-ÿ][^"\n]*"|` + '`[^`$\\n]*[A-Za-zÀ-ÿ][^`$\\n]*`)';
const propNames = TEXT_PROPS.join('|');

function stripComments(src: string) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Remove chamadas t('chave'): a chave é literal legítima.
function stripTranslationCalls(src: string) {
  return src.replace(/\bt\(\s*(?:'[^']*'|"[^"]*"|`[^`$]*`)\s*(?:,[^()]*)?\)/g, 't()');
}

// Corpo de uma chamada com parênteses balanceados, a partir do "(".
function callBody(src: string, openIdx: number) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(openIdx + 1, i);
  }
  return src.slice(openIdx + 1);
}

export function findHardcodedText(source: string): string[] {
  const src = stripTranslationCalls(stripComments(source));
  const found: string[] = [];

  // 1. Texto solto entre tags JSX: <Text>Olá</Text> (ignora "=>" e genéricos).
  for (const m of src.matchAll(/(?<![=-])>\s*([^<>{}\n]*[A-Za-zÀ-ÿ]{2,}[^<>{}\n]*?)\s*</g)) {
    found.push(`JSX text: ${m[1].trim()}`);
  }

  // 2. Props JSX: title="x", placeholder={'x'}, accessibilityLabel={`x`}
  const attr = new RegExp(String.raw`\b(${propNames})\s*=\s*(?:\{\s*)?(${STR})`, 'g');
  for (const m of src.matchAll(attr)) found.push(`prop ${m[1]}: ${m[2]}`);

  // 3. Propriedades de objeto: options={{ title: 'x' }}, { label: 'x' }
  const prop = new RegExp(String.raw`(?<![.\w])(${propNames})\s*:\s*(${STR})`, 'g');
  for (const m of src.matchAll(prop)) found.push(`option ${m[1]}: ${m[2]}`);

  // 4. Alert.alert / Alert.prompt: nenhum literal com texto, exceto style: '...'
  for (const m of src.matchAll(/\bAlert\s*\.\s*(?:alert|prompt)\s*\(/g)) {
    const body = callBody(src, m.index! + m[0].length - 1).replace(
      new RegExp(String.raw`\bstyle\s*:\s*${STR}`, 'g'),
      '',
    );
    for (const s of body.matchAll(new RegExp(STR, 'g'))) found.push(`Alert literal: ${s[0]}`);
  }

  return found;
}

describe('findHardcodedText (o detector em si)', () => {
  it.each([
    ['texto solto no JSX', '<Text>Salvar</Text>'],
    ['title como atributo', '<Button title="Salvar" />'],
    ['title entre chaves', "<Button title={'Salvar'} />"],
    ['placeholder', '<TextInput placeholder="Nome do pet" />'],
    ['accessibilityLabel', "<Pressable accessibilityLabel='Excluir foto' />"],
    ['accessibilityHint', '<Pressable accessibilityHint={"Abre a câmera"} />'],
    ['template literal sem interpolação', '<TextInput placeholder={`Nome`} />'],
    ['title em options de Stack.Screen', "<Stack.Screen options={{ title: 'Novo pet' }} />"],
    ['headerTitle em objeto', "const o = { headerTitle: 'Carteira' };"],
    ['Alert.alert com título e mensagem', "Alert.alert('Excluir pet', 'Tem certeza?');"],
    ['Alert.alert com botões literais', "Alert.alert(t('a'), t('b'), [{ text: 'Cancelar' }]);"],
    ['Alert.alert multilinha', "Alert.alert(\n  'Excluir',\n  t('x'),\n);"],
    ['Alert.prompt', "Alert.prompt('Nome');"],
    ['texto com acento', '<Text>Vacinação</Text>'],
  ])('detecta: %s', (_n, code) => {
    expect(findHardcodedText(code).length).toBeGreaterThan(0);
  });

  it.each([
    ['texto via t()', "<Text>{t('pets.title')}</Text>"],
    ['title via t()', "<Button title={t('common.save')} />"],
    ['placeholder via t() com opções', "<TextInput placeholder={t('x', { n: 1 })} />"],
    ['accessibilityLabel via variável', '<Pressable accessibilityLabel={label} />'],
    ['title de objeto via t()', "const o = { title: t('pets.title') };"],
    ['Alert só com t() e style', "Alert.alert(t('a'), t('b'), [{ text: t('c'), style: 'destructive' }]);"],
    ['style cancel no Alert', "Alert.alert(t('a'), undefined, [{ text: t('c'), style: 'cancel' }]);"],
    ['typography.label (acesso a membro)', "<Text style={[typography.label, { color: 'red' }]} />"],
    ['arrow function', 'const f = () => 1;'],
    ['literal só com símbolos', "<View testID='--' style={{ borderColor: '#fff' }} />"],
    ['comentário com texto', "// <Text>Salvar</Text> title: 'x'\n/* placeholder=\"x\" */"],
    ['Alert sem literais', 'Alert.alert(titulo, mensagem);'],
  ])('ignora: %s', (_n, code) => {
    expect(findHardcodedText(code)).toEqual([]);
  });
});

// Telas e componentes. Tasks 5 e 6 acrescentam FormField, ConfirmDialog, etc.
const root = path.resolve(__dirname, '../..');
const dirs = ['app', 'components'].map((d) => path.join(root, d)).filter((d) => fs.existsSync(d));
const files = dirs.flatMap((d) =>
  fs
    .readdirSync(d, { recursive: true, encoding: 'utf8' })
    .filter((f: string) => /\.tsx?$/.test(f) && !/\.test\./.test(f))
    .map((f: string) => path.join(d, f)),
);

describe('sem texto de interface escrito direto no código', () => {
  it('encontrou telas para verificar', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  it.each(files.map((f) => [path.relative(root, f), f]))('%s', (_rel, f) => {
    expect(findHardcodedText(fs.readFileSync(f, 'utf8'))).toEqual([]);
  });
});
