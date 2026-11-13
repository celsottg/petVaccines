import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptBR from './pt-BR.json';

const i18n = createInstance();

// The MVP ships only pt-BR. When other languages are added, pick the
// initial one from expo-localization's getLocales().
void i18n.use(initReactI18next).init({
  resources: { 'pt-BR': { translation: ptBR } },
  lng: 'pt-BR',
  fallbackLng: 'pt-BR',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export const t = i18n.t.bind(i18n);
export default i18n;
