# Fluxo ponta a ponta (Maestro)

> **Atenção: os fluxos desta pasta ainda NÃO foram executados.** Foram escritos lendo as telas e o `src/i18n/pt-BR.json`, sem acesso a um emulador. Rode-os, corrija o que falhar e só então confie neles.

Esta pasta guarda o teste ponta a ponta do app, escrito para o [Maestro](https://docs.maestro.dev/). Ele cobre o caminho principal da spec (seção 12): cadastrar o pet "Thor" (cão), registrar a vacina "Antirrábica" escolhida entre as sugestões do catálogo, anexar uma foto da galeria e conferir, na carteira, o cartão com o selo "Em dia" e sem o selo "Sem comprovante".

| Arquivo | O que faz |
|---|---|
| `register-vaccination.yaml` | O fluxo completo. A data de aplicação não é digitada: o formulário já começa com a data de hoje. |
| `subflows/attach-gallery-photo.yaml` | Só o passo do seletor de fotos do sistema, isolado porque muda entre versões do Android. Fica em subpasta de propósito: `maestro test .maestro` roda apenas os fluxos do primeiro nível. |

## Variante sem foto

O seletor de fotos é uma tela do Android, não do app, e é a parte mais provável de precisar de ajuste. Para pular a foto e verificar o selo "Sem comprovante" no lugar:

```bash
maestro test -e WITH_PHOTO=false .maestro/register-vaccination.yaml
```

## 1. Instalar o Maestro

Requer Java 17 ou superior (`java -version`; `JAVA_HOME` apontando para ele). No Linux e no macOS:

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
maestro --help   # confirma a instalação
```

Outras formas de instalar: [documentação do Maestro](https://docs.maestro.dev/getting-started/installing-maestro).

## 2. Preparar o emulador

1. Crie e inicie um emulador Android (Android Studio, *Device Manager*) e confira com `adb devices`.
2. Ponha ao menos uma imagem na galeria do emulador. Por exemplo, com uma imagem `foto.jpg` do seu computador:

   ```bash
   adb push foto.jpg /sdcard/Pictures/foto.jpg
   adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/foto.jpg
   ```

   Abra o app Fotos do emulador e confirme que a imagem aparece.

## 3. Instalar o app no emulador

O fluxo começa com `clearState`, que apaga os dados do app. Num *development build* isso também apaga a lista de servidores da tela inicial do `expo-dev-client`, e o fluxo não sabe passar por essa tela. Por isso use um build **sem** o *launcher* de desenvolvimento, que embute o JavaScript:

```bash
npx expo run:android --variant release
```

ou o perfil `preview` do EAS (gera um APK instalável com `adb install`):

```bash
npx eas-cli@latest build -p android --profile preview
```

Se preferir o *development build* (`npx expo run:android`), conecte-o ao servidor do Metro à mão e adapte o início do fluxo; isso não foi preparado nem testado aqui.

## 4. Rodar

Com o app instalado e o emulador aberto:

```bash
maestro test .maestro/register-vaccination.yaml
```

Para depurar seletores, `maestro studio` abre uma tela que mostra o que o Maestro enxerga. Os textos e rótulos usados no fluxo vêm de `src/i18n/pt-BR.json`; se mudar um texto da interface, atualize o fluxo.

Quando o fluxo passar, retire o aviso de "NÃO foi executado" do topo dos dois arquivos e deste README, anotando a versão do Android e do Maestro com que foi validado.
