# Rascunhos de issues para a primeira contribuição

> **Estes são rascunhos que aguardam a aprovação do dono do repositório. Nenhuma destas issues foi criada no GitHub.** Cada item foi conferido no código em 2026-11-13; antes de criar a issue, confirme que o problema ainda existe.

Rótulos sugeridos usam os que já existem no repositório: `good first issue`, `bug`, `enhancement`, `accessibility`, `documentation`. Como as issues do projeto são em português, o texto abaixo já está pronto para colar.

Referências de código são caminhos a partir da raiz do repositório. Em todas, vale a regra do projeto: código e commits em inglês, textos da interface em `src/i18n/pt-BR.json`, e `npm test`, `npm run lint` e `npm run typecheck` passando antes do pull request (veja o [guia de contribuição](../CONTRIBUTING.md)).

---

## 1. Unificar a checagem de data real do calendário

**Rótulos:** `good first issue`, `enhancement`

**Problema.** Duas funções repetem a mesma verificação de "esta data existe no calendário" (construir um `Date.UTC` ao meio-dia e comparar ano, mês e dia):

- `parseBrDate` em `src/domain/dateInput.ts` (a linha do `probe`);
- o `refine` de `isoDate` em `src/domain/validation.ts`.

Se uma regra mudar (por exemplo, um ano mínimo), é fácil corrigir só uma delas.

**Pronto quando.**
- Existe uma única função (por exemplo `isRealCalendarDate(y, m, d)` em `src/domain/dates.ts`) usada pelas duas.
- Os testes existentes (`src/domain/dateInput.test.ts`, `src/domain/validation.test.ts`) continuam passando, e há um teste da função nova com 29/02 em ano bissexto e não bissexto e com mês 13.
- Nenhuma mudança de comportamento.

---

## 2. A carteira lê os anexos de todos os pets

**Rótulos:** `good first issue`, `enhancement`

**Problema.** `useWallet` em `src/data/useVaccinations.ts` consulta **todos** os anexos do banco (`db.select({ vaccinationId: attachments.vaccinationId }).from(attachments)`, sem `where`), mas só precisa dos anexos das vacinas do pet aberto. Com muitos pets e fotos, a carteira de um pet relê e reprocessa linhas que não são dele a cada mudança.

**Pronto quando.**
- A consulta de anexos da carteira só traz os das vacinas do pet (por exemplo, juntando com `vaccinations` pelo `petId`, ou filtrando com `inArray` nos ids das vacinas).
- O comportamento da tela não muda: `src/data/wallet.test.ts` e `src/__tests__/app/pets/[petId]/index.test.tsx` continuam passando; acrescente um teste mostrando que o anexo de outro pet não marca a vacina como "com comprovante".

---

## 3. A tela de nova vacina faz uma consulta vazia quando não é reforço

**Rótulos:** `good first issue`, `enhancement`

**Problema.** `src/app/vaccinations/new.tsx` chama `useVaccinationDetail(fromVaccinationId ?? '')` sempre. Quando a tela não é de reforço (`fromVaccinationId` ausente), o gancho abre cinco consultas ao vivo com id `''` que nunca encontram nada (`src/data/useVaccinations.ts`).

**Pronto quando.**
- Fora do fluxo de reforço, nenhuma consulta com id vazio é aberta (por exemplo, separando o trecho do reforço em um componente que só é montado quando há `fromVaccinationId`, ou dando ao gancho uma forma de ficar desligado).
- O formulário continua começando com o nome escolhido no reforço e esperando o registro de origem (`src/__tests__/app/vaccinations/new.test.tsx` passando).

---

## 4. Lógica de limpeza de arquivos não salvos duplicada nos formulários

**Rótulos:** `good first issue`, `enhancement`

**Problema.** `src/components/PetForm.tsx` e `src/components/VaccinationForm.tsx` repetem o mesmo padrão: guardar os arquivos escolhidos e ainda não salvos em um `ref` atualizado a cada render, uma flag `saved`, e um efeito de desmontagem que chama `discardFiles` quando o formulário é deixado sem salvar. A lógica é delicada (arquivos pendentes só podem ser apagados se nenhuma linha aponta para eles) e hoje existe em dois lugares.

**Pronto quando.**
- Um gancho compartilhado (por exemplo `usePendingFiles` em `src/components/`) concentra o `ref`, a flag e a limpeza, e os dois formulários o usam.
- Os testes de tela dos dois formulários continuam passando (`src/__tests__/app/pets/new.test.tsx`, `src/__tests__/app/pets/[petId]/edit.test.tsx`, `src/__tests__/app/vaccinations/new.test.tsx`), e o gancho ganha um teste próprio: sai sem salvar apaga, saiu depois de salvar não apaga.
- Nenhuma mudança visível ao usuário.

---

## 5. O selo de status pode ficar um dia desatualizado se o app ficar aberto na virada do dia

**Rótulos:** `bug`, `good first issue`

**Problema.** O status das vacinas é calculado com `today = todayLocal()` como valor padrão em `buildWallet` (`src/data/wallet.ts`) e em `src/data/petSummaries.ts`, dentro de `useMemo` (`useWallet` em `src/data/useVaccinations.ts`, `usePetSummaries` em `src/data/usePets.ts`); `VaccinationCard` (`src/components/VaccinationCard.tsx`) também chama `todayLocal()` ao renderizar. O resultado só é recalculado quando os dados do banco mudam. Se o app ficar aberto de um dia para o outro, "Vence hoje" pode continuar aparecendo no dia seguinte, em vez de "Vencida há 1 dia".

**Pronto quando.**
- Existe um gancho (por exemplo `useToday()` em `src/data/` ou `src/components/`) que devolve a data local de hoje e se atualiza na meia-noite e quando o app volta ao primeiro plano (`AppState`). Há um precedente do mesmo tipo em `src/data/useReminderSync.ts`, que já reage ao retorno ao primeiro plano.
- A carteira, a lista de pets e o cartão de vacina passam a usar a data do gancho (passando `today` explicitamente às funções de `wallet.ts` e `petSummaries.ts`, que já aceitam o parâmetro).
- Teste do gancho com datas simuladas (o Jest já roda em `America/Sao_Paulo`; veja `jest/globalSetup.js`).

---

## 6. Visualizador de foto: toque duplo para dar zoom e alternativa para leitor de tela

**Rótulos:** `accessibility`, `enhancement`

**Problema.** O visualizador do comprovante (`src/app/attachments/[id].tsx` com `src/components/ZoomableImage.tsx`) só dá zoom com o gesto de pinça (`usePinchGesture`) e arrasta com `usePanGesture`. Falta:

1. o toque duplo para alternar entre o tamanho normal e o zoom, comum em visualizadores de imagem;
2. uma alternativa para quem usa leitor de tela ou não consegue fazer gestos de dois dedos, por exemplo botões **Aproximar** e **Afastar** (com textos em `src/i18n/pt-BR.json`) ou ações de acessibilidade (`accessibilityActions`) na imagem.

**Pronto quando.**
- O toque duplo alterna o zoom e o zoom máximo/mínimo continuam respeitados (a parte pura está em `src/components/zoom.ts`, testada em `src/components/zoom.test.ts`; estenda os testes).
- Há um caminho por botão ou ação de acessibilidade que faz o mesmo que a pinça, anunciado pelo TalkBack.
- Os gestos só rodam em aparelho: descreva na descrição do pull request em que aparelho e versão do Android foi testado.

---

## 7. Anúncios de "Backup gerado" e "Prazo salvo" para leitores de tela só funcionam no Android

**Rótulos:** `accessibility`, `bug`

**Problema.** Em `src/app/backup.tsx`, as mensagens `backup.done` ("Backup gerado...") e `backup.saved` ("Prazo salvo.") usam `accessibilityLiveRegion="polite"`, que existe apenas no Android. No iOS o VoiceOver não anuncia essas mensagens quando aparecem. O mesmo vale para os avisos em `src/components/FormField.tsx`, `src/components/ChoiceChips.tsx` e `src/components/ProofPhotos.tsx`.

**Pronto quando.**
- Quando uma dessas mensagens aparece, também é chamado `AccessibilityInfo.announceForAccessibility(texto)` (de `react-native`), de preferência por um pequeno gancho reutilizável (por exemplo `useAnnounce(message)`), sem anunciar duas vezes no Android.
- Teste do gancho com o módulo de acessibilidade simulado.
- Dica: o iOS só poderá ser conferido em um aparelho ou simulador da Apple; diga no pull request se foi testado.

---

## 8. Contribuição sem código: sugerir uma vacina ou traduzir o app

**Rótulos:** `good first issue`, `documentation`

**Problema.** O projeto quer contribuições que não exigem programar, e ainda não há nenhuma tradução. Há duas formas de começar:

- **Vacina no catálogo:** o catálogo inicial (`src/catalog/br.json`) tem sete itens e está em revisão veterinária ([#5](https://github.com/celsottg/petVaccines/issues/5)). Sugestões novas ou correções entram pelo modelo de issue **Vacina no catálogo**, com a fonte (bula, orientação veterinária ou referência técnica), conforme o [guia de contribuição](../CONTRIBUTING.md#propor-uma-vacina-para-o-catálogo).
- **Tradução:** todos os textos estão em `src/i18n/pt-BR.json`. Uma tradução para outro idioma (por exemplo, `en.json`) é um arquivo novo com as mesmas chaves, como explica o [guia](../CONTRIBUTING.md#traduzir-o-app). Hoje o app só carrega o português (`src/i18n/index.ts`); ligar um segundo idioma é um passo seguinte, que pode ser outra issue.

**Pronto quando.**
- A proposta de vacina foi aberta com fonte, ou o arquivo de tradução foi enviado em um pull request com todas as chaves de `pt-BR.json` traduzidas e os trechos `{{ }}` preservados.
- Nenhuma alteração de código é necessária para a proposta ser avaliada.

---

## Itens conhecidos que não entraram como "primeira contribuição"

Dois itens do histórico do desenvolvimento são válidos, mas mexem em partes mais delicadas e ficam melhor como issues comuns: a tela inicial carregar todos os pets e vacinas só para calcular o estado do backup (`src/data/useBackupStatus.ts`) e não haver limite para o tamanho total, descompactado, de um backup importado (`src/services/backup/import.ts` só limita o `data.json`, `MAX_DATA_JSON_BYTES`).
