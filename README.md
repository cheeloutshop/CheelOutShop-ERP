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


## v11 — pedido de compra

- Número sequencial automático, sem edição (o número só é usado quando o pedido é salvo).
- Pedidos de compra não são excluídos: use **Cancelar** (estorna o estoque e remove parcelas não pagas).
- Fornecedor com busca a partir de 3 letras e cadastro rápido; CPF/CNPJ identificado sozinho, com busca dos dados do CNPJ na Receita.
- Embalagem (CX, FD, PCT…) com "unidades por embalagem": o estoque recebe em unidades.
- Pagamento: Pix (à vista), Cartão de crédito, Boleto e Reembolso (parcelados).
- Contas a pagar lançadas ao salvar o pedido; estoque entra ao marcar como Recebido.
- **Atualize o script da planilha e rode `setup` de novo** para criar as colunas novas (fantasia, cep, endereco, previsao, recebidoEm).


## v14 — frente de caixa, fotos, plataformas e insumos

- **Nova venda** abre o **Frente de caixa**: número fixo, data editável, cliente com busca (3 letras) e cadastro rápido, plataforma de venda, produto com foto e busca (3 letras / código de barras), quantidade, valor unitário, subtotal, desconto e forma de pagamento.
- **Fotos de produtos**: no cadastro do produto (aba Produtos ou no frente de caixa). Com a planilha conectada, ficam na pasta "Cheel Out Shop — Fotos de produtos" do Google Drive.
- **Configurações › Plataformas de venda**: WhatsApp, Jamble, Retirada (e outras), cada uma com % de comissão. A comissão de cada venda aparece na lista de vendas e no Painel.
- **Compra de insumos** (menu Compras): embalagens e materiais de envio; gera contas a pagar, não mexe no estoque de produtos.
- **Atualize o script da planilha e rode `setup`** (cria as abas `insumos` e `plataformas`, as colunas novas e a pasta de fotos).


## v17 — Jamble e custos

- Clientes com **Nick na Jamble** (@usuário); a importação preenche e reconhece o cliente pelo nick.
- Importação do PDF: **sempre plataforma Jamble**. Produto com nome igual (ou já confirmado antes) = venda confirmada; nome parecido ou sem cadastro = **venda Pendente** (não baixa estoque nem lança a receber) até você confirmar em Vendas › Confirmar. Os nomes confirmados passam a ser reconhecidos nas próximas importações.
- Pedido de compra: mostra o **último custo** de cada produto e se o custo do pedido está acima ou abaixo. O **frete é rateado** pelo valor de cada item e entra no custo do produto; não soma no total do pedido.
- **Atualize o script da planilha e rode `setup`** (colunas `nick` em contatos e `apelidos` em produtos).

## v18 — Jamble, fluxo de caixa, balanço em PDF e consignação

- **Painel**: botão **📄 Importar etiquetas (PDF)**, faixa da **Jamble a receber** com alerta do que passou de 20 dias, e **Fluxo de caixa** do mês (entrou, saiu, resultado) com a posição da loja hoje (caixa + a receber − a pagar + estoque).
- **Jamble**: prazo de repasse fixo em **20 dias** (importação e frente de caixa). O valor a receber é sempre o líquido (depois da taxa).
- **Contas a receber › Saque Jamble**: informe data e valor sacado; o valor dá baixa nas vendas mais antigas primeiro (a última pode ficar parcial) e o saldo se atualiza. Tem histórico e opção de desfazer.
- **Balanço / inventário**: mostra sobras e faltas enquanto você digita, e gera **PDF** com quantidades a mais/a menos e os valores totais. Os balanços antigos ficam em Controle de estoque › Balanços, com o PDF para baixar de novo.
- **Consignação**: em Configurações, cadastre o dono dos produtos com o **imposto %** e a **comissão %** combinados. No produto, escolha o dono (custo zero) e, se quiser, taxas diferentes. Ao faturar a venda, entra em Contas a pagar o **repasse** = valor vendido − taxa da Jamble − imposto − comissão.
- **Atualize o script da planilha** (cole o novo `Code.gs` e publique uma **nova versão**). As abas/colunas novas (`saques`, consignação) são criadas sozinhas no primeiro acesso.

## v19 — saldos, taxa de saque, retiradas dos sócios e sorteios

- **Saldos de abertura** (Configurações): conta do banco, Jamble disponível e Jamble a liberar. O Painel mostra o **saldo em conta** = saldo inicial + recebido − pago.
- **Saque Jamble** com **taxa de saque** e **antecipação** (1% do valor antecipado, editável). As taxas entram em Contas a pagar (já pagas) na categoria **Comissão Jamble** e somam nas comissões do mês.
- A faixa da Jamble mostra **disponível para saque** (vendas com mais de 20 dias) e **a liberar**.
- **Retirada** = pró-labore dos sócios em produtos: escolha o sócio (Michel Méleck Proença ou Igor Pacci Érnica). Baixa o estoque a custo, não gera valor a receber e fica fora das vendas, margens e comissões. Retiradas antigas lançadas como venda são convertidas automaticamente.
- **Sorteio** (nova plataforma): baixa o estoque a custo, com a identificação do sorteio, e aparece no Painel como **custo do mês**, separado.
- **Atualize o script da planilha** (nova versão da implantação). As colunas novas são criadas sozinhas.

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
