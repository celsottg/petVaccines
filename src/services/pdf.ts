import type { Pet, Vaccination } from '@/data/types';
import { formatBrDate } from '@/domain/dateInput';
import type { IsoDate } from '@/domain/dates';

// Pure: no i18n, no Expo, no database. The text comes in through `labels` and the
// result is one self-contained HTML string (no script, no remote resource).

/** Every label `buildCardHtml` reads; `pdfLabels.ts` fills them from the i18n file. */
export const CARD_LABEL_KEYS = [
  'title',
  'name',
  'species',
  'breed',
  'sex',
  'birth',
  'speciesDog',
  'speciesCat',
  'sexMale',
  'sexFemale',
  'archived',
  'reasonDeceased',
  'reasonRehomed',
  'reasonOther',
  'vaccine',
  'appliedOn',
  'nextDue',
  'batch',
  'brand',
  'vet',
  'license',
  'photosTitle',
  'photoMissing',
  'generatedOn',
  'notice',
] as const;

export type CardLabelKey = (typeof CARD_LABEL_KEYS)[number];

export interface CardPhoto {
  vaccinationId: string;
  /** `data:image/...;base64,...`, or `null` when the file could not be read. */
  dataUri: string | null;
}

export interface CardInput {
  pet: Pet;
  vaccinations: Vaccination[];
  photos: CardPhoto[];
  generatedOn: IsoDate;
  labels: Record<string, string>;
}

const DASH = '—';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Escaped text, or a dash when the value is missing or blank. */
const orDash = (value: string | null | undefined) => (value?.trim() ? escapeHtml(value.trim()) : DASH);
const dateOrDash = (date: IsoDate | null) => (date ? formatBrDate(date) : DASH);

// A photo is only embedded when it is exactly a base64 image data URI, so nothing
// else can end up inside the `src` attribute.
const IMAGE_DATA_URI = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Most recent application first; on the same day, the record created last first. */
function byRecency(a: Vaccination, b: Vaccination): number {
  if (a.appliedOn !== b.appliedOn) return a.appliedOn < b.appliedOn ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

const STYLE = `
  @page { margin: 14mm; }
  body { font-family: sans-serif; font-size: 10pt; margin: 0; }
  h1 { font-size: 16pt; margin: 0 0 8px; }
  h2 { font-size: 12pt; margin: 16px 0 6px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { border: 1px solid currentColor; padding: 4px 5px; text-align: left; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
  th { font-weight: bold; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .pet th { width: 28%; }
  .archived { font-weight: bold; margin: 8px 0 0; border: 2px solid currentColor; padding: 4px 6px; }
  .photos { page-break-before: always; break-before: page; }
  figure { margin: 0 0 14px; page-break-inside: avoid; break-inside: avoid; }
  figcaption { font-weight: bold; margin-bottom: 4px; }
  img { display: block; max-width: 100%; max-height: 640px; width: auto; height: auto; }
  .missing { margin: 0; font-style: italic; }
  footer { margin-top: 18px; border-top: 1px solid currentColor; padding-top: 6px; font-size: 9pt; }
  footer p { margin: 2px 0; }
`;

export function buildCardHtml(input: CardInput): string {
  const { pet, generatedOn, labels } = input;
  const label = (key: CardLabelKey) => escapeHtml(labels[key] ?? '');
  const sorted = [...input.vaccinations].sort(byRecency);

  const species = pet.species === 'dog' ? label('speciesDog') : label('speciesCat');
  const sex = pet.sex === 'male' ? label('sexMale') : pet.sex === 'female' ? label('sexFemale') : DASH;
  const petRows: [CardLabelKey, string][] = [
    ['name', escapeHtml(pet.name)],
    ['species', species],
    ['breed', orDash(pet.breed)],
    ['sex', sex],
    ['birth', dateOrDash(pet.birthOn)],
  ];

  const archivedLine = (() => {
    if (pet.status !== 'archived') return '';
    const reasonKey = { deceased: 'reasonDeceased', rehomed: 'reasonRehomed', other: 'reasonOther' } as const;
    const reason = pet.archivedReason ? label(reasonKey[pet.archivedReason] ?? 'reasonOther') : '';
    const on = pet.archivedOn ? ` (${formatBrDate(pet.archivedOn)})` : '';
    return `<p class="archived">${label('archived')}${reason ? `: ${reason}` : ''}${on}</p>`;
  })();

  const rows = sorted
    .map(
      (v) => `<tr class="record">
<td>${escapeHtml(v.vaccineName)}</td>
<td>${formatBrDate(v.appliedOn)}</td>
<td>${dateOrDash(v.nextDueOn)}</td>
<td>${orDash(v.batch)}</td>
<td>${orDash(v.brand)}</td>
<td>${orDash(v.vetName)}</td>
<td>${orDash(v.vetLicense)}</td>
</tr>`,
    )
    .join('\n');

  const figures = sorted.flatMap((v) =>
    input.photos
      .filter((photo) => photo.vaccinationId === v.id)
      .map((photo) => {
        const caption = `${escapeHtml(v.vaccineName)} — ${formatBrDate(v.appliedOn)}`;
        const body =
          photo.dataUri !== null && IMAGE_DATA_URI.test(photo.dataUri)
            ? `<img src="${photo.dataUri}" alt="${caption}">`
            : `<p class="missing">${label('photoMissing')}</p>`;
        return `<figure>\n<figcaption>${caption}</figcaption>\n${body}\n</figure>`;
      }),
  );
  const photosSection =
    figures.length > 0 ? `<section class="photos">\n<h2>${label('photosTitle')}</h2>\n${figures.join('\n')}\n</section>` : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${label('title')} — ${escapeHtml(pet.name)}</title>
<style>${STYLE}</style>
</head>
<body>
<header>
<h1>${label('title')}</h1>
<table class="pet">
${petRows.map(([key, value]) => `<tr><th>${label(key)}</th><td>${value}</td></tr>`).join('\n')}
</table>
${archivedLine}
</header>
<main>
<table class="vaccinations">
<thead><tr><th>${label('vaccine')}</th><th>${label('appliedOn')}</th><th>${label('nextDue')}</th><th>${label('batch')}</th><th>${label('brand')}</th><th>${label('vet')}</th><th>${label('license')}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
${photosSection}
</main>
<footer>
<p>${label('generatedOn')} ${formatBrDate(generatedOn)}</p>
<p>${label('notice')}</p>
</footer>
</body>
</html>`;
}

/** Keeps the whole file name far below the 255-byte file-system limit. */
const MAX_NAME_LENGTH = 60;

/**
 * `carteira-<pet>-<YYYY-MM-DD>.pdf`: the name reduced to lowercase ASCII letters,
 * digits and hyphens (accents removed), or `pet` when nothing is left.
 */
export function pdfFileName(petName: string, generatedOn: IsoDate): string {
  const slug = petName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/-+$/, '');
  return `carteira-${slug || 'pet'}-${generatedOn}.pdf`;
}
