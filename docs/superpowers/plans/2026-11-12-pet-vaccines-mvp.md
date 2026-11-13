# petVaccines MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o MVP do app "Vacinas do Pet": carteira de vacinação de cães e gatos, 100% local, com comprovantes em foto, lembretes, PDF e backup em `.zip`.

**Architecture:** App Expo sem servidor. As regras de negócio são funções puras em `src/domain/` (testadas com Jest, sem React nem banco). O acesso a dados fica em `src/data/`, sobre SQLite com Drizzle. Fotos, notificações, PDF e backup são serviços em `src/services/`. As telas em `src/app/` só leem com `useLiveQuery` e chamam `data/` e `services/`.

**Tech Stack:** Expo (SDK estável mais recente) + TypeScript `strict`, Expo Router, `expo-sqlite` + Drizzle ORM, React Hook Form + Zod, `expo-notifications` (local), `expo-print`, `react-native-zip-archive`, i18next, Jest + React Native Testing Library, Maestro.

**Spec:** `docs/superpowers/specs/2026-11-12-pet-vaccines-design.md`. Quem executa lê os dois documentos. As telas de referência estão no canvas "Telas — Carteira de Vacinação Pet (proposta)" na task do Traycer.

## Global Constraints

- Nenhum servidor, conta, login, analytics ou anúncio. O build de produção não faz requisição de rede.
- Identificadores, tabelas, nomes de arquivo e commits em inglês. Textos de interface só em `src/i18n/pt-BR.json`, nunca escritos direto nas telas.
- Commits no padrão Conventional Commits.
- Identificador do pacote (Android e iOS): `com.simplifica.petvaccines`. Nome exibido: `Vacinas do Pet`.
- Licença GPLv3.
- Cor principal `#5B4BC4`; no modo escuro, um tom mais claro com contraste mínimo de 4,5:1. O app segue o tema do sistema.
- Selos de status usam cor e texto. Toda exclusão pede confirmação.
- Nada pode depender de recurso exclusivo do Android.
- Datas de calendário são texto `YYYY-MM-DD`; instantes são ISO 8601 em UTC. IDs são UUID em texto.
- Padrões: `due_soon_days` 30, `reminder_offsets_days` `[7, 0]`, `backup_warning_days` 14, lembretes às 09:00 locais, no máximo 50 notificações agendadas, no máximo 3 fotos por registro, fotos com no máximo 2048 px no lado maior e JPEG qualidade 0,8.
- Stack convencional do Expo; não adicionar bibliotecas fora da seção 4 da spec sem necessidade clara. Ficam a cargo de quem implementa: seletor de data e biblioteca de zoom.
- Comandos de verificação usados em todas as tasks: `npx jest`, `npx tsc --noEmit`, `npx expo lint`.

## Review Focus

Condições que a spec implica, mas que nenhum critério dela exercita. Cada uma tem um teste na task indicada.

1. **Virada do dia no fuso do Brasil.** Às 22:00 em UTC-3, a data em UTC já é o dia seguinte. O tutor espera que "hoje" seja a data do aparelho, senão uma vacina aparece vencida um dia antes. Teste na Task 2.
2. **Nome livre digitado de formas diferentes.** "Antirrabica", "antirrábica " e "ANTIRRÁBICA" devem ser a mesma vacina, assim como "Gripe  Canina" com dois espaços e um nome livre igual a um item do catálogo; caso contrário o reforço não substitui a aplicação anterior e o lembrete antigo continua ativo. Testes nas Tasks 2, 2.1 e 6.
3. **Arquivo de backup malicioso ou corrompido.** Um `data.json` com `file` igual a `../../algo` ou um zip com entradas fora de `photos/` e `pets/` não pode gravar fora das pastas do app. Teste na Task 11.
4. **App encerrado no meio da importação.** O tutor espera encontrar os dados antigos inteiros ou os novos inteiros, nunca uma mistura. Teste na Task 11.
5. **Lembrete cujo horário já passou.** Uma vacina que vence hoje, registrada às 15:00, não deve disparar a notificação das 09:00 na hora, nem derrubar o agendamento das demais. Notificações negadas ou revogadas não podem causar erro. Testes na Task 8.

---

## File Structure

```
src/
  app/                             rotas do Expo Router (só telas e _layout)
    _layout.tsx                    providers, migrações, syncReminders na abertura
    index.tsx                      tela 1: Meus pets
    archived.tsx                   tela 5: Carteiras encerradas
    backup.tsx                     tela 9
    settings.tsx                   tela 10
    pets/new.tsx                   tela 2 (criação)
    pets/[petId]/index.tsx         tela 4: Carteira do pet
    pets/[petId]/edit.tsx          tela 2 (edição)
    pets/[petId]/archive.tsx       tela 3
    vaccinations/new.tsx           tela 6 (criação; params petId, fromVaccinationId?)
    vaccinations/[id]/index.tsx    tela 7
    vaccinations/[id]/edit.tsx     tela 6 (edição)
    attachments/[id].tsx           tela 8
  domain/    dates.ts status.ts current.ts nextDose.ts validation.ts reminders.ts backupWarning.ts
  db/        schema.ts client.ts migrations/
  data/      pets.ts vaccinations.ts attachments.ts settings.ts types.ts
  services/  files.ts photos.ts reminders.ts pdf.ts backup/{schema.ts,export.ts,import.ts}
  catalog/   br.json index.ts
  i18n/      index.ts pt-BR.json
  theme/     index.ts
  components/ PetCard.tsx StatusBadge.tsx VaccinationCard.tsx FormField.tsx ConfirmDialog.tsx BackupBanner.tsx
```

Testes ficam ao lado do arquivo testado, como `status.test.ts`. A exceção são as telas: todo arquivo em `src/app/` vira rota, então os testes de tela ficam em `src/__tests__/app/`, espelhando o caminho da rota (por exemplo, `src/app/pets/new.tsx` é testado em `src/__tests__/app/pets/new.test.tsx`).

---

### Task 1: Fundação do projeto

**Files:**
- Create: projeto Expo na raiz (preservando `docs/` e `.git`), `src/theme/index.ts`, `src/i18n/index.ts`, `src/i18n/pt-BR.json`, `src/app/_layout.tsx`, `src/app/index.tsx`
- Create: `LICENSE`, `README.md`, `README.en.md`, `CONTRIBUTING.md`, `CONTRIBUTING.en.md`, `CODE_OF_CONDUCT.md`, `.github/ISSUE_TEMPLATE/{bug.yml,feature.yml,catalog-vaccine.yml}`, `.github/pull_request_template.md`, `.github/workflows/ci.yml`, `eas.json`

**Interfaces:**
- Produces: `theme` (`colors.light`, `colors.dark`, `spacing`, `radius`, `typography`) e hook `useTheme()`; `t()` do i18next já inicializado em `pt-BR`; scripts `npm test`, `npm run lint`, `npm run typecheck`.

- [x] **Step 1:** Conferir a SDK estável atual em expo.dev/changelog. Criar o projeto com `npx create-expo-app@latest` em uma pasta temporária e mover o conteúdo para a raiz, sem tocar em `docs/` e `.git`. Remover as telas de exemplo do template.
- [x] **Step 2:** Em `app.json`: `name` "Vacinas do Pet", `slug` "petvaccines", `android.package` e `ios.bundleIdentifier` iguais a `com.simplifica.petvaccines`, `userInterfaceStyle` "automatic". Ativar `strict` no `tsconfig.json`.
- [x] **Step 3:** Configurar Jest com `jest-expo` e React Native Testing Library, fixando `TZ=America/Sao_Paulo` no script de teste para que os testes de data rodem no fuso do público do app. Escrever o teste `src/__tests__/app/index.test.tsx`: renderiza a tela inicial e encontra o texto `Meus pets`.
- [x] **Step 4:** Rodar `npx jest`. Esperado: FAIL, a tela ainda não existe.
- [x] **Step 5:** Criar `src/theme/index.ts` (primária `#5B4BC4` no claro; pares de cor para `ok`, `dueSoon`, `overdue`, `neutral`), `src/i18n/` e `src/app/index.tsx` com o título vindo de `t('pets.title')` e um estado vazio com o botão "Adicionar pet".
- [x] **Step 6:** Rodar `npx jest`, `npx tsc --noEmit` e `npx expo lint`. Esperado: tudo passa.
- [x] **Step 7:** Escrever os arquivos do projeto aberto. `README.md` (português, padrão) e `README.en.md` têm, no topo, um link um para o outro; o mesmo vale para `CONTRIBUTING.md` e `CONTRIBUTING.en.md`. O CONTRIBUTING explica como rodar o projeto, o padrão de commits, como propor uma vacina para o catálogo e como traduzir, sem exigir programação nos dois últimos. `LICENSE` é o texto integral da GPLv3.
- [x] **Step 8:** `ci.yml` roda, em cada PR e em `main`: `npm ci`, lint, typecheck e testes. `eas.json` com os perfis `development`, `preview` e `production`.
- [x] **Step 9:** Gerar um development build para Android (`npx expo run:android` ou EAS) e confirmar que o app abre em "Meus pets".
- [x] **Step 10:** Commit: `chore: scaffold expo project with theme, i18n, ci and community files`.

### Task 2: Regras puras de datas, status e registro vigente

**Files:**
- Create: `src/domain/dates.ts`, `status.ts`, `current.ts`, `nextDose.ts` e os respectivos `*.test.ts`

**Interfaces:**
- Produces:
  - `type IsoDate = string`
  - `todayLocal(now?: Date): IsoDate`, `addDays(date: IsoDate, days: number): IsoDate`, `diffDays(a: IsoDate, b: IsoDate): number` (a − b)
  - `type VaccinationStatus = 'ok' | 'due_soon' | 'overdue'`
  - `getStatus(nextDueOn: IsoDate | null, today: IsoDate, dueSoonDays: number): VaccinationStatus`
  - `worstStatus(statuses: VaccinationStatus[]): VaccinationStatus | null`
  - `vaccineKey(v: { catalogId: string | null; vaccineName: string }): string`
  - `splitCurrent<T extends { catalogId: string | null; vaccineName: string; appliedOn: IsoDate; createdAt: string }>(list: T[]): { current: T[]; previous: T[] }`
  - `suggestNextDue(appliedOn: IsoDate, boosterIntervalDays: number): IsoDate`

- [x] **Step 1: Escrever os testes que falham**

```ts
// dates.test.ts
expect(todayLocal(new Date(2026, 10, 12, 22, 30))).toBe('2026-11-12'); // 22:30 local, já é dia 13 em UTC
expect(addDays('2026-12-25', 7)).toBe('2027-01-01');
expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
expect(diffDays('2026-12-02', '2026-11-12')).toBe(20);

// status.test.ts — hoje = '2026-11-12', dueSoonDays = 30
expect(getStatus(null, today, 30)).toBe('ok');
expect(getStatus('2026-12-13', today, 30)).toBe('ok');        // 31 dias
expect(getStatus('2026-12-12', today, 30)).toBe('due_soon');  // 30 dias exatos
expect(getStatus('2026-11-12', today, 30)).toBe('due_soon');  // vence hoje
expect(getStatus('2026-11-11', today, 30)).toBe('overdue');
expect(worstStatus(['ok', 'overdue', 'due_soon'])).toBe('overdue');
expect(worstStatus([])).toBeNull();

// current.test.ts
expect(vaccineKey({ catalogId: null, vaccineName: ' ANTIRRÁBICA ' }))
  .toBe(vaccineKey({ catalogId: null, vaccineName: 'antirrabica' }));
expect(vaccineKey({ catalogId: 'br-dog-rabies', vaccineName: 'Raiva' }))
  .toBe(vaccineKey({ catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica' }));
// antirrábica aplicada em 2024-11-28 e em 2025-12-02, e V10 em 2026-03-18:
// current = [antirrábica 2025, V10]; previous = [antirrábica 2024]
// mesma appliedOn: vence o createdAt mais recente

// nextDose.test.ts
expect(suggestNextDue('2026-11-12', 365)).toBe('2027-11-12');
```

- [x] **Step 2:** Rodar `npx jest src/domain`. Esperado: FAIL, funções não definidas.
- [x] **Step 3:** Implementar. Em `dates.ts`, fazer a aritmética em UTC ao meio-dia para não depender de horário de verão; `todayLocal` usa os componentes locais de `Date`. Em `vaccineKey`, normalizar com `normalize('NFD')`, remover os diacríticos, `trim` e minúsculas; prefixar com `catalog:` ou `name:` para as duas origens não colidirem.
- [x] **Step 4:** Rodar `npx jest src/domain`. Esperado: PASS.
- [x] **Step 5:** Commit: `feat(domain): add date, status and current-record rules`.

### Task 2.1: Chave de vacina com catálogo e espaços internos

Revisão da regra de "mesma vacina" (seção 6 da spec, revisada em 2026-11-13). Altera código já entregue na Task 2.

**Files:**
- Modify: `src/domain/current.ts`, `src/domain/current.test.ts`, `src/domain/domain.integration.test.ts`, `CLAUDE.md`

**Interfaces:**
- Produces (substitui as assinaturas de `vaccineKey` e `splitCurrent` da Task 2):
  - `normalizeVaccineName(name: string): string`
  - `type CatalogMatcher = (normalizedName: string) => string | undefined` (devolve o `id` do item do catálogo)
  - `vaccineKey(v: { catalogId: string | null; vaccineName: string }, matchCatalog?: CatalogMatcher): string`
  - `splitCurrent<T>(list: T[], matchCatalog?: CatalogMatcher): { current: T[]; previous: T[] }`, com a mesma restrição de `T` da Task 2. A lista é de um único pet, então o `matchCatalog` é o da espécie dele.

- [ ] **Step 1: Escrever os testes que falham**

```ts
const match: CatalogMatcher = (n) => (n === 'antirrabica' ? 'br-dog-rabies' : undefined);

expect(normalizeVaccineName('  Gripe   Canina ')).toBe('gripe canina');
expect(normalizeVaccineName('ANTIRRÁBICA')).toBe('antirrabica');
expect(normalizeVaccineName('gripecanina')).not.toBe(normalizeVaccineName('gripe canina'));

// free name equal to a catalog item resolves to that item
expect(vaccineKey({ catalogId: null, vaccineName: 'Antirrábica' }, match))
  .toBe(vaccineKey({ catalogId: 'br-dog-rabies', vaccineName: 'Raiva' }, match));
// no matcher, or no match: falls back to the normalized name
expect(vaccineKey({ catalogId: null, vaccineName: 'Antirrábica' })).toBe('name:antirrabica');
expect(vaccineKey({ catalogId: null, vaccineName: 'Leptospirose' }, match)).toBe('name:leptospirose');
// inner spaces collapse
expect(vaccineKey({ catalogId: null, vaccineName: 'Gripe  Canina' }))
  .toBe(vaccineKey({ catalogId: null, vaccineName: 'gripe canina' }));

// splitCurrent with match: free-name "Antirrábica" applied 2025-12-02 and
// catalog 'br-dog-rabies' applied 2026-12-01 → current = [2026], previous = [2025]
```

- [ ] **Step 2:** Inverter o teste existente em `current.test.ts` que garante que nome livre e item do catálogo de mesmo nome são vacinas diferentes: ele passa a valer só quando não há `matchCatalog`.
- [ ] **Step 3:** Rodar `npx jest src/domain`. Esperado: FAIL.
- [ ] **Step 4:** Implementar. `normalizeVaccineName` faz NFD, remove diacríticos (`/[̀-ͯ]/g`), troca `/\s+/g` por um espaço, `trim` e minúsculas. `vaccineKey` segue a ordem da spec: `catalogId`, depois `matchCatalog`, depois `name:`. O domínio não importa `src/catalog/`; o catálogo entra só pelo parâmetro.
- [ ] **Step 5:** Rodar `npx jest src/domain`, `npm run typecheck` e `npm run lint`. Esperado: PASS.
- [ ] **Step 6:** Atualizar o parágrafo "Same vaccine" do `CLAUDE.md` com a nova regra.
- [ ] **Step 7:** Commit: `feat(domain): match free vaccine names to the catalog and collapse inner spaces`.

### Task 3: Banco, migrações e camada de dados

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`, `src/db/migrations/*`, `src/data/types.ts`, `src/data/pets.ts`, `vaccinations.ts`, `attachments.ts`, `settings.ts`, `src/data/testDb.ts`, `src/data/*.test.ts`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `IsoDate` (Task 2).
- Produces:
  - Tabelas `pets`, `vaccinations`, `attachments`, `settings`, com as colunas da seção 5 da spec. Colunas em `snake_case`, propriedades TypeScript em `camelCase`.
  - `type Db = BaseSQLiteDatabase<'sync', any, typeof schema>`; todas as funções de `data/` recebem `db: Db` como primeiro argumento.
  - `types.ts`: `Pet`, `Vaccination`, `Attachment` (inferidos do schema), `PetInput`, `VaccinationInput`, `ArchiveReason = 'deceased' | 'rehomed' | 'other'`.
  - `pets.ts`: `createPet(db, input): Pet`, `updatePet(db, id, input): Pet`, `archivePet(db, id, reason: ArchiveReason, on: IsoDate | null): void`, `reactivatePet(db, id): void`, `deletePet(db, id): string[]` (devolve os nomes dos arquivos a apagar).
  - `vaccinations.ts`: `createVaccination(db, input): Vaccination`, `updateVaccination(db, id, input): Vaccination`, `deleteVaccination(db, id): string[]`, `countVaccinationsCreatedAfter(db, instant: string | null): number`.
  - `attachments.ts`: `addAttachment(db, row): Attachment` (lança erro `ATTACHMENT_LIMIT` no quarto anexo), `deleteAttachment(db, id): string`.
  - `settings.ts`: `getSettings(db): Settings`, `setSetting(db, key, value): void`, `touchLastChange(db): void`, com `Settings = { lastBackupAt: string | null; lastChangeAt: string | null; backupWarningDays: number; dueSoonDays: number; reminderOffsetsDays: number[] }`.
  - `client.ts`: `db` (aberto com `enableChangeListener: true` e `PRAGMA foreign_keys = ON`).

- [ ] **Step 1:** Escrever `schema.ts` e gerar a migração com `npx drizzle-kit generate` (`driver: 'expo'`).
- [ ] **Step 2:** Criar `testDb.ts`: `createTestDb(): Db`, que abre um `better-sqlite3` em memória (dependência de desenvolvimento), liga `foreign_keys` e aplica os arquivos `.sql` de `src/db/migrations/`. Assim os testes rodam no Node com o mesmo schema.
- [ ] **Step 3: Escrever os testes que falham** em `src/data/*.test.ts`:
  - `createPet` devolve `status: 'active'` e um `id` UUID.
  - `archivePet(db, id, 'deceased', '2026-11-12')` grava os três campos; `reactivatePet` limpa `archivedReason` e `archivedOn`.
  - `deletePet` de um pet com foto, 2 vacinas e 3 anexos remove todas as linhas e devolve 4 nomes de arquivo.
  - O quarto `addAttachment` na mesma vacina lança `ATTACHMENT_LIMIT`.
  - `getSettings` em banco novo devolve `{ lastBackupAt: null, lastChangeAt: null, backupWarningDays: 14, dueSoonDays: 30, reminderOffsetsDays: [7, 0] }`.
  - Toda função de escrita ou exclusão de pet, vacina e anexo atualiza `lastChangeAt`.
- [ ] **Step 4:** Rodar `npx jest src/data`. Esperado: FAIL.
- [ ] **Step 5:** Implementar `data/`. Cada escrita roda em transação junto com `touchLastChange`.
- [ ] **Step 6:** Rodar `npx jest src/data`. Esperado: PASS.
- [ ] **Step 7:** Em `src/app/_layout.tsx`, aplicar as migrações com `useMigrations` antes de renderizar as rotas; em caso de falha, mostrar uma tela de erro com a mensagem.
- [ ] **Step 8:** Confirmar no development build que o app abre sem erro de migração.
- [ ] **Step 9:** Commit: `feat(data): add sqlite schema, migrations and repositories`.

### Task 4: Catálogo de vacinas

**Files:**
- Create: `src/catalog/br.json`, `src/catalog/index.ts`, `src/catalog/index.test.ts`

**Interfaces:**
- Produces: `type CatalogVaccine = { id: string; name: string; species: 'dog' | 'cat'; boosterIntervalDays: number }`; `listCatalog(species: 'dog' | 'cat'): CatalogVaccine[]` (ordem alfabética); `findCatalogVaccine(id: string): CatalogVaccine | undefined`; `catalogMatcher(species: 'dog' | 'cat'): CatalogMatcher` (Task 2.1), que compara pelo `normalizeVaccineName` do nome do item.
- Consumes: `normalizeVaccineName`, `CatalogMatcher` (Task 2.1).

- [ ] **Step 1:** Escrever o teste: `catalogMatcher('dog')('antirrabica')` é `'br-dog-rabies'`; `catalogMatcher('cat')('antirrabica')` é o id do item de gatos, nunca o de cães; `catalogMatcher('dog')('inexistente')` é `undefined`; não há dois itens da mesma espécie com o mesmo nome normalizado; todo item de `br.json` passa no esquema Zod (`id` no formato `br-(dog|cat)-[a-z0-9-]+`, `boosterIntervalDays` inteiro positivo); não há `id` repetido; `listCatalog('cat')` só devolve gatos; `findCatalogVaccine('br-dog-rabies')?.name` é `'Antirrábica'`.
- [ ] **Step 2:** Rodar `npx jest src/catalog`. Esperado: FAIL.
- [ ] **Step 3:** Criar `br.json` com a proposta de partida da spec: para cães, polivalente V8/V10, antirrábica, gripe canina, giárdia e leishmaniose; para gatos, polivalente V3/V4/V5 e antirrábica. Todos com `boosterIntervalDays: 365`. Marcar no `README` que o conteúdo aguarda revisão veterinária. Implementar `index.ts`.
- [ ] **Step 4:** Rodar `npx jest src/catalog`. Esperado: PASS.
- [ ] **Step 5:** Abrir a issue "Revisão veterinária do catálogo inicial", bloqueante para o release.
- [ ] **Step 6:** Commit: `feat(catalog): add brazilian vaccine catalog`.

### Task 5: Telas de pets

**Files:**
- Create: `src/domain/validation.ts`, `validation.test.ts`, `src/components/{PetCard,StatusBadge,FormField,ConfirmDialog}.tsx`, `src/app/pets/new.tsx`, `src/app/pets/[petId]/edit.tsx`, `src/app/pets/[petId]/archive.tsx`, `src/app/archived.tsx`
- Modify: `src/app/index.tsx`, `src/i18n/pt-BR.json`

**Interfaces:**
- Consumes: `data/pets.ts`, `getStatus`, `worstStatus`, `splitCurrent` (sempre com `catalogMatcher(pet.species)`), `getSettings`.
- Produces: `petInputSchema(today: IsoDate)` (Zod); `<StatusBadge status={VaccinationStatus | 'none' | 'no_receipt'} label={string} />`; `<ConfirmDialog />`.

- [ ] **Step 1:** Testes de `petInputSchema('2026-11-12')`: aceita `{ name: 'Thor', species: 'dog' }` sem os demais campos; rejeita `name` vazio ou só com espaços; rejeita `species: 'bird'`; rejeita `birthOn: '2026-11-13'`; aceita `birthOn: '2026-11-12'`.
- [ ] **Step 2:** Rodar `npx jest src/domain/validation.test.ts`. Esperado: FAIL. Implementar e rodar de novo. Esperado: PASS.
- [ ] **Step 3:** Testes de tela (RNTL, com `createTestDb` injetado): "Meus pets" lista só os pets ativos; mostra o selo com o pior status do pet; mostra "Carteiras encerradas (1)" quando há um pet com baixa e esconde o link quando não há nenhum.
- [ ] **Step 4:** Rodar. Esperado: FAIL.
- [ ] **Step 5:** Implementar as telas 1, 2, 3 e 5 conforme o canvas. Tela 2: só nome e espécie obrigatórios; na edição, ações "Dar baixa" e "Excluir" (com `ConfirmDialog`). Tela 3: motivo, data opcional, resumo do que acontece. Tela 5: lista os pets com baixa e oferece "Reativar". A foto do pet entra na Task 7.
- [ ] **Step 6:** Rodar `npx jest`, `npx tsc --noEmit`, `npx expo lint`. Esperado: PASS.
- [ ] **Step 7:** No aparelho: cadastrar, editar, dar baixa, reativar e excluir um pet.
- [ ] **Step 8:** Commit: `feat(pets): add pet list, form, archive and archived list`.

### Task 6: Telas de vacinas

**Files:**
- Create: `src/components/VaccinationCard.tsx`, `src/app/pets/[petId]/index.tsx`, `src/app/vaccinations/new.tsx`, `src/app/vaccinations/[id]/index.tsx`, `src/app/vaccinations/[id]/edit.tsx`
- Modify: `src/domain/validation.ts`, `validation.test.ts`, `src/i18n/pt-BR.json`

**Interfaces:**
- Consumes: `data/vaccinations.ts`, `listCatalog`, `catalogMatcher`, `normalizeVaccineName`, `suggestNextDue`, `splitCurrent` (sempre com `catalogMatcher(pet.species)`), `getStatus`.
- Produces: `vaccinationInputSchema(ctx: { today: IsoDate; birthOn: IsoDate | null })`.

- [ ] **Step 1:** Testes do esquema, com `today = '2026-11-12'` e `birthOn = '2023-08-10'`: aceita só `vaccineName` e `appliedOn`; rejeita `appliedOn: '2026-11-13'` (futura); rejeita `appliedOn: '2023-08-09'` (antes do nascimento); rejeita `nextDueOn` igual ou anterior a `appliedOn`; com `birthOn: null`, não aplica a regra do nascimento.
- [ ] **Step 2:** Rodar. Esperado: FAIL. Implementar. Esperado: PASS.
- [ ] **Step 3:** Testes de tela: a carteira mostra os registros vigentes acima e os demais sob "Aplicações anteriores"; o filtro "Vencidas" mostra só os vigentes vencidos; a carteira de um pet com baixa não mostra selos de vencimento nem "Nova vacina"; no formulário, escolher "Antirrábica" do catálogo com aplicação em `2026-11-12` preenche a próxima dose com `2027-11-12`; um registro sem anexos mostra o selo "Sem comprovante"; digitar " antirrabica " como nome livre para um cão salva o registro com `catalogId: 'br-dog-rabies'` e preenche a sugestão de próxima dose; digitar "Leptospirose" (fora do catálogo) salva com `catalogId: null`; uma "Antirrábica" antiga de nome livre e sem `catalogId` desce para "Aplicações anteriores" quando o reforço é registrado pelo catálogo.
- [ ] **Step 4:** Rodar. Esperado: FAIL.
- [ ] **Step 5:** Implementar as telas 4, 6 e 7. O campo de vacina combina a lista do catálogo da espécie do pet com texto livre. Ao salvar um nome digitado, o formulário consulta `catalogMatcher(pet.species)(normalizeVaccineName(nome))`: se houver correspondência, grava esse `catalogId` e o nome do catálogo; se não houver, `catalogId` fica nulo. "Registrar reforço" navega para `vaccinations/new` com `fromVaccinationId`, que pré-preenche a vacina e a data de hoje. O bloco de comprovante da tela 6 e os lembretes da tela 7 ficam como espaços reservados até as Tasks 7 e 8.
- [ ] **Step 6:** Rodar os três comandos de verificação. Esperado: PASS.
- [ ] **Step 7:** No aparelho: registrar uma vacina, registrar um reforço e ver a anterior descer para "Aplicações anteriores".
- [ ] **Step 8:** Commit: `feat(vaccinations): add wallet, form and detail screens`.

### Task 7: Fotos e comprovantes

**Files:**
- Create: `src/services/files.ts`, `files.test.ts`, `src/services/photos.ts`, `src/app/attachments/[id].tsx`
- Modify: telas 2, 6 e 7; `src/app/_layout.tsx`; fluxos de exclusão das Tasks 5 e 6

**Interfaces:**
- Consumes: `addAttachment`, `deleteAttachment`, `deletePet`, `deleteVaccination`.
- Produces:
  - `files.ts`: `PHOTOS_DIR`, `PETS_DIR`, `photoUri(file: string): string`, `petPhotoUri(file: string): string`, `deleteFiles(names: string[]): Promise<void>`, `findOrphans(onDisk: string[], referenced: string[]): string[]` (pura), `removeOrphanFiles(db): Promise<void>`.
  - `photos.ts`: `captureAttachment(db, vaccinationId: string, source: 'camera' | 'library'): Promise<Attachment | null>` e `capturePetPhoto(db, petId: string, source: 'camera' | 'library'): Promise<string | null>`; ambos devolvem `null` quando o tutor cancela ou nega a permissão.

- [ ] **Step 1:** Teste de `findOrphans(['a.jpg', 'b.jpg', 'c.jpg'], ['a.jpg', 'c.jpg'])` igual a `['b.jpg']`; e lista vazia quando tudo é referenciado.
- [ ] **Step 2:** Rodar. Esperado: FAIL. Implementar `files.ts`. Esperado: PASS.
- [ ] **Step 3:** Implementar `photos.ts`: pedir a permissão só na hora do uso; redimensionar para no máximo 2048 px no lado maior (sem ampliar imagens menores); salvar em JPEG qualidade 0,8 como `photos/<attachmentId>.jpg` ou `pets/<petId>.jpg`; gravar `sizeBytes`, `width` e `height`.
- [ ] **Step 4:** Ligar nas telas: até 3 fotos nas telas 6 e 7, com a dica "Enquadre o carimbo, a data, o lote e a marca"; foto do pet na tela 2; tela 8 em tela cheia com zoom e "Excluir foto". Todas as exclusões de pet, vacina e anexo passam a chamar `deleteFiles` com os nomes devolvidos pela camada de dados. `removeOrphanFiles` roda na abertura do app.
- [ ] **Step 5:** Rodar os três comandos de verificação. Esperado: PASS.
- [ ] **Step 6:** No aparelho: anexar pela câmera e pela galeria. Copiar o arquivo salvo para o computador e rodar `exiftool <arquivo>`. Esperado: nenhum campo de GPS e lado maior de no máximo 2048 px. Se houver GPS, corrigir o tratamento antes de seguir.
- [ ] **Step 7:** Commit: `feat(photos): add receipt capture, storage and viewer`.

### Task 8: Lembretes e ajustes

**Files:**
- Create: `src/domain/reminders.ts`, `reminders.test.ts`, `src/services/reminders.ts`, `src/app/settings.tsx`
- Modify: `src/app/_layout.tsx`, tela 7, todas as escritas de pets e vacinas nas telas

**Interfaces:**
- Consumes: `splitCurrent`, `addDays`, `getSettings`, `setSetting`.
- Produces:
  - `type PlannedReminder = { vaccinationId: string; petName: string; vaccineName: string; fireOn: IsoDate; daysBefore: number }`
  - `planReminders(input: { pets: Pet[]; vaccinations: Vaccination[]; offsetsDays: number[]; today: IsoDate; limit: number; matcherFor: (species: 'dog' | 'cat') => CatalogMatcher }): PlannedReminder[]`. O domínio continua sem importar o catálogo; o serviço passa `catalogMatcher` em `matcherFor`.
  - `reminderFireDate(fireOn: IsoDate): Date` (09:00 locais)
  - `syncReminders(): Promise<void>` (nunca lança erro) e `ensureNotificationPermission(): Promise<boolean>`

- [ ] **Step 1: Escrever os testes que falham** de `planReminders`, com `today = '2026-11-12'`, `offsetsDays = [7, 0]`, `limit = 50`:
  - Vacina vigente com `nextDueOn: '2026-12-02'` gera dois lembretes: `fireOn '2026-11-25'` com `daysBefore 7`, e `fireOn '2026-12-02'` com `daysBefore 0`.
  - Pet com `status: 'archived'`: nenhum lembrete.
  - Aplicação anterior (não vigente): nenhum lembrete.
  - `remindersEnabled: false` ou `nextDueOn: null`: nenhum lembrete.
  - `nextDueOn: '2026-11-15'`: só o lembrete do dia, porque o de 7 dias antes já passou.
  - 40 vacinas vigentes com datas distintas: o resultado tem exatamente 50 itens, os de `fireOn` mais próximos, em ordem crescente.
  - `fireOn` igual a `today` é incluído; o corte por horário é do serviço.
- [ ] **Step 2:** Rodar `npx jest src/domain/reminders.test.ts`. Esperado: FAIL. Implementar. Esperado: PASS.
- [ ] **Step 3:** Teste do serviço com `expo-notifications` simulado: `syncReminders` cancela tudo e agenda os planejados; um lembrete cuja `reminderFireDate` já passou não é agendado; com permissão negada, não agenda nada e não lança erro; se o agendamento de um item falhar, os demais são agendados.
- [ ] **Step 4:** Rodar. Esperado: FAIL. Implementar `services/reminders.ts`. Textos: `{{pet}}: {{vacina}} vence em 7 dias` e `{{pet}}: {{vacina}} vence hoje`, vindos do i18n. Criar o canal de notificação no Android. Esperado: PASS.
- [ ] **Step 5:** Chamar `syncReminders()` na abertura do app e depois de toda escrita em pets e vacinas. Pedir a permissão na primeira vez que uma vacina com próxima dose for salva. Na tela 7, mostrar as datas dos lembretes, o interruptor `remindersEnabled` e, se a permissão estiver negada, o aviso de que os lembretes estão desligados no sistema.
- [ ] **Step 6:** Implementar a tela 10: `dueSoonDays`, `reminderOffsetsDays`, versão, licença GPLv3, link do repositório e o aviso "Registro declaratório feito pelo tutor. Não substitui a carteira de vacinação emitida pelo veterinário."
- [ ] **Step 7:** Rodar os três comandos de verificação. Esperado: PASS.
- [ ] **Step 8:** No aparelho, ajustando a data do sistema: o lembrete chega 7 dias antes e no dia; registrar um reforço e dar baixa no pet removem os lembretes pendentes.
- [ ] **Step 9:** Commit: `feat(reminders): add local reminders and settings screen`.

### Task 9: PDF da carteira

**Files:**
- Create: `src/services/pdf.ts`, `pdf.test.ts`
- Modify: `src/app/pets/[petId]/index.tsx`

**Interfaces:**
- Produces: `buildCardHtml(input: { pet: Pet; vaccinations: Vaccination[]; photos: { vaccinationId: string; dataUri: string }[]; generatedOn: IsoDate; labels: Record<string, string> }): string` (pura) e `exportPetPdf(petId: string): Promise<void>`.

- [ ] **Step 1:** Testes de `buildCardHtml`: contém o nome do pet; as linhas da tabela vêm da aplicação mais recente para a mais antiga; contém o aviso declaratório e a data de geração; um `vaccineName` igual a `<script>x</script>` aparece escapado; um registro sem lote mostra um traço, sem `null` nem `undefined`.
- [ ] **Step 2:** Rodar. Esperado: FAIL. Implementar. Esperado: PASS.
- [ ] **Step 3:** Implementar `exportPetPdf`: carregar as fotos como data URI, gerar com `expo-print` e abrir o menu de compartilhar. Ligar ao botão "Exportar PDF", disponível também para pets com baixa.
- [ ] **Step 4:** No aparelho: exportar a carteira de um pet com 3 vacinas e fotos e abrir o arquivo.
- [ ] **Step 5:** Commit: `feat(pdf): export pet vaccination card as pdf`.

### Task 10: Backup — exportação e aviso

**Files:**
- Create: `src/services/backup/schema.ts`, `export.ts`, `src/domain/backupWarning.ts`, `backupWarning.test.ts`, `src/services/backup/export.test.ts`, `src/components/BackupBanner.tsx`, `src/app/backup.tsx`
- Modify: `src/app/index.tsx`

**Interfaces:**
- Produces:
  - `backupSchema` (Zod) e `type BackupData`, no formato da seção 10 da spec: `format: 'petvaccines-backup'`, `schemaVersion: 1`, `appVersion`, `exportedAt`, `pets`, `vaccinations`, `attachments`, `settings`. Os campos de arquivo (`pets[].photoFile`, `attachments[].file`) só aceitam o padrão `<uuid>.jpg`.
  - `CURRENT_SCHEMA_VERSION = 1`
  - `buildBackupData(db, now: Date, appVersion: string): BackupData`
  - `exportBackup(): Promise<void>`
  - `shouldWarnBackup(input: { lastBackupAt: string | null; lastChangeAt: string | null; firstRecordAt: string | null; now: Date; warningDays: number }): boolean`

- [ ] **Step 1:** Testes de `shouldWarnBackup`, com `now = 2026-11-12T12:00Z` e `warningDays = 14`:
  - Backup em 27/10 e alteração em 10/11: `true` (16 dias, com mudança).
  - Backup em 27/10 e última alteração em 20/10: `false` (nada novo).
  - Backup em 02/11 e alteração em 10/11: `false` (10 dias).
  - Nunca houve backup e o primeiro registro é de 23/10: `true`.
  - Nunca houve backup e o primeiro registro é de 05/11: `false`.
  - Nunca houve backup e não há registros: `false`.
- [ ] **Step 2:** Rodar. Esperado: FAIL. Implementar. Esperado: PASS.
- [ ] **Step 3:** Teste de `buildBackupData` com `createTestDb`: o resultado passa em `backupSchema`; `settings` contém só `backupWarningDays`, `dueSoonDays` e `reminderOffsetsDays`; pets com baixa são incluídos.
- [ ] **Step 4:** Rodar. Esperado: FAIL. Implementar `schema.ts` e `buildBackupData`. Esperado: PASS.
- [ ] **Step 5:** Implementar `exportBackup`: montar em um diretório temporário `data.json`, `photos/` e `pets/`; compactar em `petvaccines-backup-YYYY-MM-DD.zip`; abrir o menu de compartilhar; gravar `lastBackupAt` quando o menu abrir; apagar os temporários ao final.
- [ ] **Step 6:** Implementar a tela 9 (último backup, quantas vacinas novas desde então via `countVaccinationsCreatedAfter`, conteúdo, exportar, prazo do aviso) e o `BackupBanner` no topo de "Meus pets", visível só quando `shouldWarnBackup` é verdadeiro. O botão de importar entra na Task 11.
- [ ] **Step 7:** Rodar os três comandos de verificação. Esperado: PASS.
- [ ] **Step 8:** No aparelho: exportar, abrir o `.zip` no computador e conferir o `data.json` e as fotos.
- [ ] **Step 9:** Commit: `feat(backup): export backup zip and stale-backup warning`.

### Task 11: Backup — importação

**Files:**
- Create: `src/services/backup/import.ts`, `import.test.ts`
- Modify: `src/app/backup.tsx`, `src/services/backup/schema.ts`

**Interfaces:**
- Consumes: `backupSchema`, `CURRENT_SCHEMA_VERSION`, `removeOrphanFiles`, `syncReminders`.
- Produces:
  - `type BackupErrorCode = 'NOT_A_BACKUP' | 'INVALID_JSON' | 'NEWER_VERSION' | 'UNSAFE_ENTRY'`; `class BackupError extends Error { code: BackupErrorCode }`
  - `parseBackupJson(text: string): BackupData` (pura; lança `BackupError`)
  - `checkFiles(data: BackupData, filesInZip: string[]): { missing: string[] }` (pura; lança `UNSAFE_ENTRY`)
  - `replaceAllData(db, data: BackupData, skipFiles: string[]): void` (uma transação)
  - `readBackup(zipUri: string): Promise<BackupPreview>`, com `BackupPreview = { data: BackupData; stagingDir: string; missing: string[]; counts: { pets: number; vaccinations: number; photos: number } }`
  - `applyBackup(preview: BackupPreview): Promise<void>`

- [ ] **Step 1: Escrever os testes que falham**
  - `parseBackupJson('{ nao é json')` lança `INVALID_JSON`.
  - JSON válido sem `format: 'petvaccines-backup'` lança `NOT_A_BACKUP`.
  - `schemaVersion: 2` lança `NEWER_VERSION`.
  - `attachments[0].file = '../../evil.jpg'` lança `NOT_A_BACKUP` (não passa no padrão `<uuid>.jpg`).
  - `checkFiles` com a entrada `../x.jpg` ou `outra-pasta/x.jpg` no zip lança `UNSAFE_ENTRY`.
  - `checkFiles` com um anexo citado no JSON e ausente no zip devolve o nome em `missing`, sem lançar erro.
  - `replaceAllData`: banco com 2 pets recebe um backup de 1 pet e fica só com esse pet, suas vacinas e anexos; as preferências do backup são aplicadas; `lastBackupAt` e `lastChangeAt` passam a valer `exportedAt`; anexos listados em `skipFiles` não são inseridos.
  - `replaceAllData` com uma vacina apontando para um `petId` inexistente lança erro e o banco continua com os 2 pets originais.
- [ ] **Step 2:** Rodar `npx jest src/services/backup`. Esperado: FAIL.
- [ ] **Step 3:** Implementar as funções puras e `replaceAllData`. Esperado: PASS.
- [ ] **Step 4:** Implementar `readBackup` (extrair para um diretório temporário, ler `data.json`, validar, listar as entradas, montar o resumo) e `applyBackup`, nesta ordem:
  1. Copiar as fotos do diretório temporário para `photos/` e `pets/`. Os nomes são UUIDs, então não colidem com os arquivos atuais.
  2. Rodar `replaceAllData` em uma transação.
  3. Rodar `removeOrphanFiles`, que apaga as fotos dos dados antigos.
  4. Rodar `syncReminders` e apagar os temporários.

  Essa ordem difere da frase da spec ("os arquivos são movidos em seguida"), mas cumpre a garantia que ela pede: se o app for encerrado antes do passo 2, o banco antigo está intacto e as fotos copiadas são órfãs, removidas na próxima abertura; se for encerrado depois, o banco novo está completo e as fotos antigas é que são órfãs.
- [ ] **Step 5:** Na tela 9, "Importar backup de um arquivo": escolher o `.zip`, mostrar o resumo (pets, vacinas, fotos, data do backup e fotos ausentes, se houver) e pedir confirmação. Se o aparelho já tiver dados, a confirmação diz que eles serão substituídos. Cada `BackupErrorCode` tem a própria mensagem no i18n; `NEWER_VERSION` pede para atualizar o app.
- [ ] **Step 6:** Rodar os três comandos de verificação. Esperado: PASS.
- [ ] **Step 7:** Em dois aparelhos (ou após limpar os dados do app): restaurar um backup e conferir pets, vacinas, fotos e lembretes. Tentar importar um `.zip` qualquer e confirmar que os dados existentes não mudam.
- [ ] **Step 8:** Commit: `feat(backup): import backup with validation and atomic replace`.

### Task 12: Fluxo ponta a ponta e release Android

**Files:**
- Create: `.maestro/register-vaccination.yaml`, `docs/privacy-policy.md`, `docs/release-checklist.md`
- Modify: `README.md`, `README.en.md`, `app.json`

- [ ] **Step 1:** Escrever o fluxo Maestro: abrir o app, adicionar o pet "Thor" (cão), registrar "Antirrábica" com a data de hoje, anexar uma foto da galeria e verificar que o cartão aparece na carteira com o selo "Em dia".
- [ ] **Step 2:** Rodar `maestro test .maestro/register-vaccination.yaml` em um emulador com o development build. Esperado: PASS.
- [ ] **Step 3:** Copiar a tabela "O MVP está pronto quando" da spec para `docs/release-checklist.md` e executar cada linha no Android, marcando o resultado. Para "não faz nenhuma requisição de rede", inspecionar o tráfego do build de produção em um proxy.
- [ ] **Step 4:** Confirmar que a issue de revisão veterinária do catálogo (Task 4) foi fechada e que o ícone do app foi definido. São as duas pendências que bloqueiam o release.
- [ ] **Step 5:** Escrever `docs/privacy-policy.md`: o app não coleta nem envia dados; tudo fica no aparelho; câmera, galeria e notificações são usadas só para as funções descritas.
- [ ] **Step 6:** Adicionar capturas de tela aos dois READMEs e abrir de 5 a 8 issues marcadas como "boa primeira contribuição".
- [ ] **Step 7:** Configurar versão e changelog automáticos a partir dos commits. Gerar o build de produção com `eas build -p android --profile production` e publicar na faixa de teste interno da Play Store.
- [ ] **Step 8:** Commit e tag: `chore(release): 1.0.0`.

### Task 13: Release iOS

Depende de a conta de desenvolvedor da Apple estar ativa.

- [ ] **Step 1:** Gerar o development build para iOS e executar `docs/release-checklist.md` em um iPhone real. Atenção especial a: permissões de câmera, galeria e notificação (textos em `app.json`), limite de 64 notificações, menu de compartilhar do `.zip` e do PDF, e seletor de arquivos na importação.
- [ ] **Step 2:** Corrigir o que divergir do Android, com um commit por correção.
- [ ] **Step 3:** `eas build -p ios --profile production` e envio ao TestFlight.
- [ ] **Step 4:** Commit e tag da versão publicada.
