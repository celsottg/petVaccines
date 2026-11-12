# petVaccines — design do MVP

- **Data:** 2026-11-12
- **Autor:** Celso Gonçalves
- **Status:** aprovado em 2026-11-12
- **Substitui:** "Documentação do App Carteira de Vacinação Pet" (2026-11-05), que previa conta, API e servidor
- **Telas de referência:** canvas "Telas — Carteira de Vacinação Pet (proposta)" na task do Traycer

Legenda usada no documento: **[decisão]** foi decidido pelo Celso; **[escolha]** foi escolhido por quem escreveu este documento e pode ser vetado; **[aberto]** ainda precisa de resposta.

## 1. Intenção

Um app móvel de código aberto para tutores guardarem a carteira de vacinação de seus cães e gatos, com a foto do comprovante de cada dose e lembretes da próxima.

**Por quê.** A carteirinha de papel se perde e desbota, e o tutor esquece quando vence a próxima dose. O projeto também existe para formar uma comunidade de contribuidores.

**Sucesso em um ano.** Mais pessoas contribuindo e releases frequentes feitos junto com a comunidade. **[decisão]**

## 2. Objetivos, não objetivos e anti-objetivos

### Objetivos do MVP

1. Cadastrar, editar, dar baixa e excluir pets (cães e gatos), com foto.
2. Registrar vacinas com data, próxima dose, lote, marca, veterinário, CRMV, clínica e observações.
3. Anexar até 3 fotos de comprovante por registro e vê-las em tela cheia com zoom.
4. Mostrar a linha do tempo por pet com status: em dia, vence em breve, vencida.
5. Sugerir a próxima dose a partir de um catálogo brasileiro de vacinas; aceitar nome livre.
6. Lembrar o tutor por notificação local 7 dias antes e no dia.
7. Exportar a carteira do pet em PDF.
8. Fazer backup e restauração em arquivo `.zip`, com aviso quando o backup estiver desatualizado.

### Fora do MVP, possível depois

- Exportar o backup de um único pet, para o novo tutor importar. **[decisão]**
- Vermífugo, antiparasitário, consultas e peso.
- Outras espécies e catálogos de outros países.
- Leitura automática do comprovante (OCR).
- Importação que mescla dados em vez de substituir.

### Anti-objetivos (não entram nunca)

- Conta, login ou qualquer servidor. **[decisão]**
- Coleta de dados pessoais do tutor. **[decisão]**
- Anúncios, rastreamento ou analytics. **[escolha]**
- Validação por veterinário e compartilhamento em tempo real entre tutores, porque exigiriam servidor. **[escolha]**

## 3. Restrições

| Restrição | Origem |
|---|---|
| Todos os dados ficam no aparelho; o app funciona 100% offline | **[decisão]** |
| React Native com Expo | **[decisão]** |
| Publicação na Play Store primeiro, App Store em seguida; nada pode depender de recurso exclusivo do Android | **[decisão]** |
| Licença GPLv3 | **[decisão]** |
| Código (identificadores, tabelas, commits) em inglês | **[decisão]** |
| Interface e issues em português do Brasil | **[escolha]** |
| Documentação em português do Brasil e Inglês (Readme) com link entre eles, sendo o padrão em português | **[decisão]** |
| Público inicial brasileiro; estrutura pronta para outros países | **[decisão]** |
| Stack convencional do ecossistema Expo, sem soluções exóticas, porque o projeto também é de aprendizado | **[escolha]** |

## 4. Stack

Todas as linhas abaixo são **[escolha]**, exceto Expo.

| Camada | Tecnologia | Observação |
|---|---|---|
| Base | Expo (SDK estável mais recente no momento do scaffold) + TypeScript `strict` | Em maio de 2026 a versão estável era a SDK 56; conferir em expo.dev/changelog antes de criar o projeto |
| Navegação | Expo Router | Rotas por arquivo |
| Banco | `expo-sqlite` + Drizzle ORM | Migrações geradas pelo `drizzle-kit` com `driver: 'expo'` e aplicadas na abertura do app; telas leem com `useLiveQuery` (banco aberto com `enableChangeListener: true`) |
| Fotos | `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-image` | |
| Lembretes | `expo-notifications`, só notificações locais | Sem FCM/APNs remoto |
| PDF | `expo-print` + `expo-sharing` | |
| Backup | `react-native-zip-archive` (v8 ou superior) + `expo-document-picker` + Zod | Conferir o config plugin no README da versão instalada |
| Formulários | React Hook Form + Zod | Os esquemas Zod são compartilhados com a importação de backup |
| Idiomas | `expo-localization` + i18next | Só `pt-BR` no MVP |
| Estilo | `StyleSheet` do React Native com um arquivo de tema (cores, espaçamentos, tipografia) | Segue o tema claro/escuro do sistema |
| Testes | Jest + React Native Testing Library; Maestro para o fluxo no aparelho | |

**Consequência:** `react-native-zip-archive` e Drizzle não rodam no Expo Go. O desenvolvimento usa *development build*.

**Removido do documento anterior:** TanStack Query, JWT, Node, Prisma, PostgreSQL, S3, toda a API REST.

## 5. Modelo de dados

Banco SQLite local. Identificadores são UUID em texto. Datas de calendário (`*_on`) são texto `YYYY-MM-DD`, sem fuso; instantes (`*_at`) são ISO 8601 em UTC. **[escolha]**

### `pets`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | text | PK |
| `name` | text | obrigatório |
| `species` | text | `dog` ou `cat`, obrigatório |
| `breed` | text | opcional, texto livre |
| `sex` | text | `male`, `female` ou nulo |
| `birth_on` | text | opcional; aceita data aproximada |
| `photo_file` | text | opcional; nome do arquivo em `pets/` |
| `status` | text | `active` ou `archived` |
| `archived_reason` | text | `deceased`, `rehomed`, `other` ou nulo |
| `archived_on` | text | opcional |
| `created_at`, `updated_at` | text | |

### `vaccinations`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | text | PK |
| `pet_id` | text | FK para `pets`, `ON DELETE CASCADE` |
| `catalog_id` | text | opcional; id da vacina no catálogo; nulo quando o nome é livre |
| `vaccine_name` | text | obrigatório; nome exibido |
| `applied_on` | text | obrigatório |
| `next_due_on` | text | opcional |
| `batch` | text | opcional (lote) |
| `brand` | text | opcional |
| `vet_name` | text | opcional |
| `vet_license` | text | opcional (CRMV) |
| `clinic` | text | opcional |
| `notes` | text | opcional |
| `reminders_enabled` | integer | booleano, padrão 1 |
| `created_at`, `updated_at` | text | |

### `attachments`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | text | PK |
| `vaccination_id` | text | FK para `vaccinations`, `ON DELETE CASCADE` |
| `file` | text | nome do arquivo em `photos/`, igual a `<id>.jpg` |
| `size_bytes`, `width`, `height` | integer | |
| `created_at` | text | |

### `settings`

Tabela chave-valor. Chaves do MVP:

| Chave | Padrão | Uso |
|---|---|---|
| `last_backup_at` | nulo | instante do último backup gerado |
| `last_change_at` | nulo | atualizado em toda escrita ou exclusão de pet, vacina ou anexo |
| `backup_warning_days` | 14 | **[decisão]** duas semanas |
| `due_soon_days` | 30 | limite de "vence em breve" |
| `reminder_offsets_days` | `[7, 0]` | dias antes do vencimento |

### Catálogo de vacinas

O catálogo **não** fica no banco. É um arquivo de dados no repositório, um por país: `src/catalog/br.json`. **[escolha]**

```json
{
  "country": "BR",
  "vaccines": [
    { "id": "br-dog-rabies", "name": "Antirrábica", "species": "dog", "boosterIntervalDays": 365 }
  ]
}
```

O `id` é estável e nunca é reaproveitado, porque os registros o guardam em `catalog_id`.

O conteúdo inicial do catálogo será revisado por uma veterinária de contato do autor antes do primeiro release. **[decisão]** Proposta de partida, a validar: para cães, polivalente (V8/V10), antirrábica, gripe canina, giárdia e leishmaniose; para gatos, polivalente (V3/V4/V5) e antirrábica. O MVP só modela o intervalo de reforço; o esquema de doses de filhotes fica a cargo do tutor, que edita a data sugerida.

### Arquivos

Dentro do diretório de documentos do app:

- `photos/<attachmentId>.jpg`: comprovantes.
- `pets/<petId>.jpg`: foto de perfil do pet.

Excluir um registro apaga também os arquivos correspondentes. A exclusão do banco e a dos arquivos acontecem na mesma operação de serviço; um arquivo órfão encontrado na abertura do app é removido.

## 6. Regras de negócio

### Registro vigente

Um pet pode ter várias aplicações da mesma vacina. Duas aplicações são "a mesma vacina" quando têm o mesmo `catalog_id`; para nome livre, quando o `vaccine_name` é igual ignorando maiúsculas, acentos e espaços nas pontas. O **registro vigente** de cada vacina é o de `applied_on` mais recente. Os demais são "aplicações anteriores". **[escolha]**

### Status

O status é calculado na leitura e nunca é gravado. Vale só para registros vigentes de pets ativos.

| Status | Regra |
|---|---|
| Em dia | `next_due_on` está a mais de `due_soon_days` dias, ou é nulo |
| Vence em breve | `next_due_on` está entre hoje e hoje + `due_soon_days` |
| Vencida | `next_due_on` é anterior a hoje |

O selo do pet em "Meus pets" mostra o pior status entre os registros vigentes dele. "Hoje" é a data local do aparelho.

### Validações

- `applied_on` não pode ser futura.
- `next_due_on` deve ser posterior a `applied_on`.
- `birth_on` não pode ser futura, e `applied_on` não pode ser anterior a `birth_on`.
- Máximo de 3 anexos por registro.

### Próxima dose

Ao escolher uma vacina do catálogo com `next_due_on` vazio, o app preenche a sugestão `applied_on + boosterIntervalDays`. O tutor confirma ou altera. O texto de apoio deixa claro que vale a orientação do veterinário.

### Baixa do pet **[decisão]**

Dar baixa encerra a carteira sem apagar nada.

- O tutor informa o motivo (faleceu, mudou de tutor, outro) e uma data opcional.
- Os lembretes do pet são cancelados e os selos de vencimento deixam de aparecer.
- O pet sai da lista principal e vai para a seção "Carteiras encerradas".
- Histórico, comprovantes e PDF continuam acessíveis; o pet continua no backup.
- A baixa é reversível ("Reativar carteira").

A exclusão definitiva é uma ação separada, com confirmação, e remove vacinas, anexos e arquivos.

## 7. Fotos de comprovante

- Origem: câmera ou galeria. A permissão é pedida só no momento do uso.
- Dica na captura: "Enquadre o carimbo, a data, o lote e a marca".
- Tratamento no aparelho: redimensionar para no máximo 2048 px no lado maior e recodificar em JPEG com qualidade 0,8. HEIC e PNG viram JPEG.
- A recodificação deve remover os metadados EXIF, inclusive o GPS. Isso é verificado por teste (seção 12), não presumido.
- Não há miniaturas separadas; as listas usam `expo-image`, que reduz e guarda em cache. **[escolha]**
- O comprovante pode ser adicionado depois. Registros sem foto mostram o selo "Sem comprovante".

## 8. Lembretes

- Notificações locais, agendadas no aparelho, às 09:00 no horário local. **[escolha]**
- Para cada registro vigente de pet ativo, com `next_due_on` e `reminders_enabled`, há uma notificação por valor de `reminder_offsets_days`.
- Texto: `Thor: Antirrábica vence em 7 dias` e `Thor: Antirrábica vence hoje`.
- A permissão de notificação é pedida na primeira vez que o tutor salva uma vacina com próxima dose. Se for negada, o app funciona normalmente e mostra, no detalhe da vacina, que os lembretes estão desligados no sistema.

**Reconciliação.** Uma única função, `syncReminders()`, cancela todas as notificações agendadas pelo app e reagenda as próximas, em ordem de data, até o limite de 50. Ela roda na abertura do app e depois de qualquer escrita em pets ou vacinas. Isso resolve de uma vez o limite de 64 notificações locais do iOS, o cancelamento ao registrar um reforço, a baixa do pet e a restauração de backup. **[escolha]**

## 9. PDF da carteira

Gerado no aparelho a partir de HTML e compartilhado pelo menu do sistema.

- Cabeçalho com os dados do pet.
- Tabela com todas as aplicações, da mais recente para a mais antiga: vacina, data, próxima dose, lote, marca, veterinário e CRMV.
- Fotos dos comprovantes em seguida, identificadas pela vacina e pela data.
- Rodapé com a data de geração e o aviso: "Registro declaratório feito pelo tutor. Não substitui a carteira de vacinação emitida pelo veterinário." **[escolha]**

## 10. Backup e restauração

### Formato **[decisão]**

Um arquivo `petvaccines-backup-YYYY-MM-DD.zip` com:

```
data.json
photos/<attachmentId>.jpg
pets/<petId>.jpg
```

`data.json`:

```json
{
  "format": "petvaccines-backup",
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-11-12T14:03:00Z",
  "pets": [],
  "vaccinations": [],
  "attachments": [],
  "settings": {}
}
```

As listas espelham as tabelas da seção 5, com os mesmos nomes de campo. `settings` leva só as preferências (`backup_warning_days`, `due_soon_days`, `reminder_offsets_days`).

### Exportar

1. O app gera o `.zip` em um diretório temporário.
2. Abre o menu de compartilhar do sistema.
3. Grava `last_backup_at` quando o arquivo é gerado e o menu é aberto. O sistema não informa de forma confiável se o tutor concluiu o envio, então o app não tenta adivinhar. **[escolha]**

### Aviso de backup desatualizado **[decisão]**

Aparece no topo de "Meus pets", com um botão que leva à tela de backup, quando as duas condições valem:

- passaram mais de `backup_warning_days` dias desde `last_backup_at` (ou desde o primeiro registro criado, se nunca houve backup);
- `last_change_at` é posterior a `last_backup_at`, isto é, há algo novo para salvar. **[escolha]**

O aviso informa quantas vacinas foram registradas desde o último backup.

### Importar

1. O tutor escolhe um `.zip` pelo seletor de arquivos.
2. O app extrai para um diretório temporário e valida `data.json` com Zod.
3. Mostra um resumo (quantos pets, vacinas e fotos, e a data do backup) e pede confirmação.
4. A importação **substitui** todos os dados do aparelho. Se já houver dados, a confirmação diz isso com todas as letras. **[escolha]**
5. A troca é atômica: o banco é atualizado em uma transação e os arquivos são movidos em seguida. Se qualquer etapa falhar, os dados anteriores permanecem intactos.
6. Ao final, `syncReminders()` é executada.

**Erros tratados, cada um com mensagem própria:** arquivo que não é um backup do app, `schemaVersion` maior que a suportada ("atualize o app"), JSON inválido, foto citada no JSON e ausente no zip (importa o resto e avisa).

**Versões.** Uma versão futura do app precisa importar backups de `schemaVersion` anteriores, convertendo-os na leitura.

## 11. Telas

Sem login: o app abre em "Meus pets". O canvas de referência mostra as telas 1 a 4, 6, 7 e 9.

| # | Tela | Conteúdo |
|---|---|---|
| 1 | Meus pets | Cartão por pet ativo com foto, nome, espécie, raça, idade e selo de status; aviso de backup; "Adicionar pet"; link "Carteiras encerradas" |
| 2 | Cadastro e edição do pet | Foto, nome, espécie, raça, sexo, nascimento. Só nome e espécie são obrigatórios. Na edição, dá acesso a "Dar baixa" e "Excluir" |
| 3 | Dar baixa | Motivo, data opcional, resumo do que acontece, confirmar |
| 4 | Carteira do pet | Registros vigentes com selo, filtros por status, seção "Aplicações anteriores", "Nova vacina", "Exportar PDF" |
| 5 | Carteiras encerradas | Lista dos pets com baixa; abre a carteira em modo consulta, com "Reativar" |
| 6 | Nova vacina e edição | Vacina (catálogo ou livre), aplicação, próxima dose, comprovante, detalhes opcionais. Uma única tela rolável, obrigatórios no topo |
| 7 | Detalhe da vacina | Dados, fotos, datas dos lembretes, interruptor de lembretes, "Registrar reforço", editar, excluir |
| 8 | Visualizador de comprovante | Tela cheia com zoom; excluir foto |
| 9 | Backup | Último backup, alterações desde então, exportar, importar, prazo do aviso |
| 10 | Ajustes e Sobre | Prazo de "vence em breve", antecedência dos lembretes, versão, licença, link do repositório, aviso de registro declaratório |

"Registrar reforço" abre a tela 6 com a mesma vacina já escolhida e a data de hoje.

**Diretrizes**

- Selos de status usam cor e texto, nunca só cor.
- Contraste adequado, fontes que respeitam o tamanho do sistema e rótulos para leitores de tela.
- Toda exclusão pede confirmação.
- Cor principal: violeta `#5B4BC4`. **[decisão]** O restante do visual do canvas (tipografia, espaçamentos, formas) é provisório, e o ícone ainda não foi definido. **[aberto]**

## 12. Testes e critérios de aceite

### Testes automatizados

- **Unitários:** cálculo de status, registro vigente, sugestão de próxima dose, validações de data, regra do aviso de backup, planejamento de lembretes (quais notificações e em que datas, incluindo o limite de 50).
- **Integração:** ida e volta do backup (exportar, limpar, importar, comparar); importação de arquivos inválidos; exclusão em cascata com remoção dos arquivos.
- **Ponta a ponta (Maestro):** cadastrar pet, registrar vacina, anexar foto, ver o registro na carteira.

### O MVP está pronto quando

| Critério | Como validar |
|---|---|
| O tutor cadastra, edita, dá baixa, reativa e exclui um pet | Manual |
| O tutor registra uma vacina e a vê na carteira com o status correto | Manual e teste unitário |
| O status muda para "vence em breve" e "vencida" nas datas certas | Teste unitário com datas simuladas |
| A foto entra pela câmera e pela galeria, e abre em tela cheia com zoom | Aparelho real |
| O arquivo salvo tem no máximo 2048 px e nenhum dado de GPS | Inspeção do arquivo |
| O lembrete chega 7 dias antes e no dia | Aparelho real com data ajustada |
| Registrar um reforço cancela o lembrete da aplicação anterior | Teste unitário do planejamento |
| Dar baixa cancela os lembretes e tira o pet da lista principal | Manual |
| O PDF traz dados, vacinas, comprovantes e o aviso declaratório | Manual |
| Um backup feito em um aparelho restaura tudo em outro, com fotos e lembretes | Dois aparelhos |
| O aviso de backup aparece após 14 dias com alterações e some após o backup | Teste unitário e manual |
| Um backup inválido não altera os dados existentes | Teste de integração |
| O app funciona inteiro em modo avião | Manual |
| O build de produção não faz nenhuma requisição de rede | Revisão do código e inspeção do tráfego no aparelho |

Primeiro release: todos os critérios no Android. Release do iOS: os mesmos critérios em aparelho real da Apple.

## 13. Projeto aberto

Como o sucesso é medido por contribuidores, estes itens fazem parte do MVP. **[escolha]**

- `LICENSE` com a GPLv3.
- `README.md` em português: o que é o app, capturas de tela e como rodar em poucos minutos. E em inglês também, vinculados entre eles.
- `CONTRIBUTING.md`: como abrir issue, padrão de commits, como rodar os testes, como contribuir com o catálogo e com traduções sem precisar programar. Também em inglês com vinculo entre eles.
- `CODE_OF_CONDUCT.md`.
- Modelos de issue (bug, sugestão, vacina no catálogo) e de pull request.
- GitHub Actions rodando lint, checagem de tipos e testes em cada PR.
- Conventional Commits, para gerar versão e changelog automaticamente.
- Build e publicação pelo EAS.
- Issues iniciais marcadas como "boa primeira contribuição".

### Estrutura sugerida

```
app/                  rotas do Expo Router
src/
  db/                 schema do Drizzle, migrações, cliente
  domain/             regras puras: status, registro vigente, próxima dose, lembretes
  services/           fotos, notificações, PDF, backup
  catalog/            br.json
  i18n/               pt-BR.json
  components/
  theme/
docs/
```

As regras de `domain/` não dependem de React nem do banco, para que sejam fáceis de testar e de entender por quem chega ao projeto.

## 14. Etapas

Cada etapa termina em algo que funciona no aparelho.

1. **Fundação:** projeto Expo, development build, banco com migrações, tema, i18n, CI, arquivos do projeto aberto.
2. **Pets:** telas 1, 2, 3 e 5.
3. **Vacinas:** catálogo, telas 4, 6 e 7, status e registro vigente.
4. **Comprovantes:** captura, tratamento, armazenamento e tela 8.
5. **Lembretes:** permissão, `syncReminders()` e ajustes.
6. **PDF.**
7. **Backup:** exportar, importar e aviso.
8. **Release Android:** critérios de aceite, ficha da loja, política de privacidade.
9. **Release iOS.**

## 15. O que fica a cargo de quem implementa

- Versões exatas das bibliotecas, respeitando a seção 4.
- Componentes, organização interna das telas e detalhes de estilo.
- Biblioteca de zoom do visualizador e de seleção de data.
- Texto final das mensagens de erro e dos textos de apoio.

## 16. Perguntas em aberto

1. **Ícone do app.**

### Resolvidas

- **Nome do app exibido nas lojas:** "Vacinas do Pet". **[decisão]** "petVaccines" é o nome do repositório.
- **Cor principal:** violeta `#5B4BC4`. **[decisão]** Ela não colide com os selos de status (verde, amarelo, vermelho). No modo escuro, links e textos na cor principal usam um tom mais claro, escolhido por quem implementa, mantendo contraste mínimo de 4,5:1.
- **Identificador do pacote:** `com.simplifica.petvaccines`. O domínio "simplifica" é **[decisão]**; a composição do identificador é **[escolha]**. Ele não pode mudar depois da publicação.
- **Revisão do catálogo:** uma veterinária de contato do autor revisa o catálogo inicial antes do primeiro release. **[decisão]**
