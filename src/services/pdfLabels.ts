import { t } from '@/i18n';

import { CARD_LABEL_KEYS } from './pdf';

/** The labels of the PDF, read from the i18n file in one place so `buildCardHtml` can stay pure. */
export function cardLabels(): Record<string, string> {
  return Object.fromEntries(CARD_LABEL_KEYS.map((key) => [key, t(`pdf.${key}`)]));
}
