# Cheel Out Shop — ERP

Um sistema de gestão parecido com o Bling, feito para rodar no **GitHub Pages**. Os dados ficam salvos numa **planilha do Google Sheets**.

## Módulos

| Módulo | O que faz |
|---|---|
| **Painel** | Mostra as vendas do mês, o que há a receber e a pagar (com as contas vencidas), o valor do estoque, um gráfico de vendas × compras dos últimos 6 meses, os vencimentos dos próximos 7 dias, os produtos com estoque baixo e as últimas vendas |
| **Vendas** | Lança pedidos com vários itens, frete, desconto, canal (loja, site, Mercado Livre, Shopee…), forma de pagamento e parcelas. Ao **Faturar** (status *Atendido*), dá baixa no estoque e gera as contas a receber. Os pedidos podem ser impressos |
| **Pedidos de compra** | Lança pedidos para fornecedores. Ao **Receber**, a mercadoria entra no estoque, o custo do produto é atualizado e as contas a pagar são geradas |
| **Produtos** | Cadastro com SKU, categoria, unidade, custo, preço, margem, estoque mínimo, EAN e NCM. Também registra o estoque inicial e permite marcar o produto como ativo ou inativo |
| **Controle de estoque** | Mostra o saldo de cada produto e o valor do estoque (a custo e a preço de venda). Tem alertas de reposição, lançamento de entradas e saídas, histórico de movimentações e **balanço/inventário** (você informa a contagem e o sistema ajusta a diferença) |
| **Contas a receber / a pagar** | Tem filtros para contas em aberto, vencidas e pagas, além de filtro por mês. Permite dar baixa com juros ou desconto, estornar e criar contas recorrentes (por exemplo, o aluguel mensal) |
| **Clientes e fornecedores** | Cadastro de contatos com link direto para o WhatsApp |
| **Configurações** | Conexão com o Google Sheets, backup e importação (.json), exportação de produtos para .csv e dados de exemplo para testar |

---

## 1) Publicar no GitHub Pages

1. Crie um repositório no GitHub (por exemplo, `cheeloutshop-erp`).
2. Envie **todos os arquivos** do zip usando **Add file › Upload files**.
3. Vá em **Settings › Pages**, escolha **Deploy from a branch**, depois `main` e `/ (root)`, e clique em **Save**.
4. Em cerca de 1 minuto o site fica no ar em `https://SEU-USUARIO.github.io/cheeloutshop-erp/`.

## 2) Ligar a planilha do Google Sheets (uma vez só)

1. Entre na conta **cheeloutshop@gmail.com** e crie uma **planilha nova** no Google Sheets.
2. Abra **Extensões › Apps Script**, apague o código que aparecer e **cole todo o conteúdo** de `apps-script/Code.gs`. Salve.
3. No topo, selecione a função **`setup`** e clique em **Executar**. Autorize o acesso: clique em *Revisar permissões*, depois em *Avançado* e em *Acessar*. Isso cria as abas e libera o envio do e-mail de recuperação de senha.
4. Clique em **Implantar › Nova implantação**. Na engrenagem, escolha **App da Web**, com **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**. Clique em **Implantar** e copie a URL (ela termina em `/exec`).
5. No GitHub, abra o arquivo **`config.js`**, clique no lápis ✏️, cole a URL em `apiUrl: '...'` e faça o **Commit**.

## 3) Primeiro acesso

1. Abra o site e clique em **Criar novo acesso**.
2. O e-mail já vem preenchido com **cheeloutshop@gmail.com**. Crie a senha (mínimo de 8 caracteres) e pronto.
3. Nos próximos acessos, basta entrar com o e-mail e a senha.

> Faça o primeiro acesso logo depois de publicar: até existir uma senha, o botão **Criar novo acesso** fica disponível.

### Segurança do login

- As senhas **não ficam na planilha nem no GitHub**. Elas são guardadas criptografadas (hash) nas *Propriedades do script*, que só o dono da conta Google vê.
- Só o e-mail da lista `EMAILS_PERMITIDOS` (no `Code.gs`) consegue criar acesso ou entrar.
- Depois de 5 senhas erradas, o login fica bloqueado por 10 minutos.
- A sessão dura 12 horas, ou 30 dias se você marcar **Manter conectado**. Ao sair, os dados são apagados do navegador.
- **Esqueci minha senha:** o sistema envia um código de 6 dígitos para cheeloutshop@gmail.com.
- **Emergência:** no Apps Script, execute a função `resetarAcessos` para apagar a senha e criar um novo acesso pelo site.
- A senha pode ser trocada em **Configurações › Acesso**.

### Modo local

Se o `config.js` estiver sem URL, o ERP funciona em **modo local**: login e dados ficam só naquele navegador. Isso serve para testar. Quando você conectar a planilha, o sistema oferece enviar os dados locais para ela.

### Importante

- Se você **alterar o `Code.gs`**, é preciso republicar: vá em **Implantar › Gerenciar implantações**, clique no lápis ✏️, escolha **Nova versão** e depois **Implantar**. Assim a URL continua a mesma.
- Evite editar a planilha à mão com o sistema aberto. Se editar, use **Configurações › Recarregar da planilha**.
- Faça **backups periódicos** em Configurações › Exportar backup.


## Atualizar o script da planilha (v10 — backup automático)

1. Na planilha, abra **Extensões › Apps Script**, apague tudo e cole o novo `apps-script/Code.gs`. Salve.
2. Selecione a função **`setup`** e clique em **Executar**. O Google vai pedir uma nova autorização (Google Drive e agendamento): aprove.
3. Clique em **Implantar › Gerenciar implantações**, no lápis ✏️, em **Versão: Nova versão** e em **Implantar**. A URL continua a mesma.

A partir daí, todo dia às 3h (e no primeiro login do dia) é salva uma cópia completa da planilha na pasta **"Cheel Out Shop — Backups do ERP"** do Google Drive. Ficam guardados os últimos 30 dias.

As configurações avançadas (conexão, troca de senha, importar/exportar, dados de exemplo) continuam disponíveis no endereço `#/avancado` do site.

## Como os dados se ligam

```
Pedido de venda  ──(Atendido)──►  saída no estoque  +  contas a receber
Pedido de compra ──(Recebido)──►  entrada no estoque +  contas a pagar  + atualiza o custo
Balanço          ─────────────►  ajuste (entrada/saída) da diferença contada
```

O saldo de estoque é sempre calculado a partir da aba `movimentos`, que funciona como o histórico completo do estoque.

## Estrutura

```
index.html          → páginas, menu e tela de login
config.js           → URL do Apps Script e e-mail de acesso (edite aqui)
style.css           → visual (cores da marca)
app.js              → toda a lógica do ERP e do login
favicon*.png / icon-*.png / apple-touch-icon.png / manifest.webmanifest → ícones do site e do app no celular
logo.png            → logo da Cheel Out Shop (menu, login, animação e impressão)
apps-script/Code.gs → API + login (cole no Apps Script da planilha)
```
