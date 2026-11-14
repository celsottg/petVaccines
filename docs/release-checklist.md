# Checklist de release (Android)

Este documento é o portão do primeiro release na Play Store e deve ser executado pelo dono do repositório. **Nada aqui foi executado:** todas as colunas de resultado, data e observações estão vazias de propósito. Quem executa uma linha preenche o resultado, a data e o que viu.

Primeiro release: todos os critérios da spec (seção 12, "O MVP está pronto quando") no Android. O release do iOS repete os mesmos critérios em aparelho real da Apple e não é tratado aqui.

Documentos relacionados: [spec do MVP](superpowers/specs/2026-11-12-pet-vaccines-design.md) · [política de privacidade](privacy-policy.md) · [fluxo ponta a ponta](../.maestro/README.md) · [como lançar uma versão](../CONTRIBUTING.md#como-lançar-uma-versão)

## Bloqueios

O release não deve sair enquanto houver item aberto nesta lista. Marque cada item somente quando a condição descrita for verdadeira.

- [ ] [#5](https://github.com/celsottg/petVaccines/issues/5): revisão veterinária do catálogo inicial (`src/catalog/br.json`) concluída e a issue fechada. Os `id`s do catálogo ficam permanentes depois do primeiro release.
- [ ] [#12](https://github.com/celsottg/petVaccines/issues/12): lembretes e notificações validados em aparelho físico (itens em [Validações em aparelho pendentes](#validações-em-aparelho-pendentes)) e a issue fechada.
- [X] [#14](https://github.com/celsottg/petVaccines/issues/14): exportação em PDF validada em aparelho físico, com a decisão sobre o tamanho das fotos no PDF tomada, e a issue fechada.
- [X] Ícone do app definido (pergunta em aberto 1 da seção 16 da spec): carteirinha com pata e selo de confirmação sobre fundo `#2E1065`, em `assets/images/icon.png`, `assets/images/android-icon-*.png`, `assets/images/splash-icon.png` e `assets/images/favicon.png`, referenciados em `app.json`. Falta só conferir o ícone adaptativo, o ícone temático (monocromático) e a splash em aparelho físico, num novo development build.
- [ ] Política de privacidade: os marcadores de data de vigência e de nome do publicador preenchidos em [`privacy-policy.md`](privacy-policy.md) e [`privacy-policy.en.md`](privacy-policy.en.md), e a política publicada em uma URL pública, antes de enviar a ficha da loja.
- [ ] Ficha da loja criada no Play Console (nome "Vacinas do Pet", descrições, capturas de tela, ícone, categoria, classificação etária).

## Critérios de aceite

Reprodução da tabela da spec, uma linha por critério. A coluna "Método da spec" é o que a spec pede; "Como validar no Android" são os passos para este app como ele está construído. Sempre que possível valide no **build de produção instalado pela faixa de teste interno** (veja [Build e publicação](#build-e-publicação)); onde um comando de teste automatizado é citado, ele roda no computador, na raiz do repositório.

| Critério | Método da spec | Como validar no Android | Resultado | Data | Observações |
|---|---|---|---|---|---|
| O tutor cadastra, edita, dá baixa, reativa e exclui um pet | Manual | 1. Em **Meus pets**, toque em **Adicionar pet**, preencha o nome e salve: abre a carteira do pet.<br>2. Na carteira, **Editar pet**, mude a raça e salve.<br>3. Em **Editar pet**, **Dar baixa**: escolha o motivo, **Confirmar baixa**. O pet sai de Meus pets e aparece em **Carteiras encerradas**.<br>4. Em Carteiras encerradas, **Reativar**: o pet volta a Meus pets.<br>5. Em **Editar pet**, **Excluir pet** e confirme: o pet e as vacinas dele somem. | | | |
| O tutor registra uma vacina e a vê na carteira com o status correto | Manual e teste unitário | 1. Na carteira de um pet, **Nova vacina**; toque na sugestão "Antirrábica", deixe a data de hoje e **Salvar**.<br>2. O cartão aparece na carteira com o selo "Em dia" (a próxima dose sugerida é daqui a um ano).<br>3. Teste unitário: `npx jest src/domain/status.test.ts src/domain/current.test.ts`. | | | |
| O status muda para "vence em breve" e "vencida" nas datas certas | Teste unitário com datas simuladas | 1. Teste unitário: `npx jest src/domain/status.test.ts` (roda no fuso `America/Sao_Paulo`).<br>2. Conferência no aparelho, opcional: edite uma vacina para ter a próxima dose daqui a 5 dias (selo "Vence em 5 dias"). Isso depende de o prazo de "vence em breve" ser de pelo menos 5 dias (o padrão é 30, em **Ajustes e sobre**); com um prazo menor o selo só aparece mais perto da data; edite para uma data passada (selo "Vencida há N dias"). | | | |
| A foto entra pela câmera e pela galeria, e abre em tela cheia com zoom | Aparelho real | 1. Em **Nova vacina**, **Adicionar foto** > **Tirar foto**: autorize a câmera, fotografe, confirme. A miniatura aparece.<br>2. **Adicionar foto** > **Escolher da galeria**: escolha uma imagem (seletor do sistema, sem pedido de permissão de galeria).<br>3. Salve. Abra o detalhe da vacina e toque em uma miniatura: abre em tela cheia.<br>4. Dê zoom com o gesto de pinça e arraste a imagem.<br>5. Repita a foto de perfil em **Adicionar pet**/**Editar pet** (**Escolher foto**).<br>6. Negue a permissão da câmera em outro teste: o app mostra o aviso e continua funcionando. | | | |
| O arquivo salvo tem no máximo 2048 px e nenhum dado de GPS | Inspeção do arquivo | 1. Tire uma foto com a localização ligada no aparelho (ou ponha na galeria uma imagem que tenha GPS nos metadados) e anexe-a a uma vacina.<br>2. Em **Backup**, **Fazer backup agora** e envie o `.zip` ao computador.<br>3. No computador: `unzip petvaccines-backup-*.zip -d backup && identify -format '%f %wx%h\n' backup/photos/*.jpg backup/pets/*.jpg` (maior lado de cada foto no máximo 2048) e `exiftool -gps:all backup/photos/*.jpg backup/pets/*.jpg` (não deve listar nenhuma etiqueta GPS).<br>4. Confirme que a foto original tinha GPS (`exiftool -gps:all original.jpg`); senão o teste não prova nada. | | | |
| O lembrete chega 7 dias antes e no dia | Aparelho real com data ajustada | Ver [Validações em aparelho pendentes](#validações-em-aparelho-pendentes), grupo "Entrega das notificações" (issue [#12](https://github.com/celsottg/petVaccines/issues/12)). | | | |
| Registrar um reforço cancela o lembrete da aplicação anterior | Teste unitário do planejamento | 1. Teste unitário: `npx jest src/domain/reminders.test.ts`.<br>2. No aparelho, veja o grupo "Cancelamentos" em [Validações em aparelho pendentes](#validações-em-aparelho-pendentes). | | | |
| Dar baixa cancela os lembretes e tira o pet da lista principal | Manual | 1. Com um pet que tenha vacina com próxima dose e lembretes ativos, **Editar pet** > **Dar baixa** > **Confirmar baixa**.<br>2. O pet some de **Meus pets** e aparece em **Carteiras encerradas**.<br>3. Os lembretes dele deixam de chegar (grupo "Cancelamentos" em [Validações em aparelho pendentes](#validações-em-aparelho-pendentes)). | | | |
| O PDF traz dados, vacinas, comprovantes e o aviso declaratório | Manual | Na carteira de um pet com vacinas e fotos, **Exportar PDF** e abra o arquivo. Confira cabeçalho com os dados do pet, a tabela de vacinas, as fotos dos comprovantes e o rodapé com o aviso "Registro declaratório feito pelo tutor...". Os testes em aparelho estão em [Validações em aparelho pendentes](#validações-em-aparelho-pendentes) (issue [#14](https://github.com/celsottg/petVaccines/issues/14)). | | | |
| Um backup feito em um aparelho restaura tudo em outro, com fotos e lembretes | Dois aparelhos | 1. No aparelho A, com pets, vacinas e fotos, **Backup** > **Fazer backup agora**; guarde o `.zip` fora do aparelho (Drive, e-mail ou Arquivos).<br>2. No aparelho B (app recém-instalado, sem dados), **Backup** > **Restaurar** > **Importar backup de um arquivo**; escolha o `.zip`, confira o resumo e confirme.<br>3. Confira pets, vacinas, fotos (abra uma em tela cheia) e as preferências.<br>4. Lembretes: no aparelho B, abra o detalhe de uma vacina com próxima dose e confira a seção **Lembretes** com as datas; autorize as notificações e confirme que o lembrete chega (ver issue [#12](https://github.com/celsottg/petVaccines/issues/12)). | | | |
| O aviso de backup aparece após 14 dias com alterações e some após o backup | Teste unitário e manual | 1. Teste unitário: `npx jest src/domain/backupWarning.test.ts`.<br>2. Manual: em **Backup** > **Aviso de backup**, ponha 1 dia e **Salvar prazo**. Faça um backup. Avance a data do sistema em 2 dias e registre uma vacina: em **Meus pets** aparece o aviso "Seu último backup tem 2 dias". Sem alteração nova, o aviso não aparece.<br>3. Toque em **Fazer backup agora** no aviso e conclua o compartilhamento: o aviso some. Restaure a data do sistema e o prazo padrão (14 dias). | | | |
| Um backup inválido não altera os dados existentes | Teste de integração | 1. Teste de integração: `npx jest src/services/backup`.<br>2. No aparelho: tente **Importar backup de um arquivo** com um `.zip` qualquer que não seja um backup (por exemplo um zip de fotos) e com um backup cujo `data.json` você alterou à mão. O app mostra o erro e **nada** muda: os pets, as vacinas e as fotos continuam como estavam. | | | |
| O app funciona inteiro em modo avião | Manual | Ligue o modo avião (Wi-Fi e dados desligados). Percorra todo o app: adicionar e editar pet, registrar vacina com foto da câmera e da galeria, ver detalhe e foto em tela cheia, ajustes, exportar PDF, fazer backup, importar backup. Nada pode travar, mostrar erro de rede ou ficar esperando. O único item que não funciona offline é abrir o link do repositório em **Ajustes e sobre**, que depende do navegador. | | | |
| O build de produção não faz nenhuma requisição de rede | Revisão do código e inspeção do tráfego no aparelho | Revisão do código e inspeção do tráfego: siga o [procedimento](#procedimento-sem-requisições-de-rede) abaixo. | | | |

## Procedimento: sem requisições de rede

Objetivo: mostrar que o **build de produção** não faz requisição de rede por conta própria.

**Revisão do código (primeira metade do critério).** Na raiz do repositório, procure usos de rede fora dos testes:

```bash
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|https?://" src --include=*.ts --include=*.tsx --include=*.json | grep -v "__tests__" | grep -v "\.test\."
```

O resultado esperado é uma única linha: `REPOSITORY_URL` em `src/app/settings.tsx`. Qualquer outra linha precisa ser explicada antes do release. Confira também que nenhuma dependência nova de rede entrou em `package.json`.

**Inspeção do tráfego (segunda metade).**

**O que instalar.** O ideal é o build de produção (`.aab`) instalado pela faixa de teste interno da Play Store, que é o que os usuários receberão. O APK do perfil `preview` (`npx eas-cli@latest build -p android --profile preview`) também embute o JavaScript e não tem o *launcher* de desenvolvimento, mas **não é o mesmo binário**; se for usado, registre isso nas observações. Nunca use o *development build*: ele fala com o servidor do Metro por definição.

**Prepare uma linha de base.** O sistema Android e o Google Play Services fazem requisições sozinhos. Para saber o que é do app, capture o tráfego em dois trechos de igual duração: primeiro com o app instalado e **fechado** (linha de base), depois usando o app.

**Opção A: proxy de inspeção (HTTP e HTTPS).**
1. No computador, rode um proxy de inspeção, por exemplo `mitmproxy` ou `mitmweb`, na porta 8080.
2. Emulador: inicie-o com `emulator -avd NOME -http-proxy http://localhost:8080`. Aparelho físico: no Wi-Fi, ponha o proxy manual com o IP do computador e a porta 8080 (computador e aparelho na mesma rede).
3. Para ler HTTPS seria preciso instalar o certificado do proxy no aparelho; **não é necessário** aqui: basta ver quais destinos o proxy recebe, e uma conexão HTTPS aparece como pedido `CONNECT` com o domínio de destino.
4. Limite do método: um app pode ignorar o proxy do sistema. Por isso a opção B existe.

**Opção B: captura de pacotes (pega tudo, inclusive DNS).** No emulador: `emulator -avd NOME -tcpdump captura.pcap`. Abra `captura.pcap` no Wireshark e filtre por `dns || tcp.flags.syn == 1 || udp`. Em aparelho físico, capture na interface de um ponto de acesso Wi-Fi criado no computador ao qual o aparelho se conecta.

**O que fazer no app (com a captura rodando).**
1. Abra o app e deixe-o parado por 1 minuto em **Meus pets**.
2. Cadastre um pet com foto, registre duas vacinas (uma com próxima dose), com foto da câmera e da galeria.
3. Abra o detalhe, a foto em tela cheia e **Ajustes e sobre**.
4. **Exportar PDF** e **Fazer backup agora** (cancele o menu de compartilhar sem enviar), e **Importar backup de um arquivo** com o arquivo gerado.
5. Aceite a permissão de notificações e deixe passar a hora de um lembrete, se possível (ver [#12](https://github.com/celsottg/petVaccines/issues/12)).
6. Feche o app e deixe a captura rodar mais 1 minuto.

**O que conta como aprovado.** Nenhum destino de rede aparece na captura de uso que não apareça também, com a mesma frequência, na linha de base do app fechado, e nada é endereçado a domínio ou IP que seja do app, do projeto ou de terceiros ligados a ele. Qualquer conexão nova durante o uso é reprovação até ser explicada; anote o destino nas observações.

**A única exceção legítima.** Em **Ajustes e sobre**, **Abrir o repositório no navegador** abre `https://github.com/celsottg/petVaccines` no navegador do sistema. O tráfego **do navegador** para o GitHub depois desse toque é esperado e não reprova. Faça esse toque somente no fim, depois de anotar o resultado do restante, ou separe a captura.

**Observação sobre permissões.** O manifesto padrão do Expo declara a permissão `INTERNET`, mesmo que o app não faça requisições. Ela não é prova de uso, mas aparece na página de permissões da loja e em inspeções do APK: o que prova a ausência de rede é a revisão do código e esta captura.

## Validações em aparelho pendentes

Consolidação dos testes em aparelho físico que as issues abertas descrevem. As issues continuam sendo a fonte: ao concluir, marque aqui e na issue.

### Lembretes e notificações ([#12](https://github.com/celsottg/petVaccines/issues/12))

Os testes automatizados usam um substituto do módulo de notificações, então a entrega real, o diálogo de permissão e o horário de chegada nunca foram exercitados.

Entrega:
- [ ] Registrar uma vacina com próxima dose para daqui a 7 dias.
- [ ] Ajustar a data do sistema e receber o lembrete de 7 dias antes, por volta das 09:00.
- [ ] Ajustar a data do sistema e receber o lembrete do dia, por volta das 09:00.
- [ ] O texto traz o nome do pet e da vacina ("Thor: Antirrábica vence em 7 dias" e "Thor: Antirrábica vence hoje").
- [ ] Tocar na notificação abre o app.
- [ ] No Android, anotar de quanto é o atraso em relação às 09:00 (o app não pede a permissão de alarme exato).

Permissão:
- [ ] O pedido de permissão aparece só depois de salvar a primeira vacina com próxima dose.
- [ ] Negar a permissão não impede o salvamento nem a navegação.
- [ ] Com a permissão negada, o detalhe da vacina avisa que os lembretes estão desligados no sistema.
- [ ] Liberar a permissão nos ajustes do sistema e voltar ao app: o aviso some e os lembretes são agendados.

Cancelamentos:
- [ ] Registrar um reforço: o lembrete da aplicação anterior não chega.
- [ ] Desligar o interruptor de lembretes de um registro: ele não notifica.
- [ ] Ligar e desligar o interruptor várias vezes seguidas: ele responde a todos os toques.
- [ ] Dar baixa no pet: os lembretes dele param.

Limite de agendamentos:
- [ ] Com mais de 25 vacinas vigentes com próxima dose (mais de 50 lembretes), conferir que os mais próximos chegam e que os demais são agendados conforme o app é aberto.

A issue também lista a repetição da entrega no iOS; isso pertence ao release do iOS.

### Exportação em PDF ([#14](https://github.com/celsottg/petVaccines/issues/14))

Entrega do arquivo:
- [ ] Exportar a carteira de um pet com 3 vacinas e fotos e abrir o arquivo no próprio aparelho.
- [ ] Enviar por WhatsApp e abrir o arquivo recebido no outro lado.
- [ ] Enviar por e-mail e abrir o arquivo recebido no outro lado.
- [ ] Salvar em Arquivos ou no Google Drive e abrir de lá.
- [ ] Exportar de novo logo em seguida e conferir que funciona.

O arquivo fica na pasta temporária depois de compartilhar, justamente para o destinatário conseguir lê-lo. Se algum app receber um arquivo vazio ou der erro, anotar qual.

Conteúdo e aparência:
- [ ] Cabeçalho, as sete colunas, ordem da mais recente para a mais antiga e traço nos campos vazios.
- [ ] Fotos identificadas por vacina e data, e rodapé com a data e o aviso declaratório.
- [ ] Nome do arquivo `carteira-<pet>-<data>.pdf` no menu de compartilhar.
- [ ] A tabela não corta linhas de forma estranha entre páginas.
- [ ] As fotos começam em página nova e nenhuma foto é dividida entre páginas.
- [ ] O documento continua legível impresso ou visualizado em preto e branco.
- [ ] Carteira de um pet com baixa mostra "Carteira encerrada" no cabeçalho.

Memória e tempo:
- [ ] Em um aparelho mais simples, exportar a carteira de um pet com muitas vacinas (15 ou mais) e 3 fotos em cada.
- [ ] Anotar o tempo de geração e o tamanho do arquivo.
- [ ] Anotar se o app fecha, trava ou mostra erro.

Decisão em aberto (dono do repositório): o PDF continua com todas as fotos, passa a incluir só as dos registros vigentes, ou reduz o tamanho das fotos no documento. O resultado do teste de memória decide; as três opções estão no PR #13. Se a decisão mudar o PDF, o código muda antes do release e este checklist é refeito nas linhas afetadas.

A issue também lista a repetição dos envios no iOS; isso pertence ao release do iOS.

> Observação: nesta cópia as caixas acima estão desmarcadas, mesmo onde a issue já marca itens (por exemplo, os envios por WhatsApp, e-mail e Arquivos na #14). Ao executar, siga o estado atual da issue.

## Build e publicação

### O que o dono precisa ter antes

- Conta de desenvolvedor do Google Play e o app criado no Play Console com o identificador `com.simplifica.petvaccines` (não pode mudar depois da publicação).
- Assinatura: gerenciada pelo EAS. Na primeira build de produção o EAS CLI oferece gerar a chave de upload; deixe-o gerar e guarde o acesso à conta Expo.
- Conta Expo com acesso ao projeto (o `projectId` já está no `app.json`) e `npx eas-cli@latest login` feito.
- Chave de conta de serviço do Google para o `eas submit` (Expo: Credentials > Android > Service credentials, ou `npx eas-cli@latest credentials --platform android`).
- Ficha da loja completa (ver Bloqueios).
- URL pública da política de privacidade, a partir de [`privacy-policy.md`](privacy-policy.md) e [`privacy-policy.en.md`](privacy-policy.en.md). A data de vigência da política (marcada como pendente no arquivo) precisa estar preenchida antes de publicar.
- Formulário de segurança dos dados (*Data safety*) do Play Console, coerente com a política. Com o backup automático do Android desligado (`allowBackup: false` no `app.json`) e sem uso de rede pelo app, as respostas são "nenhum dado coletado" e "nenhum dado compartilhado". Confirme isso só depois de passar a linha de rede da tabela de critérios. A permissão `INTERNET` é declarada pelo framework e vai aparecer na página da loja, mesmo sem uso: a política explica isso.
- Verificação do manifesto do **build de produção** (obrigatória): baixe o `.aab` da página do build no EAS e confira que `android:allowBackup` é `false` e quais permissões estão declaradas, comparando com a lista da política:

  ```bash
  bundletool dump manifest --bundle=app.aab | grep -E "allowBackup|uses-permission"
  ```

  (ou, com um APK: `aapt dump xmltree app.apk AndroidManifest.xml | grep -iE "allowBackup|permission"`). Se `allowBackup` não for `false` ou se aparecer uma permissão que a política não cita, corrija antes de publicar.
- Versão em `app.json`: `1.0.0`. O `versionCode` do Android é gerenciado pelo EAS (`appVersionSource: remote` com `autoIncrement` no perfil `production` do `eas.json`).

### Ordem dos passos

1. Todos os itens de **Bloqueios** marcados.
2. Rodar o fluxo ponta a ponta ([`.maestro/README.md`](../.maestro/README.md)) e corrigir o que falhar. Ele ainda não foi executado.
3. No commit que será lançado, com a árvore de trabalho limpa (o build do EAS é gerado a partir dele): `npm ci`, `npm run lint`, `npm run typecheck`, `npm test -- --ci`.
4. Gerar o build de produção (`.aab`) nesse mesmo commit:

   ```bash
   npx eas-cli@latest build -p android --profile production
   ```

5. Enviar para a faixa de teste interno:

   ```bash
   npx eas-cli@latest submit -p android --profile production
   ```

   O que a documentação do EAS Submit para Android diz (consultada em 2026-11-13): o `eas submit` exige o app já criado no Play Console, com `android.package` definido e um `.aab`; o comando padrão cria o primeiro release na faixa de teste interno, e o app fica em rascunho no Play Console até a ficha da loja e as tarefas de configuração serem concluídas; o EAS precisa de uma chave de conta de serviço do Google (a documentação não lista os papéis necessários: crie a conta de serviço no Google Cloud, convide-a no Play Console e dê acesso ao app), que fica guardada na conta Expo por identificador de pacote. O `eas.json` deste repositório **não** tem `serviceAccountKeyPath`, então o comando pede a chave de forma interativa (em modo não interativo ele falha). A documentação também oferece o caminho manual: criar o app e a ficha no Play Console e fazer o primeiro envio do `.aab` à faixa de teste interno por lá. Se o envio automático do primeiro release falhar, use o caminho manual e deixe o `eas submit` para os releases seguintes.
6. Instalar o build pela faixa de teste interno em aparelho real e executar a tabela de [Critérios de aceite](#critérios-de-aceite), inclusive o procedimento de rede, preenchendo resultado, data e observações.
7. Com todos os critérios aprovados, criar o commit e a tag da versão (ver [CONTRIBUTING.md](../CONTRIBUTING.md#como-lançar-uma-versão)):

   ```bash
   npm run release -- --first-release
   git push --follow-tags origin main
   ```

   `--first-release` gera o `CHANGELOG.md`, cria o commit `chore(release): 1.0.0` e a tag `v1.0.0` **sem mudar a versão**, que já é 1.0.0. O commit só acrescenta o `CHANGELOG.md`, então o código é o mesmo do build testado. Se a `main` for protegida e não aceitar o envio direto, abra um pull request com o commit e crie a tag no commit mesclado.
8. Promover o build testado para as faixas seguintes do Play Console (teste fechado, produção) quando decidir.

Para os releases seguintes use apenas `npm run release` (a versão sobe sozinha pelos commits).

## Depois do release

- Anunciar o release no repositório (página de *Releases* do GitHub, a partir da tag `v1.0.0`, com o trecho do `CHANGELOG.md`).
- Acompanhar issues e avaliações da loja; transformar relatos de bug em issues.
- Registrar no `CHANGELOG.md` e nas issues o que ficou para a próxima versão.
- Preparar o release do iOS: os mesmos critérios em aparelho real da Apple (etapa 9 da spec) e a repetição dos testes marcados como iOS nas issues #12 e #14.
- Opcional: avaliar a remoção de permissões declaradas e não usadas (por exemplo, o acesso legado ao armazenamento e a `INTERNET`) com `android.blockedPermissions` no `app.json`. Só tente com um aparelho à mão: a remoção pode quebrar o seletor de fotos em versões antigas do Android, e deve ser seguida de nova passagem pela tabela de critérios.
- Se a política de privacidade mudar, atualizar a data de vigência e republicar a URL.
