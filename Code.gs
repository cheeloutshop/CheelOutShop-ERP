/**
 * Cheel Out Shop — ERP
 * API do Google Sheets (Google Apps Script)
 *
 * COMO USAR (resumo — veja o README.md para o passo a passo):
 * 1. Crie uma planilha nova no Google Sheets.
 * 2. Menu Extensões > Apps Script. Apague o conteúdo e cole este arquivo.
 * 3. Troque a senha em API_KEY abaixo.
 * 4. Selecione a função "setup" e clique em Executar (autorize o acesso).
 * 5. Implantar > Nova implantação > Tipo "App da Web"
 *      Executar como: Eu | Quem pode acessar: Qualquer pessoa
 * 6. Copie a URL gerada (termina em /exec) e cole no ERP em Configurações.
 */

// >>> TROQUE ESTA SENHA <<< (use a mesma no ERP, em Configurações)
const API_KEY = 'troque-esta-senha';

const SHEETS = {
  produtos:   ['id', 'sku', 'nome', 'categoria', 'unidade', 'custo', 'preco', 'estoqueMin', 'ean', 'ncm', 'ativo', 'criadoEm'],
  contatos:   ['id', 'tipo', 'nome', 'documento', 'telefone', 'email', 'cidade', 'uf', 'obs', 'criadoEm'],
  movimentos: ['id', 'data', 'produtoId', 'tipo', 'quantidade', 'custoUnit', 'origem', 'origemId', 'obs', 'criadoEm'],
  compras:    ['id', 'numero', 'data', 'fornecedorId', 'status', 'itens', 'frete', 'desconto', 'total', 'formaPgto', 'parcelas', 'vencimento', 'obs', 'criadoEm'],
  vendas:     ['id', 'numero', 'data', 'clienteId', 'canal', 'status', 'itens', 'frete', 'desconto', 'total', 'formaPgto', 'parcelas', 'vencimento', 'obs', 'criadoEm'],
  pagar:      ['id', 'descricao', 'contatoId', 'categoria', 'vencimento', 'valor', 'status', 'pagoEm', 'valorPago', 'origem', 'origemId', 'obs', 'criadoEm'],
  receber:    ['id', 'descricao', 'contatoId', 'categoria', 'vencimento', 'valor', 'status', 'pagoEm', 'valorPago', 'origem', 'origemId', 'obs', 'criadoEm'],
};

/** Cria as abas e cabeçalhos. Pode rodar de novo sem perder dados. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    const cols = SHEETS[name];
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    // Tudo como texto: evita o Sheets converter datas/números sozinho
    sh.getRange(1, 1, sh.getMaxRows(), Math.max(cols.length, sh.getMaxColumns())).setNumberFormat('@');
    const header = sh.getRange(1, 1, 1, cols.length);
    const atual = header.getValues()[0];
    if (atual.join('') === '') {
      header.setValues([cols]).setFontWeight('bold').setBackground('#0B3A8C').setFontColor('#FFD400');
      sh.setFrozenRows(1);
    } else {
      // adiciona colunas novas que ainda não existam
      cols.forEach(function (c) {
        if (atual.indexOf(c) === -1) {
          sh.getRange(1, sh.getLastColumn() + 1).setValue(c).setFontWeight('bold');
        }
      });
    }
  });
  const padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && ss.getSheets().length > 1 && padrao.getLastRow() === 0) ss.deleteSheet(padrao);
}

function doGet(e) {
  return handle_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  return handle_(body);
}

function handle_(req) {
  try {
    if (String(req.key || '') !== API_KEY) throw new Error('Senha da API incorreta');
    let data;
    switch (req.action) {
      case 'ping':   data = { pong: true, planilha: SpreadsheetApp.getActiveSpreadsheet().getName() }; break;
      case 'getAll': data = getAll_(); break;
      case 'batch':  data = batch_(req.ops || []); break;
      default: throw new Error('Ação desconhecida: ' + req.action);
    }
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name) {
  if (!SHEETS[name]) throw new Error('Aba inválida: ' + name);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Aba "' + name + '" não existe. Rode a função setup().');
  return sh;
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function getAll_() {
  const out = {};
  Object.keys(SHEETS).forEach(function (name) {
    const sh = sheet_(name);
    const last = sh.getLastRow();
    if (last < 2) { out[name] = []; return; }
    const head = headers_(sh);
    const rows = sh.getRange(2, 1, last - 1, head.length).getDisplayValues();
    out[name] = rows
      .filter(function (r) { return r[0] !== ''; })
      .map(function (r) {
        const o = {};
        head.forEach(function (h, i) { if (h) o[h] = r[i]; });
        if (o.itens) { try { o.itens = JSON.parse(o.itens); } catch (e) { o.itens = []; } }
        return o;
      });
  });
  return out;
}

function batch_(ops) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = {};
    function ctx(name) {
      if (!cache[name]) {
        const sh = sheet_(name);
        const head = headers_(sh);
        const last = sh.getLastRow();
        const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getDisplayValues().map(function (r) { return r[0]; }) : [];
        cache[name] = { sh: sh, head: head, ids: ids };
      }
      return cache[name];
    }
    let n = 0;
    ops.forEach(function (op) {
      const c = ctx(op.sheet);
      if (op.op === 'upsert') {
        const rec = op.record || {};
        if (!rec.id) throw new Error('Registro sem id');
        const row = c.head.map(function (h) {
          const v = rec[h];
          if (v === undefined || v === null) return '';
          if (typeof v === 'object') return JSON.stringify(v);
          return String(v);
        });
        const idx = c.ids.indexOf(String(rec.id));
        if (idx >= 0) {
          c.sh.getRange(idx + 2, 1, 1, row.length).setNumberFormat('@').setValues([row]);
        } else {
          const r = c.ids.length + 2;
          c.sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
          c.ids.push(String(rec.id));
        }
        n++;
      } else if (op.op === 'delete') {
        const i = c.ids.indexOf(String(op.id));
        if (i >= 0) {
          c.sh.deleteRow(i + 2);
          c.ids.splice(i, 1);
          n++;
        }
      }
    });
    return { aplicadas: n };
  } finally {
    lock.releaseLock();
  }
}
