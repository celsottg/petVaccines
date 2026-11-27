# Fluxo ponta a ponta (Maestro)

> **Validado em 27/11/2026** em um emulador Android 17 (API 37, imagem com Google Play, sistema em inglês), com um build de release local e o Maestro 2.13.0. O fluxo passou com e sem o passo da foto. **Não foi executado** em outras versões do Android, em aparelho físico nem com o sistema em português; o seletor de fotos do sistema é a parte que mais pode mudar nesses casos.

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

   Confirmar que a imagem está na galeria é opcional, mas poupa tempo se o fluxo falhar no seletor: abra o app Fotos do emulador, ou confira pela linha de comando que o sistema registrou o arquivo:

   ```bash
   adb shell content query --uri content://media/external/images/media --projection _id:_display_name | grep foto.jpg
   ```

   Se a linha não aparecer, rode de novo o `am broadcast` acima ou reinicie o emulador.

## 3. Instalar o app no emulador

O fluxo começa com `clearState`, que apaga os dados do app. Num *development build* isso também apaga a lista de servidores da tela inicial do `expo-dev-client`, e o fluxo não sabe passar por essa tela. Por isso use um build **sem** o *launcher* de desenvolvimento, que embute o JavaScript:

```bash
npx expo run:android --variant release
```

ou o perfil `preview` do EAS (gera um APK instalável com `adb install`):

```bash
npx eas-cli@latest build -p android --profile preview
```

O `launchApp` do Maestro concede as permissões do app por padrão, então o diálogo de notificações normalmente nem aparece; o fluxo ainda tem uma espera opcional e limitada por ele.

Se preferir o *development build* (`npx expo run:android`), conecte-o ao servidor do Metro à mão e adapte o início do fluxo; isso não foi preparado nem testado aqui.

## 4. Rodar

Com o app instalado e o emulador aberto:

```bash
maestro test .maestro/register-vaccination.yaml
```

Para depurar seletores, `maestro studio` abre uma tela que mostra o que o Maestro enxerga. Os textos e rótulos usados no fluxo vêm de `src/i18n/pt-BR.json`; se mudar um texto da interface, atualize o fluxo.

Ao validar o fluxo em outra versão do Android ou em um aparelho, acrescente a versão do Android e do Maestro ao aviso do topo deste README e dos dois arquivos.

## Rodar sem tela (emulador sem janela)

Em uma máquina sem ambiente gráfico disponível, o emulador pode rodar sem janela:

```bash
emulator -avd <nome-do-avd> -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect
```

Para ver a tela em um dado momento: `adb exec-out screencap -p > tela.png`.
