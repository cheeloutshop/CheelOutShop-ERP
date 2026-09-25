/**
 * Cheel Out Shop — ERP
 * API do Google Sheets + login (Google Apps Script)
 *
 * COMO USAR (resumo — veja o README.md para o passo a passo):
 * 1. Crie uma planilha nova no Google Sheets (de preferência logado em cheeloutshop@gmail.com).
 * 2. Menu Extensões > Apps Script. Apague o conteúdo e cole este arquivo.
 * 3. Selecione a função "setup" e clique em Executar (autorize o acesso).
 * 4. Implantar > Nova implantação > Tipo "App da Web"
 *      Executar como: Eu | Quem pode acessar: Qualquer pessoa
 * 5. Copie a URL gerada (termina em /exec) e cole no arquivo config.js do site.
 * 6. Abra o site e clique em "Criar novo acesso" para cadastrar a senha.
 *
 * As senhas NÃO ficam na planilha: ficam guardadas criptografadas (hash) nas
 * Propriedades do script, que só o dono da conta Google consegue ver.
 */

// E-mails que podem acessar o ERP
const EMAILS_PERMITIDOS = ['cheeloutshop@gmail.com'];

const SESSAO_HORAS = 12;          // login normal
const SESSAO_DIAS_LEMBRAR = 30;   // "manter conectado"
const MAX_TENTATIVAS = 5;         // erros de senha antes de bloquear por 10 min

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
  MailApp.getRemainingDailyQuota(); // pede a autorização de envio de e-mail (recuperar senha)
  const padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && ss.getSheets().length > 1 && padrao.getLastRow() === 0) ss.deleteSheet(padrao);
}

function doGet() {
  return json_({ ok: true, data: { pong: true } });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  return handle_(body);
}

function handle_(req) {
  try {
    let data;
    switch (req.action) {
      case 'ping':     data = { pong: true }; break;
      case 'register': data = register_(req.email, req.senha, req.lembrar); break;
      case 'login':    data = login_(req.email, req.senha, req.lembrar); break;
      case 'forgot':   data = forgot_(req.email); break;
      case 'reset':    data = reset_(req.email, req.codigo, req.senha); break;
      default: {
        const sess = auth_(req.token);
        switch (req.action) {
          case 'logout':         props_().deleteProperty('sess:' + req.token); data = {}; break;
          case 'changePassword': data = changePassword_(sess.email, req.atual, req.nova); break;
          case 'getAll':         data = getAll_(); break;
          case 'batch':          data = batch_(req.ops || []); break;
          default: throw new Error('Ação desconhecida: ' + req.action);
        }
      }
    }
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/* ===================== LOGIN ===================== */
function props_() { return PropertiesService.getScriptProperties(); }
function normEmail_(e) { return String(e || '').trim().toLowerCase(); }
function permitido_(email) {
  if (EMAILS_PERMITIDOS.map(normEmail_).indexOf(email) === -1) throw new Error('E-mail não autorizado a acessar este sistema.');
}
function getUser_(email) { const v = props_().getProperty('user:' + email); return v ? JSON.parse(v) : null; }
function setUser_(email, senha) {
  if (String(senha || '').length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  const salt = Utilities.getUuid();
  props_().setProperty('user:' + email, JSON.stringify({ salt: salt, hash: hash_(senha, salt), atualizadoEm: new Date().toISOString() }));
}
function hash_(senha, salt) {
  let h = salt;
  for (let i = 0; i < 400; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + '|' + senha + '|' + salt, Utilities.Charset.UTF_8));
  }
  return h;
}
function novaSessao_(email, lembrar) {
  const p = props_();
  // limpa sessões vencidas
  const agora = Date.now();
  const all = p.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess:') === 0) { try { if (JSON.parse(all[k]).exp < agora) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); } }
  });
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const exp = agora + (lembrar ? SESSAO_DIAS_LEMBRAR * 864e5 : SESSAO_HORAS * 36e5);
  p.setProperty('sess:' + token, JSON.stringify({ email: email, exp: exp }));
  return { token: token, email: email, exp: exp };
}
function auth_(token) {
  const v = token ? props_().getProperty('sess:' + token) : null;
  if (!v) throw new Error('SESSAO_EXPIRADA');
  const s = JSON.parse(v);
  if (s.exp < Date.now()) { props_().deleteProperty('sess:' + token); throw new Error('SESSAO_EXPIRADA'); }
  return s;
}
function register_(email, senha, lembrar) {
  email = normEmail_(email);
  permitido_(email);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    if (getUser_(email)) throw new Error('Este e-mail já tem acesso cadastrado. Use "Entrar" ou "Esqueci minha senha".');
    setUser_(email, senha);
  } finally { lock.releaseLock(); }
  return novaSessao_(email, lembrar);
}
function login_(email, senha, lembrar) {
  email = normEmail_(email);
  permitido_(email);
  const cache = CacheService.getScriptCache();
  const kf = 'fail:' + email;
  const falhas = Number(cache.get(kf) || 0);
  if (falhas >= MAX_TENTATIVAS) throw new Error('Muitas tentativas erradas. Aguarde 10 minutos e tente de novo.');
  const u = getUser_(email);
  if (!u) throw new Error('Este e-mail ainda não tem acesso. Clique em "Criar novo acesso".');
  if (hash_(String(senha || ''), u.salt) !== u.hash) {
    cache.put(kf, String(falhas + 1), 600);
    throw new Error('E-mail ou senha incorretos.' + (falhas + 1 >= MAX_TENTATIVAS - 1 ? ' Restam ' + (MAX_TENTATIVAS - falhas - 1) + ' tentativa(s).' : ''));
  }
  cache.remove(kf);
  return novaSessao_(email, lembrar);
}
function changePassword_(email, atual, nova) {
  const u = getUser_(email);
  if (!u || hash_(String(atual || ''), u.salt) !== u.hash) throw new Error('Senha atual incorreta.');
  setUser_(email, nova);
  return { ok: true };
}
function forgot_(email) {
  email = normEmail_(email);
  permitido_(email);
  const cache = CacheService.getScriptCache();
  if (cache.get('cool:' + email)) throw new Error('Aguarde 1 minuto para pedir outro código.');
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('reset:' + email, JSON.stringify({ codigo: codigo, tentativas: 0 }), 900);
  cache.put('cool:' + email, '1', 60);
  MailApp.sendEmail({
    to: email,
    subject: 'Cheel Out Shop ERP — código para redefinir a senha',
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:15px;color:#0F1B33">' +
      '<p>Seu código para redefinir a senha do ERP da <b>Cheel Out Shop</b> é:</p>' +
      '<p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#0B3A8C">' + codigo + '</p>' +
      '<p>Ele vale por 15 minutos. Se não foi você que pediu, ignore este e-mail.</p></div>',
  });
  return { enviado: true };
}
function reset_(email, codigo, senha) {
  email = normEmail_(email);
  permitido_(email);
  const cache = CacheService.getScriptCache();
  const v = cache.get('reset:' + email);
  if (!v) throw new Error('Código expirado. Peça um novo código.');
  const r = JSON.parse(v);
  if (String(codigo || '').trim() !== r.codigo) {
    r.tentativas++;
    if (r.tentativas >= 5) cache.remove('reset:' + email); else cache.put('reset:' + email, JSON.stringify(r), 900);
    throw new Error('Código incorreto.');
  }
  setUser_(email, senha);
  cache.remove('reset:' + email);
  // encerra todas as sessões antigas desse e-mail
  const p = props_(), all = p.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('sess:') === 0) { try { if (JSON.parse(all[k]).email === email) p.deleteProperty(k); } catch (e) {} }
  });
  return novaSessao_(email, false);
}

/**
 * EMERGÊNCIA: apaga as senhas cadastradas e desconecta todo mundo.
 * Rode manualmente aqui no Apps Script se precisar. Depois, use "Criar novo acesso" no site.
 */
function resetarAcessos() {
  const p = props_(), all = p.getProperties();
  Object.keys(all).forEach(function (k) { if (k.indexOf('user:') === 0 || k.indexOf('sess:') === 0) p.deleteProperty(k); });
  Logger.log('Acessos apagados. Crie um novo acesso pelo site.');
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
