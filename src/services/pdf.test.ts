import type { Pet, Vaccination } from '@/data/types';

import { buildCardHtml, CARD_LABEL_KEYS, pdfFileName } from './pdf';

const labels = Object.fromEntries(CARD_LABEL_KEYS.map((key) => [key, `L:${key}`]));
Object.assign(labels, {
  title: 'Carteira de vacinação',
  speciesDog: 'Cão',
  speciesCat: 'Gato',
  sexMale: 'Macho',
  sexFemale: 'Fêmea',
  reasonDeceased: 'Faleceu',
  archived: 'Carteira encerrada',
  generatedOn: 'Gerado em',
  photoMissing: 'Foto não incluída',
  notice: 'Registro declaratório feito pelo tutor. Não substitui a carteira de vacinação emitida pelo veterinário.',
});

const pet: Pet = {
  id: 'p1',
  name: 'Thor',
  species: 'dog',
  breed: 'SRD',
  sex: 'male',
  birthOn: '2020-05-17',
  photoFile: null,
  status: 'active',
  archivedReason: null,
  archivedOn: null,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
};

let seq = 0;
function vaccination(overrides: Partial<Vaccination> = {}): Vaccination {
  seq += 1;
  return {
    id: `v${seq}`,
    petId: 'p1',
    catalogId: null,
    vaccineName: 'Antirrábica',
    appliedOn: '2026-03-18',
    nextDueOn: '2027-03-18',
    batch: 'L123',
    brand: 'Zoetis',
    vetName: 'Ana Souza',
    vetLicense: 'CRMV-SP 12345',
    clinic: 'Clínica Pet',
    notes: 'Sem reação',
    remindersEnabled: true,
    createdAt: `2026-03-18T10:00:0${seq % 10}.000Z`,
    updatedAt: '2026-03-18T10:00:00.000Z',
    ...overrides,
  };
}

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const build = (overrides: Partial<Parameters<typeof buildCardHtml>[0]> = {}) =>
  buildCardHtml({ pet, vaccinations: [], photos: [], generatedOn: '2026-11-13', labels, ...overrides });

/** The text of each body row of the vaccination table, first cell only, in document order. */
const rowNames = (html: string) => [...html.matchAll(/<tr class="record">\s*<td>(.*?)<\/td>/g)].map((m) => m[1]);

describe('buildCardHtml', () => {
  it('contains the pet name and the title', () => {
    const html = build();
    expect(html).toContain('Thor');
    expect(html).toContain('Carteira de vacinação');
  });

  it('lists every application from the most recent to the oldest, whatever order it receives them in', () => {
    const list = [
      vaccination({ vaccineName: 'B 2025', appliedOn: '2025-01-10' }),
      vaccination({ vaccineName: 'D 2026', appliedOn: '2026-06-01' }),
      vaccination({ vaccineName: 'C 2025', appliedOn: '2025-09-01' }),
    ];
    expect(rowNames(build({ vaccinations: list }))).toEqual(['D 2026', 'C 2025', 'B 2025']);
    expect(rowNames(build({ vaccinations: [...list].reverse() }))).toEqual(['D 2026', 'C 2025', 'B 2025']);
  });

  it('puts the most recently created record first when the application date ties', () => {
    const older = vaccination({ vaccineName: 'Older', appliedOn: '2026-03-18', createdAt: '2026-03-18T09:00:00.000Z' });
    const newer = vaccination({ vaccineName: 'Newer', appliedOn: '2026-03-18', createdAt: '2026-03-18T15:00:00.000Z' });
    expect(rowNames(build({ vaccinations: [older, newer] }))).toEqual(['Newer', 'Older']);
    expect(rowNames(build({ vaccinations: [newer, older] }))).toEqual(['Newer', 'Older']);
  });

  it('does not reorder the caller\'s array', () => {
    const list = [vaccination({ appliedOn: '2025-01-10' }), vaccination({ appliedOn: '2026-06-01' })];
    const copy = [...list];
    build({ vaccinations: list });
    expect(list).toEqual(copy);
  });

  it('shows the seven columns and the values of a record, with dates as DD/MM/YYYY', () => {
    const html = build({ vaccinations: [vaccination()] });
    for (const key of ['vaccine', 'appliedOn', 'nextDue', 'batch', 'brand', 'vet', 'license']) {
      expect(html).toContain(`<th>L:${key}</th>`);
    }
    for (const value of ['18/03/2026', '18/03/2027', 'L123', 'Zoetis', 'Ana Souza', 'CRMV-SP 12345']) {
      expect(html).toContain(`<td>${value}</td>`);
    }
    expect(html).not.toContain('2026-03-18');
  });

  it('shows the declaratory notice and the generation date in the footer', () => {
    const html = build();
    const footer = html.slice(html.indexOf('<footer'));
    expect(footer).toContain('Registro declaratório feito pelo tutor. Não substitui a carteira de vacinação emitida pelo veterinário.');
    expect(footer).toContain('Gerado em 13/11/2026');
  });

  it('escapes a vaccine name typed as a script', () => {
    const html = build({ vaccinations: [vaccination({ vaccineName: '<script>x</script>' })] });
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<script');
  });

  it('shows a dash for every missing optional value, never null, undefined or an empty cell', () => {
    const html = build({
      pet: { ...pet, breed: null, sex: null, birthOn: null },
      vaccinations: [vaccination({ nextDueOn: null, batch: null, brand: null, vetName: null, vetLicense: null })],
    });
    const row = html.slice(html.indexOf('<tr class="record">'), html.indexOf('</tr>', html.indexOf('<tr class="record">')));
    expect(row.match(/<td>—<\/td>/g)).toHaveLength(5);
    expect(html).not.toMatch(/null|undefined/);
    expect(html).not.toMatch(/<td>\s*<\/td>/);
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    expect(header.match(/—/g)).toHaveLength(3);
  });

  it('treats blank strings as missing too', () => {
    const html = build({ vaccinations: [vaccination({ batch: '   ', brand: '' })] });
    expect(html).not.toMatch(/<td>\s*<\/td>/);
    expect(html).toMatch(/<td>—<\/td>/);
  });

  describe('escapes &, <, >, " and \' in each user-entered field on its own', () => {
    const nasty = `<script>x</script> & "q" 'a'`;
    const escaped = '&lt;script&gt;x&lt;/script&gt; &amp; &quot;q&quot; &#39;a&#39;';
    const cases: [string, Partial<Parameters<typeof buildCardHtml>[0]>][] = [
      ['pet name', { pet: { ...pet, name: nasty } }],
      ['breed', { pet: { ...pet, breed: nasty } }],
      ['vaccine name', { vaccinations: [vaccination({ vaccineName: nasty })] }],
      ['batch', { vaccinations: [vaccination({ batch: nasty })] }],
      ['brand', { vaccinations: [vaccination({ brand: nasty })] }],
      ['vet name', { vaccinations: [vaccination({ vetName: nasty })] }],
      ['license', { vaccinations: [vaccination({ vetLicense: nasty })] }],
    ];
    it.each(cases)('%s', (_field, overrides) => {
      const html = build(overrides);
      expect(html).not.toContain('<script');
      expect(html).not.toContain(nasty);
      expect(html).toContain(escaped);
    });
  });

  it('escapes a label that carries markup, in the title element too', () => {
    const html = build({ labels: { ...labels, title: '<b>x</b>' } });
    expect(html).not.toContain('<b>x</b>');
    expect(html.match(/&lt;b&gt;x&lt;\/b&gt;/g)!.length).toBeGreaterThanOrEqual(2);
    expect(html.slice(html.indexOf('<title>'), html.indexOf('</title>'))).toContain('&lt;b&gt;');
  });

  it('escapes quotes in the image alt attribute', () => {
    const v = vaccination({ vaccineName: `a"b'c` });
    const html = build({ vaccinations: [v], photos: [{ vaccinationId: v.id, dataUri: JPEG }] });
    expect(html).toContain('alt="a&quot;b&#39;c — 18/03/2026"');
  });

  it('falls back to the "other" label for an unknown archive reason', () => {
    const html = build({
      pet: { ...pet, status: 'archived', archivedReason: 'weird' as never, archivedOn: null },
      labels: { ...labels, reasonOther: 'Outro motivo' },
    });
    expect(html).toContain('Carteira encerrada: Outro motivo');
  });

  it('escapes the vaccine name inside the photo caption and attributes', () => {
    const v = vaccination({ vaccineName: '"><img src=x onerror=alert(1)>' });
    const html = build({ vaccinations: [v], photos: [{ vaccinationId: v.id, dataUri: JPEG }] });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
  });

  it('writes the pet data in the header, each only when present', () => {
    const html = build();
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    for (const text of ['Thor', 'Cão', 'SRD', 'Macho', '17/05/2020']) expect(header).toContain(text);
    expect(header).not.toContain('Carteira encerrada');
  });

  it('says in the header when the wallet is archived, with the reason and the date', () => {
    const html = build({ pet: { ...pet, status: 'archived', archivedReason: 'deceased', archivedOn: '2026-02-01' } });
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    expect(header).toContain('Carteira encerrada');
    expect(header).toContain('Faleceu');
    expect(header).toContain('01/02/2026');
  });

  it('says it is archived even without a date', () => {
    const html = build({ pet: { ...pet, status: 'archived', archivedReason: 'deceased', archivedOn: null } });
    expect(html).toContain('Carteira encerrada');
    expect(html).toContain('Faleceu');
  });

  describe('photos', () => {
    it('embeds each photo as a data URI, identified by the vaccine and the date, after the table', () => {
      const v = vaccination({ vaccineName: 'V10', appliedOn: '2026-03-18' });
      const html = build({ vaccinations: [v], photos: [{ vaccinationId: v.id, dataUri: JPEG }] });
      const photos = html.slice(html.indexOf('<section class="photos"'));
      expect(photos).toContain(`<img src="${JPEG}"`);
      expect(photos).toContain('V10 — 18/03/2026');
      expect(html.indexOf('<table')).toBeLessThan(html.indexOf('class="photos"'));
    });

    it('orders the photos like the table, most recent record first', () => {
      const a = vaccination({ vaccineName: 'Old', appliedOn: '2025-01-01' });
      const b = vaccination({ vaccineName: 'New', appliedOn: '2026-01-01' });
      const html = build({
        vaccinations: [a, b],
        photos: [
          { vaccinationId: a.id, dataUri: JPEG },
          { vaccinationId: b.id, dataUri: JPEG },
        ],
      });
      const captions = [...html.matchAll(/<figcaption>(.*?)<\/figcaption>/g)].map((m) => m[1]);
      expect(captions).toEqual(['New — 01/01/2026', 'Old — 01/01/2025']);
    });

    it('leaves the photos section out when there is no photo', () => {
      expect(build({ vaccinations: [vaccination()] })).not.toContain('class="photos"');
    });

    it('puts a line in place of a photo that could not be read', () => {
      const v = vaccination({ vaccineName: 'V10' });
      const html = build({ vaccinations: [v], photos: [{ vaccinationId: v.id, dataUri: null }] });
      expect(html).toContain('V10 — 18/03/2026');
      expect(html).toContain('Foto não incluída');
      expect(html).not.toContain('<img');
    });

    it('refuses to embed anything that is not a base64 image data URI', () => {
      const v = vaccination();
      const html = build({
        vaccinations: [v],
        photos: [{ vaccinationId: v.id, dataUri: 'https://evil.example/x.jpg" onerror="alert(1)' }],
      });
      expect(html).not.toContain('<img');
      expect(html).not.toContain('evil.example');
      expect(html).toContain('Foto não incluída');
    });

    it('ignores a photo of a record that is not in the list', () => {
      const html = build({ vaccinations: [vaccination()], photos: [{ vaccinationId: 'other', dataUri: JPEG }] });
      expect(html).not.toContain('<img');
    });

    it('does not split or crop a photo: it scales to the page and starts on a new page', () => {
      const v = vaccination();
      const html = build({ vaccinations: [v], photos: [{ vaccinationId: v.id, dataUri: JPEG }] });
      expect(html).toMatch(/\.photos\s*\{[^}]*(page-break-before|break-before):\s*always/);
      expect(html).toMatch(/figure\s*\{[^}]*(page-break-inside|break-inside):\s*avoid/);
      expect(html).toMatch(/img\s*\{[^}]*max-width:\s*100%/);
      expect(html).not.toMatch(/object-fit:\s*cover/);
    });
  });

  it('is self-contained: no script, no remote resource, no external stylesheet', () => {
    const v = vaccination();
    const html = build({ vaccinations: [v], photos: [{ vaccinationId: v.id, dataUri: JPEG }] });
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<script|<link|@import|url\(/i);
  });

  it('does not rely on colour: only the default text colour is used', () => {
    expect(build()).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(|color:/i);
  });
});

describe('pdfFileName', () => {
  it('builds carteira-<pet>-<date>.pdf with the name reduced to lowercase ASCII and hyphens', () => {
    expect(pdfFileName('Thor', '2026-11-13')).toBe('carteira-thor-2026-11-13.pdf');
    expect(pdfFileName('Mel  da Conceição', '2026-11-13')).toBe('carteira-mel-da-conceicao-2026-11-13.pdf');
    expect(pdfFileName('../../Rex/é', '2026-11-13')).toBe('carteira-rex-e-2026-11-13.pdf');
  });

  it('limits the pet part to 60 characters without a trailing hyphen', () => {
    const name = `${'a'.repeat(59)} bbbbbb`;
    const file = pdfFileName(name, '2026-11-13');
    expect(file).toBe(`carteira-${'a'.repeat(59)}-2026-11-13.pdf`);
    expect(pdfFileName('x'.repeat(500), '2026-11-13')).toBe(`carteira-${'x'.repeat(60)}-2026-11-13.pdf`);
  });

  it('falls back to "pet" when nothing is left', () => {
    expect(pdfFileName('🐶', '2026-11-13')).toBe('carteira-pet-2026-11-13.pdf');
    expect(pdfFileName('  ', '2026-11-13')).toBe('carteira-pet-2026-11-13.pdf');
  });
});
