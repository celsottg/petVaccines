# Como contribuir

🇧🇷 Português · [🇺🇸 English](CONTRIBUTING.en.md)

Obrigado por querer ajudar o **Vacinas do Pet**! Este guia explica como abrir issues, rodar o projeto e enviar mudanças. Duas formas de contribuir não exigem programação: [propor uma vacina para o catálogo](#propor-uma-vacina-para-o-catálogo) e [traduzir o app](#traduzir-o-app).

Ao participar, você concorda com o nosso [código de conduta](CODE_OF_CONDUCT.md).

## Abrir uma issue

Use os modelos em [Issues → New issue](https://github.com/celsottg/petVaccines/issues/new/choose):

- **Bug:** algo não funciona como deveria.
- **Sugestão:** uma ideia de melhoria ou de nova função.
- **Vacina no catálogo:** incluir ou corrigir uma vacina.

As issues são escritas em português. Procure antes se já existe uma issue parecida. Issues marcadas como **boa primeira contribuição** são um bom ponto de partida.

## Rodar o projeto

Pré-requisitos: [Node.js](https://nodejs.org) LTS e um emulador Android/iOS ou um aparelho.

```bash
npm ci
npx expo run:android   # ou: npx expo run:ios
```

O app usa bibliotecas nativas que não existem no Expo Go, por isso roda em um *development build*. As pastas `android/` e `ios/` são geradas automaticamente; não as edite à mão. Configurações nativas ficam no `app.json`.

Antes de abrir um pull request, rode:

```bash
npm test            # testes
npm run lint        # lint
npm run typecheck   # tipos
```

### Organização do código

- `src/app/`: telas (rotas do Expo Router).
- `src/domain/`: regras de negócio puras, sem React nem banco. Toda regra nova ganha teste aqui.
- `src/data/`, `src/db/`: banco SQLite e acesso a dados.
- `src/services/`: fotos, notificações, PDF e backup.
- `src/catalog/`: catálogo de vacinas por país.
- `src/i18n/`: textos da interface. **Nenhum texto é escrito direto nas telas.**
- `src/theme/`: cores, espaçamentos e tipografia.

Código (nomes, tabelas, arquivos e commits) é em inglês; a interface é em português.

## Padrão de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/pt-br/), que permitem gerar a versão e o changelog automaticamente:

```
<tipo>(<escopo opcional>): <descrição em inglês, no imperativo>
```

Tipos mais usados: `feat` (nova função), `fix` (correção), `docs`, `test`, `refactor`, `chore`. Exemplos:

```
feat(vaccinations): add booster shortcut
fix(reminders): skip reminders whose time already passed
docs: explain how to translate the app
```

## Pull requests

1. Crie um branch a partir de `main`.
2. Faça a mudança com testes, quando fizer sentido.
3. Rode os três comandos de verificação.
4. Abra o pull request preenchendo o modelo. O GitHub Actions roda lint, tipos e testes automaticamente.

## Propor uma vacina para o catálogo

Você **não precisa programar**. Abra uma issue com o modelo **Vacina no catálogo** e informe:

- o nome da vacina como aparece na carteirinha;
- a espécie (cão ou gato);
- o intervalo de reforço usual (por exemplo, 1 ano);
- uma fonte, como a bula, uma orientação veterinária ou uma referência técnica.

Alguém da equipe transforma a proposta em código. Se quiser fazer você mesmo, o catálogo fica em `src/catalog/br.json`; cada vacina tem um `id` estável (por exemplo `br-dog-rabies`) que nunca é reaproveitado. O conteúdo do catálogo é revisado por uma veterinária antes de cada release.

## Traduzir o app

Também **não precisa programar**. Todos os textos ficam em um único arquivo por idioma, em `src/i18n/` (o português está em `pt-BR.json`).

- **Pelo GitHub, no navegador:** abra `src/i18n/pt-BR.json`, copie o conteúdo, traduza só os textos à direita dos `:` (mantenha as chaves à esquerda e os trechos entre `{{ }}` como estão) e abra uma issue com o modelo **Sugestão** colando a tradução. Ou crie o arquivo novo (por exemplo `en.json`) direto pelo botão *Add file* do GitHub, que abre o pull request para você.
- **Revisar textos:** encontrou um erro de português ou um texto confuso? Abra uma issue ou edite o `pt-BR.json` pelo GitHub.

Exemplo:

```json
{ "pets": { "add": "Adicionar pet" } }
```

vira, em inglês:

```json
{ "pets": { "add": "Add pet" } }
```

## Dúvidas

Abra uma issue com o modelo **Sugestão** e descreva sua dúvida.
