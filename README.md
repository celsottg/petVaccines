# Vacinas do Pet

🇧🇷 Português · [🇺🇸 English](README.en.md)

App móvel de código aberto para guardar a carteira de vacinação de cães e gatos, com a foto do comprovante de cada dose e lembretes da próxima.

- **100% local:** sem conta, sem login, sem servidor. Os dados ficam só no seu aparelho e o app funciona em modo avião.
- **Sem anúncios, rastreamento ou analytics.**
- Feito com [Expo](https://expo.dev) e React Native, para Android e iOS.

> **Status:** em desenvolvimento (MVP). Veja o [design do MVP](docs/superpowers/specs/2026-11-12-pet-vaccines-design.md) e o [plano de implementação](docs/superpowers/plans/2026-11-12-pet-vaccines-mvp.md).

## O que o app faz

- Cadastro de pets (cães e gatos), com foto.
- Registro de vacinas: data, próxima dose, lote, marca, veterinário, CRMV, clínica e observações.
- Até 3 fotos de comprovante por registro.
- Status de cada vacina: em dia, vence em breve, vencida.
- Sugestão da próxima dose a partir de um catálogo brasileiro de vacinas.
- Lembretes por notificação local 7 dias antes e no dia.
- Exportação da carteira em PDF e backup em arquivo `.zip`.

> O registro é declaratório, feito pelo tutor. Não substitui a carteira de vacinação emitida pelo veterinário.

> **Catálogo de vacinas:** o conteúdo inicial (`src/catalog/br.json`) ainda aguarda revisão veterinária e não deve ser tratado como recomendação clínica antes do primeiro release.

## Como rodar

Pré-requisitos: [Node.js](https://nodejs.org) LTS e um emulador Android/iOS ou um aparelho.

```bash
git clone https://github.com/celsottg/petVaccines.git
cd petVaccines
npm ci
npx expo run:android   # ou: npx expo run:ios
```

O app usa bibliotecas nativas que não existem no Expo Go, por isso roda em um [development build](https://docs.expo.dev/develop/development-builds/introduction/). Também é possível gerá-lo na nuvem com `npx eas-cli@latest build --profile development`.

### Comandos úteis

| Comando | O que faz |
|---|---|
| `npm test` | testes (Jest), no fuso `America/Sao_Paulo` |
| `npm run lint` | lint (ESLint) |
| `npm run typecheck` | checagem de tipos (TypeScript) |
| `npx expo start` | servidor de desenvolvimento |

## Como contribuir

Contribuições são muito bem-vindas, inclusive sem programar: sugerir vacinas para o catálogo, revisar textos e traduzir. Leia o [guia de contribuição](CONTRIBUTING.md) e o [código de conduta](CODE_OF_CONDUCT.md).

## Licença

[GPLv3](LICENSE).
