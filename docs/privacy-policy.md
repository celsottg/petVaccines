# Política de privacidade do Vacinas do Pet

🇧🇷 Português · [🇺🇸 English](privacy-policy.en.md)

**Data de vigência:** [PREENCHER: data em que esta versão passa a valer, antes de publicar]

## Em resumo

O Vacinas do Pet **não coleta, não envia e não compartilha nenhum dado seu**. Não existe conta, login nem servidor do app. Tudo o que você registra fica **somente no seu aparelho**. O app não tem anúncios, rastreamento nem ferramentas de análise de uso.

## Quem publica o app

O Vacinas do Pet é um aplicativo de código aberto, licenciado sob a GPL-3.0, mantido pelo projeto no GitHub: <https://github.com/celsottg/petVaccines>. Publicador na loja: [PREENCHER: nome do publicador exatamente como consta no Play Console]. Qualquer pessoa pode ler o código para conferir o que está escrito aqui.

## Que dados ficam no aparelho

Tudo o que você digita ou fotografa no app é guardado apenas no armazenamento interno do app, no seu aparelho:

- dados dos pets: nome, espécie, raça, sexo, data de nascimento, foto de perfil e, se houver, motivo e data da baixa;
- registros de vacinas: nome da vacina, datas, lote, marca, clínica, observações e o **nome do veterinário e o número do CRMV**, quando você os digita;
- fotos dos comprovantes de vacinação;
- suas preferências (prazo de "vence em breve", antecedência dos lembretes, prazo do aviso de backup) e a data do último backup.

O app não envia esses dados a ninguém e não tem como lê-los de fora do aparelho.

## Permissões do aparelho e para que servem

- **Câmera.** Pedida só quando você toca em **Tirar foto**, para fotografar o comprovante de vacinação ou a foto do pet. A foto é guardada no seu aparelho. Se você negar, o app continua funcionando e você pode escolher uma foto da galeria.
- **Fotos da galeria.** O app usa o seletor de fotos do sistema quando você toca em **Escolher da galeria**. O app só recebe a imagem que você escolher, e não pede permissão para ver a sua galeria.
- **Notificações.** Pedida depois que você salva a primeira vacina que tenha data de próxima dose, para avisar do vencimento. Os lembretes são **notificações locais**, agendadas pelo próprio aparelho às 09:00: não existe serviço de notificações por servidor (push) e nada sai do aparelho. O texto de um lembrete traz o nome do pet e o da vacina e é exibido conforme as configurações de notificação e de tela de bloqueio do seu aparelho. Se você negar a permissão, o app continua funcionando, sem lembretes.

O app não usa localização, microfone, contatos nem qualquer outro recurso do aparelho para coletar informações.

## Fotos

Cada foto que você adiciona é reduzida (o maior lado fica com no máximo 2048 pixels) e salva de novo como JPEG no próprio aparelho. O app foi feito para guardar apenas essa cópia nova, sem os metadados da foto original, entre eles a localização (GPS). A foto original continua onde estava (por exemplo, na sua galeria) e o app não a altera.

## PDF e backup: o que sai do aparelho e quando

- **PDF da carteira.** É gerado no aparelho quando você toca em **Exportar PDF**. Inclui os dados do pet, as vacinas e as fotos dos comprovantes.
- **Arquivo de backup.** É um arquivo `.zip` gerado no aparelho quando você toca em **Fazer backup agora**. Ele contém **todos os dados e todas as fotos** do app e **não é criptografado**: quem tiver o arquivo pode ler o conteúdo.
- Os dois arquivos só saem do aparelho **se você escolher**, no menu de compartilhar do sistema (por exemplo, e-mail, WhatsApp, Google Drive ou Arquivos). A partir daí o arquivo está sob o controle do aplicativo ou da pessoa que o recebeu, e esta política não se aplica a eles. Escolha com cuidado para onde envia e onde guarda o backup.
- Ao **restaurar** um backup, você escolhe o arquivo com o seletor do sistema e o app o lê no próprio aparelho. Nada é enviado.

## Cópia de segurança do sistema Android

O Android pode, quando o recurso de backup do sistema está ligado no seu aparelho, copiar os dados de aplicativos para a sua conta Google. Isso é feito pelo sistema operacional e controlado por você nas configurações do aparelho, não pelo Vacinas do Pet, que não tem acesso a essa cópia nem a envia.
<!-- Remova esta seção se android.allowBackup passar a ser false no app.json. -->

## Como apagar os dados

Desinstalar o app ou limpar os dados dele nas configurações do Android apaga do aparelho os pets, as vacinas, as fotos e as preferências. O app não guarda cópia em servidor, então os dados só podem ser recuperados a partir de um arquivo de backup que **você** tenha guardado (ou de uma cópia do sistema, se houver, conforme a seção anterior). Arquivos de PDF e de backup que você já enviou para outros lugares não são apagados junto com o app.

## Links que saem do app

O único link do app que abre algo fora dele é o do repositório de código, em **Ajustes e sobre**. Ele abre no navegador do sistema quando você toca em **Abrir o repositório no navegador**. A partir daí, a navegação é do seu navegador e do site aberto, o GitHub, que tem a política dele. O app não faz outras requisições de rede e funciona normalmente em modo avião.

## Crianças

O app não é direcionado a crianças. Como ele não coleta dado de ninguém, não há dados de crianças coletados.

## Contato

Para dúvidas, correções ou pedidos sobre esta política, abra uma issue em <https://github.com/celsottg/petVaccines/issues>.

## Mudanças nesta política

Quando esta política mudar, a data de vigência no topo é atualizada e o histórico de alterações do documento fica público no repositório. Esta versão estará disponível no mesmo endereço indicado na ficha do app na loja.
