import { CARD_LABEL_KEYS } from './pdf';
import { cardLabels } from './pdfLabels';

describe('cardLabels', () => {
  it('has a Portuguese text for every label the card reads', () => {
    const labels = cardLabels();
    expect(Object.keys(labels).sort()).toEqual([...CARD_LABEL_KEYS].sort());
    for (const key of CARD_LABEL_KEYS) expect(labels[key]).not.toMatch(/^pdf\./);
    expect(labels.notice).toBe(
      'Registro declaratório feito pelo tutor. Não substitui a carteira de vacinação emitida pelo veterinário.',
    );
  });
});
