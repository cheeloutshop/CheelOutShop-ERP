/* =========================================================
   Cheel Out Shop — ERP
   Front-end estático (GitHub Pages) + Google Sheets via Apps Script
   ========================================================= */
'use strict';

const COLS = {
  produtos:   ['id', 'sku', 'nome', 'categoria', 'unidade', 'custo', 'preco', 'estoqueMin', 'ean', 'ncm', 'ativo', 'criadoEm'],
  contatos:   ['id', 'tipo', 'nome', 'documento', 'telefone', 'email', 'cidade', 'uf', 'obs', 'criadoEm', 'fantasia', 'cep', 'endereco'],
  movimentos: ['id', 'data', 'produtoId', 'tipo', 'quantidade', 'custoUnit', 'origem', 'origemId', 'obs', 'criadoEm'],
  compras:    ['id', 'numero', 'data', 'fornecedorId', 'status', 'itens', 'frete', 'desconto', 'total', 'formaPgto', 'parcelas', 'vencimento', 'obs', 'criadoEm', 'previsao', 'recebidoEm'],
  vendas:     ['id', 'numero', 'data', 'clienteId', 'canal', 'status', 'itens', 'frete', 'desconto', 'total', 'formaPgto', 'parcelas', 'vencimento', 'obs', 'criadoEm'],
  pagar:      ['id', 'descricao', 'contatoId', 'categoria', 'vencimento', 'valor', 'status', 'pagoEm', 'valorPago', 'origem', 'origemId', 'obs', 'criadoEm'],
  receber:    ['id', 'descricao', 'contatoId', 'categoria', 'vencimento', 'valor', 'status', 'pagoEm', 'valorPago', 'origem', 'origemId', 'obs', 'criadoEm'],
};

const APP_VERSAO = '13';
const APP_DATA_VERSAO = '25/09/2026';
const LS_DATA = 'cheel_erp_data_v1';
const LS_CFG = 'cheel_erp_cfg_v1';
const LS_QUEUE = 'cheel_erp_queue_v1';
const LS_SESSION = 'cheel_erp_session_v1';
const LS_USERS = 'cheel_erp_users_v1';
const LS_MIGRAR = 'cheel_erp_migrar_v1';
const ERP = window.ERP_CONFIG || {};
const EMAIL_PADRAO = String(ERP.email || 'cheeloutshop@gmail.com').trim().toLowerCase();

const CANAIS = ['Loja física', 'Site', 'Mercado Livre', 'Shopee', 'Amazon', 'TikTok Shop', 'Instagram / WhatsApp', 'Outro'];
const FORMAS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Transferência', 'Marketplace'];
const A_VISTA = ['Pix', 'Dinheiro', 'Cartão de débito'];
const ST_VENDA = ['Orçamento', 'Em aberto', 'Atendido', 'Cancelado'];
const ST_COMPRA = ['Em aberto', 'Recebido', 'Cancelado'];
const FORMAS_COMPRA = ['Pix', 'Cartão de crédito', 'Boleto', 'Reembolso'];   // Pix = à vista; os demais podem parcelar
const UN_COMPRA = [['UN', 'Unidade'], ['CX', 'Caixa'], ['FD', 'Fardo'], ['PCT', 'Pacote'], ['DZ', 'Dúzia'], ['KIT', 'Kit'], ['PAR', 'Par'], ['OUTRA', 'Outra']];
const fatorItem = it => (!it.un || it.un === 'UN') ? 1 : Math.max(1, num(it.fator) || 1);
const CAT_PAGAR = ['Fornecedores', 'Frete', 'Aluguel', 'Salários', 'Impostos', 'Marketing', 'Tarifas / Taxas', 'Energia / Internet', 'Outros'];
const CAT_RECEBER = ['Vendas', 'Serviços', 'Outros'];

/* ---------------- Helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v ?? '').trim().replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? n : 0;
};
const r2 = v => Math.round(num(v) * 100) / 100;
const dec = v => (num(v) ? r2(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }) : '');
const brl = v => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtdFmt = v => num(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const hoje = () => new Date().toLocaleDateString('sv-SE');
const dataBR = d => (d && /^\d{4}-\d{2}-\d{2}/.test(d)) ? d.slice(0, 10).split('-').reverse().join('/') : (d || '');
const mesAtual = () => hoje().slice(0, 7);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const agora = () => new Date().toISOString();
const addMeses = (d, n) => {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  const ultimo = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(day, ultimo));
  return dt.toLocaleDateString('sv-SE');
};
const addDias = (d, n) => { const dt = new Date(d + 'T12:00:00'); dt.setDate(dt.getDate() + n); return dt.toLocaleDateString('sv-SE'); };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const match = (q, ...campos) => { if (!q) return true; const n = norm(q); return campos.some(c => norm(c).includes(n)); };

const ICON = {
  edit: '<svg viewBox="0 0 24 24"><path d="M3 17.2V21h3.8L17.8 9.9 14 6.1zM20.7 7c.4-.4.4-1 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8L19 8.8z"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20.1 16l2.4-.8A10.5 10.5 0 0 0 12.5 8z"/></svg>',
  sync: '<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6a6 6 0 0 1 5.2 9l1.5 1.4A8 8 0 0 0 12 4zm0 14a6 6 0 0 1-5.2-9L5.3 7.6A8 8 0 0 0 12 20v3l4-4-4-4z"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-1-9H6v4h12z"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7zM5 18v2h14v-2z"/></svg>',
};

/* ---------------- Toast ---------------- */
function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), tipo === 'err' ? 7000 : 3500);
}

/* ---------------- Store ---------------- */
const Store = {
  data: Object.fromEntries(Object.keys(COLS).map(k => [k, []])),
  cfg: { url: '' },
  queue: [],

  init() {
    let salvo = {};
    try { salvo = JSON.parse(localStorage.getItem(LS_CFG) || '{}') || {}; } catch (e) {}
    // URL definida em Configurações tem prioridade; senão usa a do config.js
    this.cfg.url = ('url' in salvo && salvo.origem === 'manual') ? String(salvo.url || '') : String(ERP.apiUrl || '').trim();
    try {
      const d = JSON.parse(localStorage.getItem(LS_DATA) || 'null');
      if (d) for (const k of Object.keys(COLS)) this.data[k] = (d[k] || []).map(r => this.normalize(k, r));
    } catch (e) {}
    try { this.queue = JSON.parse(localStorage.getItem(LS_QUEUE) || '[]'); } catch (e) { this.queue = []; }
    // Se este navegador trabalhava no modo local e agora há uma planilha configurada (ex.: URL colada no config.js),
    // guarda os dados locais para oferecer o envio à planilha depois do login — nada se perde.
    try {
      const modoAnterior = localStorage.getItem('cheel_erp_modo_v1');
      const modoAtual = this.online ? 'online:' + this.cfg.url : 'local';
      const temDados = Object.values(this.data).some(l => l.length);
      if (this.online && (!modoAnterior || modoAnterior === 'local') && temDados && !localStorage.getItem(LS_MIGRAR)) {
        localStorage.setItem(LS_MIGRAR, JSON.stringify(this.data));
      }
      localStorage.setItem('cheel_erp_modo_v1', modoAtual);
    } catch (e) {}
  },
  get online() { return !!this.cfg.url; },
  normalize(sheet, r) {
    const o = { ...r };
    if ('itens' in o && typeof o.itens === 'string') { try { o.itens = JSON.parse(o.itens || '[]'); } catch (e) { o.itens = []; } }
    if (COLS[sheet].includes('itens') && !Array.isArray(o.itens)) o.itens = [];
    return o;
  },
  saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify({ url: this.cfg.url, origem: 'manual' })); } catch (e) {} },
  saveCache() {
    try {
      localStorage.setItem(LS_DATA, JSON.stringify(this.data));
      localStorage.setItem(LS_QUEUE, JSON.stringify(this.queue));
    } catch (e) {}
  },
  async api(payload) {
    let res;
    try { res = await fetch(this.cfg.url, { method: 'POST', body: JSON.stringify({ ...payload, token: Auth.token }) }); }
    catch (e) { throw new Error('Sem conexão com a planilha. Verifique a internet e a URL do Apps Script.'); }
    const txt = await res.text();
    let j;
    try { j = JSON.parse(txt); } catch (e) {
      if (/autoriza|authoriz|permiss/i.test(txt)) throw new Error('O script da planilha precisa ser autorizado de novo: abra Extensões › Apps Script, rode a função "setup" e aprove as permissões.');
      if (/not found|não encontrad|doPost|Script function/i.test(txt)) throw new Error('O App da Web da planilha não foi encontrado. Confira a implantação (Implantar › Gerenciar implantações).');
      if (!res.ok) throw new Error('A planilha respondeu com erro ' + res.status + '. Tente de novo em instantes.');
      throw new Error('Resposta inválida da planilha. Confira se a URL termina em /exec e se o acesso está como "Qualquer pessoa".');
    }
    if (!j.ok) {
      if (j.error === 'SESSAO_EXPIRADA') { Auth.expirou(); throw new Error('Sua sessão expirou. Entre novamente.'); }
      throw new Error(j.error || 'Erro desconhecido');
    }
    return j.data;
  },
  apply(ops) {
    for (const op of ops) {
      const list = this.data[op.sheet];
      if (op.op === 'upsert') {
        const i = list.findIndex(r => r.id === op.record.id);
        if (i >= 0) list[i] = op.record; else list.push(op.record);
      } else if (op.op === 'delete') {
        this.data[op.sheet] = list.filter(r => r.id !== op.id);
      }
    }
  },
  _flushing: null,
  flush() {
    // nunca envia dois lotes ao mesmo tempo (antes isso gerava "erro de sincronização" por disputa de bloqueio na planilha)
    if (this._flushing) return this._flushing;
    this._flushing = this._flush().finally(() => { this._flushing = null; });
    return this._flushing;
  },
  async _flush() {
    if (!this.online || !this.queue.length) return true;
    setSync('sync');
    try {
      while (this.queue.length) {
        const lote = this.queue.slice(0, 100);
        await this.api({ action: 'batch', ops: lote });
        this.queue.splice(0, lote.length);
        this.saveCache();
      }
      setSync('ok');
      return true;
    } catch (e) {
      setSync('erro', e.message);
      const agoraMs = Date.now();
      if (Auth.sess && agoraMs - (this._ultimoAviso || 0) > 60000) {   // no máximo 1 aviso por minuto
        this._ultimoAviso = agoraMs;
        toast('Não consegui salvar na planilha agora. As alterações ficam guardadas e serão reenviadas sozinhas. Clique em “Erro de sincronização” para ver o motivo.', 'err');
      }
      return false;
    }
  },
  async commit(ops) {
    if (!ops.length) return;
    this.apply(ops);
    if (this.online) this.queue.push(...ops);
    this.saveCache();
    render();
    try { backupLocalDiario(); } catch (e) {}
    await this.flush();
  },
  _loading: null,
  load() {
    if (this._loading) return this._loading;
    this._loading = this._load().finally(() => { this._loading = null; });
    return this._loading;
  },
  async _load() {
    if (!this.online) { setSync('local'); return; }
    const ok = await this.flush();
    if (!ok) return;
    setSync('sync');
    try {
      const d = await this.api({ action: 'getAll' });
      if (this.queue.length) return;   // alterações feitas durante a leitura: não sobrescreve
      for (const k of Object.keys(COLS)) this.data[k] = (d[k] || []).map(r => this.normalize(k, r));
      this.ultimaLeitura = Date.now();
      this.saveCache();
      setSync('ok');
    } catch (e) {
      setSync('erro', e.message);
      if (Auth.sess) toast('Erro ao carregar da planilha: ' + e.message, 'err');
    }
  },
};
const up = (sheet, record) => ({ op: 'upsert', sheet, record });
const del = (sheet, id) => ({ op: 'delete', sheet, id });

const SyncInfo = { estado: 'local', erro: '', ok: 0 };
function setSync(state, detalhe) {
  SyncInfo.estado = state;
  if (state === 'erro') SyncInfo.erro = detalhe || ''; else if (state === 'ok') { SyncInfo.erro = ''; SyncInfo.ok = Date.now(); }
  const el = $('#sync');
  el.className = 'sync ' + (state === 'local' ? '' : state);
  const txt = { local: 'Modo local (sem planilha)', ok: 'Sincronizado com a planilha', sync: 'Sincronizando…', erro: 'Erro de sincronização' }[state];
  $('.txt', el).textContent = txt + (state === 'erro' && Store.queue.length ? ` · ${Store.queue.length} pendente(s)` : '');
  el.title = state === 'erro' ? 'Clique para ver o motivo' : '';
  el.style.cursor = Store.online ? 'pointer' : '';
}
function detalhesSync() {
  if (!Store.online) return;
  const pend = Store.queue.length;
  Modal.open({
    title: 'Sincronização com a planilha', small: true, submit: 'Sincronizar agora',
    body: `<div class="grid">
      <div class="note ${SyncInfo.estado === 'erro' ? 'warn' : ''}"><b>Situação:</b> ${{ ok: 'sincronizado ✓', sync: 'sincronizando…', erro: 'com erro', local: 'modo local' }[SyncInfo.estado] || SyncInfo.estado}
      ${SyncInfo.ok ? `<br><b>Última sincronização:</b> ${new Date(SyncInfo.ok).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}` : ''}
      <br><b>Alterações aguardando envio:</b> ${pend}</div>
      ${SyncInfo.erro ? `<div><b>Motivo do erro:</b><div class="note warn" style="margin-top:6px">${esc(SyncInfo.erro)}</div></div>` : ''}
      <p class="muted" style="margin:0;font-weight:700;font-size:13px">Nada se perde: o que não foi enviado fica guardado neste aparelho e o sistema tenta de novo sozinho a cada 30 segundos.</p>
    </div>`,
    onSubmit: async () => { await Store.flush(); await Store.load(); render(); toast(SyncInfo.estado === 'ok' ? 'Sincronizado' : 'Ainda com erro — veja o motivo', SyncInfo.estado === 'ok' ? 'ok' : 'err'); },
  });
}

/* ---------------- Lookups & cálculos ---------------- */
const produto = id => Store.data.produtos.find(p => p.id === id);
const contato = id => Store.data.contatos.find(c => c.id === id);
const nomeContato = id => contato(id)?.nome || '';
const nomeProduto = id => { const p = produto(id); return p ? p.nome : '(produto excluído)'; };

function saldos() {
  const m = {};
  for (const mv of Store.data.movimentos) {
    const q = num(mv.quantidade);
    m[mv.produtoId] = (m[mv.produtoId] || 0) + (mv.tipo === 'saida' ? -q : q);
  }
  return m;
}
function statusConta(c) {
  if (c.status === 'Pago') return 'Pago';
  if (c.vencimento && c.vencimento < hoje()) return 'Vencido';
  return 'Aberto';
}
function proxNumero(lista) { return lista.reduce((mx, r) => Math.max(mx, num(r.numero)), 0) + 1; }
function totalItens(itens) { return r2(itens.reduce((s, it) => s + num(it.qtd) * num(it.valor), 0)); }

function gerarParcelas(total, n, primeiro) {
  n = Math.max(1, Math.floor(num(n)) || 1);
  const base = Math.floor((total / n) * 100) / 100;
  const out = [];
  for (let i = 0; i < n; i++) {
    const valor = i === n - 1 ? r2(total - base * (n - 1)) : base;
    out.push({ n: i + 1, valor, vencimento: addMeses(primeiro, i) });
  }
  return out;
}

/* Efeitos de uma venda: movimentos de saída + contas a receber */
function efeitosVenda(v) {
  const ops = [];
  Store.data.movimentos.filter(m => m.origem === 'venda' && m.origemId === v.id).forEach(m => ops.push(del('movimentos', m.id)));
  const recs = Store.data.receber.filter(r => r.origem === 'venda' && r.origemId === v.id);
  const temPago = recs.some(r => r.status === 'Pago');
  if (v.status === 'Atendido') {
    for (const it of v.itens) {
      ops.push(up('movimentos', {
        id: uid(), data: v.data, produtoId: it.produtoId, tipo: 'saida', quantidade: num(it.qtd),
        custoUnit: num(produto(it.produtoId)?.custo), origem: 'venda', origemId: v.id,
        obs: 'Venda nº ' + v.numero, criadoEm: agora(),
      }));
    }
    if (!temPago) {
      recs.forEach(r => ops.push(del('receber', r.id)));
      const parc = gerarParcelas(num(v.total), v.parcelas, v.vencimento || v.data);
      const aVista = A_VISTA.includes(v.formaPgto) && parc.length === 1;
      for (const p of parc) {
        ops.push(up('receber', {
          id: uid(), descricao: `Venda nº ${v.numero}` + (parc.length > 1 ? ` · parcela ${p.n}/${parc.length}` : ''),
          contatoId: v.clienteId, categoria: 'Vendas', vencimento: p.vencimento, valor: p.valor,
          status: aVista ? 'Pago' : 'Aberto', pagoEm: aVista ? v.data : '', valorPago: aVista ? p.valor : '',
          origem: 'venda', origemId: v.id, obs: v.formaPgto || '', criadoEm: agora(),
        }));
      }
    }
  } else {
    recs.filter(r => r.status !== 'Pago').forEach(r => ops.push(del('receber', r.id)));
  }
  return ops;
}

/* Efeitos de uma compra: movimentos de entrada + contas a pagar + atualiza custo */
/* Efeitos de um pedido de compra:
   - contas a pagar: lançadas já na criação do pedido (pré-venda: boleto vence antes da mercadoria chegar)
   - estoque: entra só quando o pedido é RECEBIDO, sempre em unidades (qtd × unidades por embalagem)
   - cancelado: estorna o estoque e apaga as parcelas ainda não pagas */
function efeitosCompra(c) {
  const ops = [];
  Store.data.movimentos.filter(m => m.origem === 'compra' && m.origemId === c.id).forEach(m => ops.push(del('movimentos', m.id)));
  if (c.status === 'Recebido') {
    for (const it of c.itens) {
      const f = fatorItem(it), qtdUn = num(it.qtd) * f, custoUn = f ? num(it.valor) / f : num(it.valor);
      ops.push(up('movimentos', {
        id: uid(), data: c.recebidoEm || hoje(), produtoId: it.produtoId, tipo: 'entrada', quantidade: qtdUn,
        custoUnit: Math.round(custoUn * 1e4) / 1e4, origem: 'compra', origemId: c.id,
        obs: 'Pedido de compra nº ' + c.numero + (f > 1 ? ` (${qtdFmt(it.qtd)} ${it.un} × ${f} un)` : ''), criadoEm: agora(),
      }));
      const p = produto(it.produtoId);
      const c4 = Math.round(custoUn * 1e4) / 1e4;
      if (p && c4 > 0 && num(p.custo) !== c4) ops.push(up('produtos', { ...p, custo: c4 }));
    }
  }
  const pags = Store.data.pagar.filter(r => r.origem === 'compra' && r.origemId === c.id);
  const temPago = pags.some(r => r.status === 'Pago');
  if (c.status === 'Cancelado') {
    pags.filter(r => r.status !== 'Pago').forEach(r => ops.push(del('pagar', r.id)));
  } else if (!temPago) {
    pags.forEach(r => ops.push(del('pagar', r.id)));
    const nParc = c.formaPgto === 'Pix' ? 1 : c.parcelas;
    const parc = gerarParcelas(num(c.total), nParc, c.vencimento || c.data);
    const forn = nomeContato(c.fornecedorId);
    for (const p of parc) {
      ops.push(up('pagar', {
        id: uid(), descricao: `Pedido de compra nº ${c.numero}` + (parc.length > 1 ? ` · parcela ${p.n}/${parc.length}` : '') + (forn ? ` · ${forn}` : ''),
        contatoId: c.fornecedorId, categoria: 'Fornecedores', vencimento: p.vencimento, valor: p.valor,
        status: 'Aberto', pagoEm: '', valorPago: '', origem: 'compra', origemId: c.id, obs: c.formaPgto || '', criadoEm: agora(),
      }));
    }
  }
  return ops;
}

/* ---------------- Modal ---------------- */
const Modal = {
  onSubmit: null,
  open({ title, body, submit = 'Salvar', small = false, onSubmit, onOpen }) {
    const dlg = $('#modal');
    dlg.classList.toggle('small', small);
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = body;
    $('#modalSubmit').textContent = submit;
    $('#modalSubmit').style.display = onSubmit ? '' : 'none';
    this.onSubmit = onSubmit;
    dlg.showModal();
    onOpen && onOpen($('#modalBody'));
    const first = $('#modalBody input:not([type=hidden]), #modalBody select');
    first && setTimeout(() => first.focus(), 30);
  },
  close() { $('#modal').close(); },
};
$('#modalForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (!Modal.onSubmit) return Modal.close();
  const form = $('#modalForm');
  const req = $$('[required]', form).find(i => !String(i.value).trim());
  if (req) { req.focus(); toast('Preencha: ' + (req.closest('label')?.firstChild?.textContent || 'campo obrigatório').trim(), 'err'); return; }
  const fd = Object.fromEntries(new FormData(form).entries());
  try {
    const r = await Modal.onSubmit(fd, $('#modalBody'));
    if (r !== false) Modal.close();
  } catch (err) { console.error(err); toast(err.message, 'err'); }
});
$$('[data-close]').forEach(b => b.addEventListener('click', () => Modal.close()));

function confirmar(msg, onOk, txt = 'Confirmar') {
  Modal.open({ title: 'Confirmar', small: true, submit: txt, body: `<p style="margin:0;font-weight:700">${msg}</p>`, onSubmit: onOk });
}

const opt = (lista, sel, vazio) => (vazio !== undefined ? `<option value="">${esc(vazio)}</option>` : '') +
  lista.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
const field = (label, html, cls = '') => `<label class="f ${cls}">${label}${html}</label>`;
const inp = (name, val = '', attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;

/* ---------------- Router & layout ---------------- */
const ROUTES = {
  painel:   { t: 'Painel', s: 'Visão geral da Cheel Out Shop', fn: viewPainel },
  vendas:   { t: 'Vendas', s: 'Pedidos de venda, orçamentos e faturamento', fn: viewVendas },
  compras:  { t: 'Pedidos de compra', s: 'Compras de fornecedores e recebimento de mercadoria', fn: viewCompras },
  clientes:     { t: 'Clientes', s: 'Cadastro de clientes', fn: el => viewContatos(el, 'Cliente') },
  fornecedores: { t: 'Fornecedores', s: 'Cadastro de fornecedores', fn: el => viewContatos(el, 'Fornecedor') },
  produtos: { t: 'Produtos', s: 'Cadastro de produtos, preços e custos', fn: viewProdutos },
  estoque:  { t: 'Controle de estoque', s: 'Saldos, movimentações e balanço', fn: viewEstoque },
  receber:  { t: 'Contas a receber', s: 'Recebimentos de clientes', fn: () => viewContas('receber') },
  pagar:    { t: 'Contas a pagar', s: 'Pagamentos a fornecedores e despesas', fn: () => viewContas('pagar') },
  config:   { t: 'Configurações', s: 'Backup automático', fn: viewConfig },
  avancado: { t: 'Configurações avançadas', s: 'Conexão, acesso, importação e dados de exemplo', fn: viewConfigAvancado },
};
const UI = {}; // estado de filtros por tela
function rota() { let r = location.hash.replace('#/', '').split('?')[0]; if (r === 'contatos') r = 'clientes'; return ROUTES[r] ? r : 'painel'; }
function render() {
  const r = rota();
  const R = ROUTES[r];
  $('#pageTitle').textContent = R.t;
  $('#pageSub').textContent = R.s;
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.route === r));
  $('#topActions').innerHTML = '';
  const scroll = window.scrollY;
  const foco = document.activeElement?.id;
  const pos = document.activeElement?.selectionStart;
  R.fn($('#view'));
  if (foco && $('#' + foco)) { const el = $('#' + foco); el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} }
  window.scrollTo(0, scroll);
  document.title = R.t + ' · Cheel Out Shop ERP';
}
window.addEventListener('hashchange', () => { document.body.classList.remove('menu-open'); window.scrollTo(0, 0); render(); });
$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
$('#backdrop').addEventListener('click', () => document.body.classList.remove('menu-open'));
function actions(html) { $('#topActions').innerHTML = html; }
function searchBox(id, val, ph) { return `<div class="search">${ICON.search}<input id="${id}" type="search" placeholder="${ph}" value="${esc(val || '')}"></div>`; }
function bindSearch(id, key) { const el = $('#' + id); el && el.addEventListener('input', () => { UI[key] = el.value; render(); }); }
function emptyRow(cols, msg, icone = '📦') { return `<tr><td colspan="${cols}"><div class="empty"><div class="big">${icone}</div>${msg}</div></td></tr>`; }

/* =========================================================
   PAINEL
   ========================================================= */
function viewPainel(el) {
  actions(`<a class="btn ghost" href="#/compras">${ICON.plus}Compra</a><button class="btn accent" id="novaVendaTop">${ICON.plus}Nova venda</button>`);
  const d = Store.data;
  const mes = mesAtual();
  const vendasOk = d.vendas.filter(v => v.status === 'Atendido');
  const vMes = vendasOk.filter(v => (v.data || '').startsWith(mes));
  const totMes = vMes.reduce((s, v) => s + num(v.total), 0);
  const recAb = d.receber.filter(c => c.status !== 'Pago');
  const pagAb = d.pagar.filter(c => c.status !== 'Pago');
  const recVenc = recAb.filter(c => statusConta(c) === 'Vencido');
  const pagVenc = pagAb.filter(c => statusConta(c) === 'Vencido');
  const sal = saldos();
  const ativos = d.produtos.filter(p => p.ativo !== 'nao');
  const valorEst = ativos.reduce((s, p) => s + Math.max(0, sal[p.id] || 0) * num(p.custo), 0);
  const baixo = ativos.filter(p => num(p.estoqueMin) > 0 && (sal[p.id] || 0) <= num(p.estoqueMin));
  const sum = l => l.reduce((s, c) => s + num(c.valor), 0);

  // últimos 6 meses
  const meses = [];
  const base = new Date(); base.setDate(1);
  for (let i = 5; i >= 0; i--) { const dt = new Date(base.getFullYear(), base.getMonth() - i, 1); meses.push(dt.toLocaleDateString('sv-SE').slice(0, 7)); }
  const serieV = meses.map(m => vendasOk.filter(v => (v.data || '').startsWith(m)).reduce((s, v) => s + num(v.total), 0));
  const serieC = meses.map(m => d.compras.filter(c => c.status === 'Recebido' && (c.data || '').startsWith(m)).reduce((s, c) => s + num(c.total), 0));

  const limite = addDias(hoje(), 30);
  const fv = UI.fVenc || 'todos';
  const diasAte = d => Math.round((new Date(d + 'T12:00:00') - new Date(hoje() + 'T12:00:00')) / 864e5);
  const todasProx = [
    ...recAb.map(c => ({ ...c, _t: 'receber' })),
    ...pagAb.map(c => ({ ...c, _t: 'pagar' })),
  ].filter(c => c.vencimento && c.vencimento <= limite).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const proximas = todasProx.filter(c => fv === 'todos' || c._t === fv);
  const faixa = d => d <= 7 ? 'v-red' : d <= 20 ? 'v-orange' : 'v-green';
  const quando = d => d < 0 ? `vencido há ${-d} dia${d === -1 ? '' : 's'}` : d === 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `vence em ${d} dias`;
  const somaP = proximas.filter(c => c._t === 'pagar').reduce((s, c) => s + num(c.valor), 0);
  const somaR = proximas.filter(c => c._t === 'receber').reduce((s, c) => s + num(c.valor), 0);

  el.innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="lbl">Vendas no mês</div><div class="val">${brl(totMes)}</div><div class="hint">${vMes.length} venda(s) · ticket médio ${brl(vMes.length ? totMes / vMes.length : 0)}</div></div>
      <div class="card kpi green"><div class="lbl">A receber (em aberto)</div><div class="val">${brl(sum(recAb))}</div><div class="hint">${recVenc.length ? `<span class="neg">${recVenc.length} vencida(s) · ${brl(sum(recVenc))}</span>` : 'Nenhuma vencida'}</div></div>
      <div class="card kpi red"><div class="lbl">A pagar (em aberto)</div><div class="val">${brl(sum(pagAb))}</div><div class="hint">${pagVenc.length ? `<span class="neg">${pagVenc.length} vencida(s) · ${brl(sum(pagVenc))}</span>` : 'Nenhuma vencida'}</div></div>
      <div class="card kpi blue"><div class="lbl">Valor em estoque (custo)</div><div class="val">${brl(valorEst)}</div><div class="hint">${ativos.length} produto(s) · ${baixo.length ? `<span class="neg">${baixo.length} abaixo do mínimo</span>` : 'estoque ok'}</div></div>
    </div>
    <div class="two">
      <div class="card">
        <h3>Vendas × compras — últimos 6 meses</h3>
        ${chart(meses, serieV, serieC)}
        <div class="legend"><span><i style="background:var(--blue-600)"></i>Vendas</span><span><i style="background:var(--yellow-2)"></i>Compras recebidas</span></div>
      </div>
      <div class="card">
        <h3>Vencimentos — próximos 30 dias</h3>
        <div class="venc-top">
          <div class="chips">${[['todos', 'Todos'], ['pagar', 'A pagar'], ['receber', 'A receber']].map(([k, t]) => `<button class="chip ${fv === k ? 'on' : ''}" data-fv="${k}">${t}</button>`).join('')}</div>
          <div class="venc-leg"><span><i class="v-red"></i>até 7 dias</span><span><i class="v-orange"></i>8 a 20</span><span><i class="v-green"></i>21 a 30</span></div>
        </div>
        ${proximas.length ? `<div class="venc-list">${proximas.map(c => { const d = diasAte(c.vencimento); return `
          <div class="venc ${faixa(d)}">
            <div class="venc-l"><b>${esc(c.descricao)}</b><small>${c._t === 'receber' ? 'A receber' : 'A pagar'} · ${dataBR(c.vencimento)}${c.contatoId && !String(c.descricao).includes(nomeContato(c.contatoId)) ? ' · ' + esc(nomeContato(c.contatoId)) : ''}</small></div>
            <div class="venc-r"><span class="num strong ${c._t === 'receber' ? 'pos' : 'neg'}">${c._t === 'receber' ? '+' : '−'} ${brl(c.valor)}</span><small class="${d < 0 ? 'neg' : ''}">${quando(d)}</small></div>
          </div>`; }).join('')}</div>
          <div class="venc-tot">${fv !== 'receber' ? `<span>A pagar: <b class="neg">${brl(somaP)}</b></span>` : ''}${fv !== 'pagar' ? `<span>A receber: <b class="pos">${brl(somaR)}</b></span>` : ''}</div>`
          : '<div class="empty">Nada vencendo nos próximos 30 dias 🎉</div>'}
      </div>
    </div>
    <div class="two even">
      <div class="card">
        <h3>Estoque baixo</h3>
        ${baixo.length ? `<ul class="list">${baixo.slice(0, 8).map(p => `<li><span class="l">${esc(p.nome)}<span class="s">${esc(p.sku || '')} · mínimo ${qtdFmt(p.estoqueMin)}</span></span><span class="badge ${(sal[p.id] || 0) <= 0 ? 'red' : 'amber'}">${qtdFmt(sal[p.id] || 0)} ${esc(p.unidade || 'un')}</span></li>`).join('')}</ul>`
          : '<div class="empty">Todos os produtos acima do estoque mínimo</div>'}
      </div>
      <div class="card">
        <h3>Últimas vendas</h3>
        ${d.vendas.length ? `<ul class="list">${[...d.vendas].sort((a, b) => (b.data + b.numero).localeCompare(a.data + a.numero)).slice(0, 8).map(v => `
          <li><span class="l">Nº ${esc(v.numero)} · ${esc(nomeContato(v.clienteId) || 'Consumidor final')}<span class="s">${dataBR(v.data)} · ${esc(v.canal || '')}</span></span><span>${badgeVenda(v.status)} <span class="num strong">${brl(v.total)}</span></span></li>`).join('')}</ul>`
          : '<div class="empty">Nenhuma venda lançada ainda</div>'}
      </div>
    </div>`;
  $('#novaVendaTop').onclick = () => formVenda();
  $$('[data-fv]', el).forEach(b => b.onclick = () => { UI.fVenc = b.dataset.fv; render(); });
}

function chart(labels, a, b) {
  const W = 600, H = 240, pl = 64, pb = 28, pt = 10;
  const max = Math.max(1, ...a, ...b);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const gw = (W - pl) / labels.length;
  const bw = Math.min(26, gw / 3);
  const y = v => pt + (H - pb - pt) * (1 - v / top);
  let g = '';
  for (let v = 0; v <= top + 1e-9; v += step) {
    g += `<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#E3E8F2"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${abrev(v)}</text>`;
  }
  labels.forEach((m, i) => {
    const cx = pl + gw * i + gw / 2;
    const bar = (v, x, cor) => `<rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(0, H - pb - y(v))}" rx="4" fill="${cor}"><title>${brl(v)}</title></rect>`;
    g += bar(a[i], cx - bw - 2, 'var(--blue-600)') + bar(b[i], cx + 2, 'var(--yellow-2)');
    const [yy, mm] = m.split('-');
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${MESES[+mm - 1]}/${yy.slice(2)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
}
function niceStep(max) { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw))); const n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
function abrev(v) { return v >= 1e6 ? (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'M' : v >= 1e3 ? (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : v.toLocaleString('pt-BR'); }

/* =========================================================
   PRODUTOS
   ========================================================= */
function viewProdutos(el) {
  actions(`<button class="btn accent" id="novoProd">${ICON.plus}Novo produto</button>`);
  const q = UI.qProd || '';
  const f = UI.fProd || 'ativos';
  const sal = saldos();
  const cats = [...new Set(Store.data.produtos.map(p => p.categoria).filter(Boolean))].sort();
  const lista = Store.data.produtos
    .filter(p => f === 'todos' || (f === 'ativos' ? p.ativo !== 'nao' : p.ativo === 'nao'))
    .filter(p => !UI.catProd || p.categoria === UI.catProd)
    .filter(p => match(q, p.nome, p.sku, p.ean, p.categoria))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  el.innerHTML = `
    <div class="toolbar">
      ${searchBox('qProd', q, 'Buscar por nome, SKU, EAN…')}
      <select id="catProd">${opt(cats, UI.catProd, 'Todas as categorias')}</select>
      <div class="chips">${[['ativos', 'Ativos'], ['inativos', 'Inativos'], ['todos', 'Todos']].map(([k, t]) => `<button class="chip ${f === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>SKU</th><th>Produto</th><th>Categoria</th><th class="r">Custo</th><th class="r">Preço</th><th class="r">Margem</th><th class="r">Estoque</th><th></th></tr></thead>
      <tbody>${lista.length ? lista.map(p => {
        const s = sal[p.id] || 0, mg = num(p.preco) ? (num(p.preco) - num(p.custo)) / num(p.preco) * 100 : 0;
        return `<tr>
          <td class="muted">${esc(p.sku)}</td>
          <td class="wrap strong">${esc(p.nome)} ${p.ativo === 'nao' ? '<span class="badge gray">inativo</span>' : ''}</td>
          <td>${esc(p.categoria)}</td>
          <td class="r">${brl(p.custo)}</td><td class="r strong">${brl(p.preco)}</td>
          <td class="r ${mg < 0 ? 'neg' : ''}">${mg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td>
          <td class="r"><span class="badge ${s <= 0 ? 'red' : (num(p.estoqueMin) && s <= num(p.estoqueMin) ? 'amber' : 'green')}">${qtdFmt(s)} ${esc(p.unidade || 'un')}</span></td>
          <td class="act"><span class="inner"><button class="icon-btn" data-edit="${p.id}" title="Editar">${ICON.edit}</button><button class="icon-btn del" data-del="${p.id}" title="Excluir">${ICON.del}</button></span></td>
        </tr>`;
      }).join('') : emptyRow(8, Store.data.produtos.length ? 'Nenhum produto encontrado' : 'Cadastre seu primeiro produto no botão “Novo produto”')}</tbody>
    </table></div>`;
  bindSearch('qProd', 'qProd');
  $('#catProd').onchange = e => { UI.catProd = e.target.value; render(); };
  $$('[data-f]', el).forEach(b => b.onclick = () => { UI.fProd = b.dataset.f; render(); });
  $('#novoProd').onclick = () => formProduto();
  $$('[data-edit]', el).forEach(b => b.onclick = () => formProduto(produto(b.dataset.edit)));
  $$('[data-del]', el).forEach(b => b.onclick = () => {
    const p = produto(b.dataset.del);
    const usado = Store.data.movimentos.some(m => m.produtoId === p.id) || [...Store.data.vendas, ...Store.data.compras].some(x => x.itens.some(i => i.produtoId === p.id));
    if (usado) return toast('Este produto já tem movimentações/pedidos. Edite e marque como inativo em vez de excluir.', 'err');
    confirmar(`Excluir o produto <b>${esc(p.nome)}</b>?`, () => Store.commit([del('produtos', p.id)]).then(() => toast('Produto excluído', 'ok')), 'Excluir');
  });
}

function formProduto(p) {
  const novo = !p;
  p = p || { unidade: 'un', ativo: 'sim' };
  const cats = [...new Set(Store.data.produtos.map(x => x.categoria).filter(Boolean))].sort();
  Modal.open({
    title: novo ? 'Novo produto' : 'Editar produto',
    body: `
      <div class="grid g4">
        ${field('Nome do produto *', inp('nome', p.nome, 'required'), 'span3')}
        ${field('SKU / código', inp('sku', p.sku || (novo ? 'CH' + String(Store.data.produtos.length + 1).padStart(4, '0') : '')))}
        ${field('Categoria', inp('categoria', p.categoria, 'list="dlCats"') + `<datalist id="dlCats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}
        ${field('Unidade', `<select name="unidade">${opt(['un', 'cx', 'kg', 'g', 'L', 'm', 'par', 'kit', 'pct'], p.unidade)}</select>`)}
        ${field('Custo (R$)', inp('custo', dec(p.custo), 'inputmode="decimal" placeholder="0,00" id="pCusto"'))}
        ${field('Markup (%)', '<input id="pMarkup" inputmode="decimal" placeholder="ex.: 50" autocomplete="off">')}
        ${field('Preço de venda (R$) *', inp('preco', dec(p.preco), 'inputmode="decimal" placeholder="0,00" required id="pPreco"'))}
        ${field('Estoque mínimo', inp('estoqueMin', p.estoqueMin, 'inputmode="decimal" placeholder="0"'))}
        ${field('EAN / código de barras', inp('ean', p.ean))}
        ${field('NCM', inp('ncm', p.ncm))}
        ${field('Situação', `<select name="ativo">${opt([['sim', 'Ativo'], ['nao', 'Inativo']], p.ativo)}</select>`)}
      </div>
      <div class="note" id="pMargem"></div>
      ${novo ? `<div class="section-t">Estoque inicial (opcional)</div><div class="grid g4">${field('Quantidade inicial', inp('estoqueIni', '', 'inputmode="decimal" placeholder="0"'))}</div>` : ''}`,
    onOpen: body => {
      const upd = () => { const c = num($('#pCusto').value), v = num($('#pPreco').value); $('#pMargem', body).textContent = v ? `Margem: ${((v - c) / v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% · Lucro por unidade: ${brl(v - c)} · Markup: ${c ? (v / c).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '–'}x` : 'Informe custo e preço para ver a margem.'; };
      ligarMarkup($('#pCusto'), $('#pMarkup'), $('#pPreco'));
      ['#pCusto', '#pPreco', '#pMarkup'].forEach(s => $(s).addEventListener('input', upd)); upd();
    },
    onSubmit: fd => {
      const sku = fd.sku.trim();
      if (sku && Store.data.produtos.some(x => x.sku === sku && x.id !== p.id)) { toast('Já existe um produto com esse SKU', 'err'); return false; }
      const rec = { ...p, id: p.id || uid(), nome: fd.nome.trim(), sku, categoria: fd.categoria.trim(), unidade: fd.unidade, custo: r2(fd.custo), preco: r2(fd.preco), estoqueMin: num(fd.estoqueMin), ean: fd.ean.trim(), ncm: fd.ncm.trim(), ativo: fd.ativo, criadoEm: p.criadoEm || agora() };
      const ops = [up('produtos', rec)];
      if (novo && num(fd.estoqueIni) > 0) ops.push(up('movimentos', { id: uid(), data: hoje(), produtoId: rec.id, tipo: 'entrada', quantidade: num(fd.estoqueIni), custoUnit: rec.custo, origem: 'manual', origemId: '', obs: 'Estoque inicial', criadoEm: agora() }));
      Store.commit(ops);
      toast(novo ? 'Produto cadastrado' : 'Produto atualizado', 'ok');
    },
  });
}

/* =========================================================
   ESTOQUE
   ========================================================= */
function viewEstoque(el) {
  actions(`<button class="btn ghost" id="balanco">Balanço / inventário</button><button class="btn accent" id="novoMov">${ICON.plus}Lançar movimentação</button>`);
  const tab = UI.tabEst || 'saldos';
  const sal = saldos();
  const q = UI.qEst || '';
  let html = `<div class="tabs"><button class="tab ${tab === 'saldos' ? 'on' : ''}" data-tab="saldos">Saldos</button><button class="tab ${tab === 'movs' ? 'on' : ''}" data-tab="movs">Movimentações</button></div>`;
  if (tab === 'saldos') {
    const f = UI.fEst || 'todos';
    const lista = Store.data.produtos.filter(p => p.ativo !== 'nao').filter(p => match(q, p.nome, p.sku, p.categoria))
      .filter(p => { const s = sal[p.id] || 0; return f === 'todos' || (f === 'baixo' ? num(p.estoqueMin) > 0 && s <= num(p.estoqueMin) : f === 'zerado' ? s <= 0 : true); })
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const totQ = lista.reduce((s, p) => s + (sal[p.id] || 0), 0);
    const totV = lista.reduce((s, p) => s + Math.max(0, sal[p.id] || 0) * num(p.custo), 0);
    const totVV = lista.reduce((s, p) => s + Math.max(0, sal[p.id] || 0) * num(p.preco), 0);
    html += `
      <div class="toolbar">${searchBox('qEst', q, 'Buscar produto…')}
        <div class="chips">${[['todos', 'Todos'], ['baixo', 'Abaixo do mínimo'], ['zerado', 'Sem estoque']].map(([k, t]) => `<button class="chip ${f === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>SKU</th><th>Produto</th><th class="r">Saldo</th><th class="r">Mínimo</th><th class="r">Custo unit.</th><th class="r">Valor (custo)</th><th class="r">Valor (venda)</th><th>Situação</th><th></th></tr></thead>
        <tbody>${lista.length ? lista.map(p => {
          const s = sal[p.id] || 0, mn = num(p.estoqueMin);
          const st = s <= 0 ? '<span class="badge red">Sem estoque</span>' : mn && s <= mn ? '<span class="badge amber">Repor</span>' : '<span class="badge green">OK</span>';
          return `<tr><td class="muted">${esc(p.sku)}</td><td class="wrap strong">${esc(p.nome)}</td><td class="r strong">${qtdFmt(s)} ${esc(p.unidade || 'un')}</td><td class="r muted">${qtdFmt(mn)}</td><td class="r">${brl(p.custo)}</td><td class="r">${brl(Math.max(0, s) * num(p.custo))}</td><td class="r">${brl(Math.max(0, s) * num(p.preco))}</td><td>${st}</td>
            <td class="act"><button class="btn ghost sm" data-mov="${p.id}">Movimentar</button></td></tr>`;
        }).join('') : emptyRow(9, 'Nenhum produto')}</tbody>
        ${lista.length ? `<tfoot><tr><td colspan="2">Total (${lista.length} produtos)</td><td class="r">${qtdFmt(totQ)}</td><td></td><td></td><td class="r">${brl(totV)}</td><td class="r">${brl(totVV)}</td><td colspan="2"></td></tr></tfoot>` : ''}
      </table></div>`;
  } else {
    const fp = UI.fpMov || '';
    const lista = Store.data.movimentos.filter(m => !fp || m.produtoId === fp)
      .filter(m => match(q, nomeProduto(m.produtoId), m.obs, produto(m.produtoId)?.sku))
      .sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm));
    html += `
      <div class="toolbar">${searchBox('qEst', q, 'Buscar por produto ou observação…')}
        <select id="fpMov">${opt(Store.data.produtos.map(p => [p.id, p.nome]).sort((a, b) => a[1].localeCompare(b[1])), fp, 'Todos os produtos')}</select></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="r">Quantidade</th><th class="r">Custo unit.</th><th>Origem</th><th>Observação</th><th></th></tr></thead>
        <tbody>${lista.length ? lista.slice(0, 500).map(m => `<tr>
          <td>${dataBR(m.data)}</td><td class="wrap strong">${esc(nomeProduto(m.produtoId))}</td>
          <td>${m.tipo === 'saida' ? '<span class="badge red">Saída</span>' : '<span class="badge green">Entrada</span>'}</td>
          <td class="r strong ${m.tipo === 'saida' ? 'neg' : 'pos'}">${m.tipo === 'saida' ? '−' : '+'}${qtdFmt(m.quantidade)}</td>
          <td class="r">${brl(m.custoUnit)}</td>
          <td>${{ venda: 'Venda', compra: 'Compra', manual: 'Manual', balanco: 'Balanço' }[m.origem] || esc(m.origem)}</td>
          <td class="wrap muted">${esc(m.obs)}</td>
          <td class="act">${['manual', 'balanco'].includes(m.origem) ? `<button class="icon-btn del" data-delmov="${m.id}" title="Excluir">${ICON.del}</button>` : ''}</td></tr>`).join('') : emptyRow(8, 'Nenhuma movimentação')}</tbody>
      </table></div>`;
  }
  el.innerHTML = html;
  bindSearch('qEst', 'qEst');
  $$('[data-tab]', el).forEach(b => b.onclick = () => { UI.tabEst = b.dataset.tab; render(); });
  $$('[data-f]', el).forEach(b => b.onclick = () => { UI.fEst = b.dataset.f; render(); });
  $('#fpMov') && ($('#fpMov').onchange = e => { UI.fpMov = e.target.value; render(); });
  $('#novoMov').onclick = () => formMov();
  $('#balanco').onclick = () => formBalanco();
  $$('[data-mov]', el).forEach(b => b.onclick = () => formMov(b.dataset.mov));
  $$('[data-delmov]', el).forEach(b => b.onclick = () => confirmar('Excluir esta movimentação? O saldo será recalculado.', () => Store.commit([del('movimentos', b.dataset.delmov)]), 'Excluir'));
}

function prodOptions(sel) {
  return opt(Store.data.produtos.filter(p => p.ativo !== 'nao' || p.id === sel).sort((a, b) => a.nome.localeCompare(b.nome)).map(p => [p.id, (p.sku ? p.sku + ' — ' : '') + p.nome]), sel, 'Selecione o produto…');
}

function formMov(prodId) {
  if (!Store.data.produtos.length) return toast('Cadastre um produto primeiro', 'err');
  const sal = saldos();
  Modal.open({
    title: 'Lançar movimentação de estoque', small: true,
    body: `<div class="grid">
      ${field('Produto *', `<select name="produtoId" required id="mvProd">${prodOptions(prodId)}</select>`)}
      <div class="note" id="mvSaldo"></div>
      <div class="grid g2">
        ${field('Tipo', `<select name="tipo">${opt([['entrada', 'Entrada (+)'], ['saida', 'Saída (−)']], 'entrada')}</select>`)}
        ${field('Quantidade *', inp('quantidade', '', 'inputmode="decimal" required'))}
        ${field('Data', inp('data', hoje(), 'type="date"'))}
        ${field('Custo unitário (R$)', inp('custoUnit', '', 'inputmode="decimal" id="mvCusto"'))}
      </div>
      ${field('Observação', inp('obs', '', 'placeholder="Ex.: ajuste, avaria, brinde, devolução…"'))}
    </div>`,
    onOpen: () => {
      const upd = () => { const p = produto($('#mvProd').value); $('#mvSaldo').textContent = p ? `Saldo atual: ${qtdFmt(sal[p.id] || 0)} ${p.unidade || 'un'}` : 'Selecione um produto'; if (p && !$('#mvCusto').value) $('#mvCusto').value = dec(p.custo); };
      $('#mvProd').onchange = upd; upd();
    },
    onSubmit: fd => {
      const q = num(fd.quantidade);
      if (q <= 0) { toast('Quantidade deve ser maior que zero', 'err'); return false; }
      Store.commit([up('movimentos', { id: uid(), data: fd.data || hoje(), produtoId: fd.produtoId, tipo: fd.tipo, quantidade: q, custoUnit: r2(fd.custoUnit), origem: 'manual', origemId: '', obs: fd.obs, criadoEm: agora() })]);
      toast('Movimentação lançada', 'ok');
    },
  });
}

function formBalanco() {
  const sal = saldos();
  const prods = Store.data.produtos.filter(p => p.ativo !== 'nao').sort((a, b) => a.nome.localeCompare(b.nome));
  if (!prods.length) return toast('Cadastre um produto primeiro', 'err');
  Modal.open({
    title: 'Balanço / inventário', submit: 'Aplicar balanço',
    body: `<p class="muted" style="margin:0 0 12px;font-weight:700">Informe a quantidade contada fisicamente. Deixe em branco os produtos que não foram contados. O sistema lança a diferença como entrada ou saída.</p>
      <div class="grid g2" style="margin-bottom:12px">${field('Data do balanço', inp('data', hoje(), 'type="date"'))}</div>
      <div class="items"><table><thead><tr><th>Produto</th><th class="r">Saldo no sistema</th><th class="r">Contado</th></tr></thead><tbody>
      ${prods.map(p => `<tr><td class="wrap">${esc(p.nome)} <span class="muted">${esc(p.sku || '')}</span></td><td class="r">${qtdFmt(sal[p.id] || 0)}</td><td class="c-qtd"><input name="b_${p.id}" inputmode="decimal"></td></tr>`).join('')}
      </tbody></table></div>`,
    onSubmit: fd => {
      const ops = [];
      for (const p of prods) {
        const v = fd['b_' + p.id];
        if (v === undefined || String(v).trim() === '') continue;
        const dif = num(v) - (sal[p.id] || 0);
        if (Math.abs(dif) < 1e-9) continue;
        ops.push(up('movimentos', { id: uid(), data: fd.data || hoje(), produtoId: p.id, tipo: dif > 0 ? 'entrada' : 'saida', quantidade: Math.abs(dif), custoUnit: num(p.custo), origem: 'balanco', origemId: '', obs: `Balanço: contado ${qtdFmt(v)}`, criadoEm: agora() }));
      }
      if (!ops.length) { toast('Nenhuma diferença encontrada'); return; }
      Store.commit(ops);
      toast(`Balanço aplicado: ${ops.length} ajuste(s)`, 'ok');
    },
  });
}

/* =========================================================
   VENDAS & COMPRAS (pedidos com itens)
   ========================================================= */
function badgeVenda(s) { return `<span class="badge ${{ 'Atendido': 'green', 'Recebido': 'green', 'Cancelado': 'gray', 'Orçamento': 'amber' }[s] || ''}">${esc(s)}</span>`; }

function viewPedidos(el, tipo) {
  const V = tipo === 'vendas';
  const key = V ? 'Vend' : 'Comp';
  actions(`<button class="btn accent" id="novoPed">${ICON.plus}${V ? 'Nova venda' : 'Novo pedido de compra'}</button>`);
  const q = UI['q' + key] || '';
  const st = UI['st' + key] || '';
  const mes = UI['m' + key] ?? '';
  const lista = Store.data[tipo]
    .filter(p => !st || p.status === st)
    .filter(p => !mes || (p.data || '').startsWith(mes))
    .filter(p => match(q, p.numero, nomeContato(V ? p.clienteId : p.fornecedorId), p.canal, p.obs, ...p.itens.map(i => nomeProduto(i.produtoId))))
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || num(b.numero) - num(a.numero));
  const tot = lista.filter(p => p.status !== 'Cancelado').reduce((s, p) => s + num(p.total), 0);
  el.innerHTML = `
    <div class="toolbar">
      ${searchBox('q' + key, q, V ? 'Buscar por nº, cliente, produto…' : 'Buscar por nº, fornecedor, produto…')}
      <input type="month" id="m${key}" value="${esc(mes)}" title="Filtrar por mês">
      <div class="chips"><button class="chip ${!st ? 'on' : ''}" data-st="">Todos</button>${(V ? ST_VENDA : ST_COMPRA).map(s => `<button class="chip ${st === s ? 'on' : ''}" data-st="${s}">${s}</button>`).join('')}</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nº</th><th>Data</th><th>${V ? 'Cliente' : 'Fornecedor'}</th>${V ? '<th>Canal</th>' : ''}<th class="r">Itens</th><th>Pagamento</th><th class="r">Total</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.length ? lista.map(p => `<tr>
        <td class="strong">${esc(p.numero)}</td><td>${dataBR(p.data)}</td>
        <td class="wrap">${esc(nomeContato(V ? p.clienteId : p.fornecedorId) || (V ? 'Consumidor final' : '—'))}</td>
        ${V ? `<td>${esc(p.canal)}</td>` : ''}
        <td class="r">${qtdFmt(p.itens.reduce((s, i) => s + num(i.qtd), 0))}</td>
        <td class="muted">${esc(p.formaPgto)}${num(p.parcelas) > 1 ? ` · ${p.parcelas}x` : ''}</td>
        <td class="r strong">${brl(p.total)}</td><td>${badgeVenda(p.status)}</td>
        <td class="act"><span class="inner">
          ${V && p.status !== 'Atendido' && p.status !== 'Cancelado' ? `<button class="btn ghost sm" data-fat="${p.id}" title="Baixa no estoque e gera contas a receber">${ICON.check}Faturar</button>` : ''}
          ${!V && p.status === 'Em aberto' ? `<button class="btn ghost sm" data-fat="${p.id}" title="Dar entrada da mercadoria no estoque">${ICON.check}Receber</button>` : ''}
          <button class="icon-btn" data-print="${p.id}" title="Imprimir">${ICON.print}</button>
          <button class="icon-btn" data-edit="${p.id}" title="Editar">${ICON.edit}</button>
          ${V ? `<button class="icon-btn del" data-del="${p.id}" title="Excluir">${ICON.del}</button>` : (p.status !== 'Cancelado' ? `<button class="icon-btn del" data-cancel="${p.id}" title="Cancelar pedido">${ICON.undo}</button>` : '')}</span></td>
      </tr>`).join('') : emptyRow(V ? 9 : 8, Store.data[tipo].length ? 'Nada encontrado com esses filtros' : (V ? 'Nenhuma venda ainda. Clique em “Nova venda”.' : 'Nenhum pedido de compra ainda.'), V ? '🛒' : '🚚')}</tbody>
      ${lista.length ? `<tfoot><tr><td colspan="${V ? 6 : 5}">${lista.length} pedido(s) · total sem cancelados</td><td class="r">${brl(tot)}</td><td colspan="2"></td></tr></tfoot>` : ''}
    </table></div>`;
  bindSearch('q' + key, 'q' + key);
  $('#m' + key).onchange = e => { UI['m' + key] = e.target.value; render(); };
  $$('[data-st]', el).forEach(b => b.onclick = () => { UI['st' + key] = b.dataset.st; render(); });
  const find = id => Store.data[tipo].find(p => p.id === id);
  $('#novoPed').onclick = () => (V ? formVenda() : formCompra());
  $$('[data-edit]', el).forEach(b => b.onclick = () => (V ? formVenda(find(b.dataset.edit)) : formCompra(find(b.dataset.edit))));
  $$('[data-print]', el).forEach(b => b.onclick = () => imprimirPedido(tipo, find(b.dataset.print)));
  $$('[data-fat]', el).forEach(b => b.onclick = () => {
    const p = find(b.dataset.fat);
    const novo = { ...p, status: V ? 'Atendido' : 'Recebido' };
    if (V) {
      const falta = faltaEstoque(novo);
      confirmar(`${V ? 'Faturar a venda' : 'Receber o pedido'} nº ${p.numero}? ${V ? 'Será dada baixa no estoque e geradas as contas a receber.' : ''}${falta}`, () => Store.commit([up(tipo, novo), ...efeitosVenda(novo)]).then(() => toast('Venda faturada', 'ok')), 'Faturar');
    } else {
      novo.recebidoEm = hoje();
      const unid = p.itens.reduce((s, i) => s + num(i.qtd) * fatorItem(i), 0);
      confirmar(`Confirmar o recebimento do pedido de compra nº ${p.numero}? Entram <b>${qtdFmt(unid)} unidade(s)</b> no estoque, com data de hoje.`, () => Store.commit([up(tipo, novo), ...efeitosCompra(novo)]).then(() => toast('Mercadoria recebida', 'ok')), 'Receber');
    }
  });
  $$('[data-cancel]', el).forEach(b => b.onclick = () => {
    const p = find(b.dataset.cancel);
    const pagas = Store.data.pagar.filter(r => r.origemId === p.id && r.status === 'Pago');
    const novo = { ...p, status: 'Cancelado' };
    confirmar(`Cancelar o pedido de compra nº ${p.numero}? Ele continua na lista como <b>Cancelado</b> (pedidos de compra não são excluídos).`
      + (p.status === 'Recebido' ? '<div class="note warn">A entrada no estoque deste pedido será estornada.</div>' : '')
      + (pagas.length ? `<div class="note warn">${pagas.length} parcela(s) já paga(s) continuam no financeiro. As demais serão removidas.</div>` : '<div class="note">As contas a pagar deste pedido serão removidas.</div>'),
      () => Store.commit([up(tipo, novo), ...efeitosCompra(novo)]).then(() => toast('Pedido cancelado', 'ok')), 'Cancelar pedido');
  });
  $$('[data-del]', el).forEach(b => b.onclick = () => {
    const p = find(b.dataset.del);
    const fin = Store.data[V ? 'receber' : 'pagar'].filter(r => r.origemId === p.id);
    if (fin.some(r => r.status === 'Pago')) return toast('Este pedido tem parcelas já baixadas. Estorne as baixas no financeiro antes de excluir.', 'err');
    confirmar(`Excluir ${V ? 'a venda' : 'o pedido de compra'} nº ${p.numero}? As movimentações de estoque e contas geradas por ele também serão removidas.`, () => {
      const ops = [del(tipo, p.id), ...Store.data.movimentos.filter(m => m.origemId === p.id).map(m => del('movimentos', m.id)), ...fin.map(r => del(V ? 'receber' : 'pagar', r.id))];
      return Store.commit(ops).then(() => toast('Excluído', 'ok'));
    }, 'Excluir');
  });
}
function viewVendas(el) { viewPedidos(el, 'vendas'); }
function viewCompras(el) { viewPedidos(el, 'compras'); }

function faltaEstoque(v) {
  const sal = saldos();
  // descontar o que esta venda já baixou (em caso de edição)
  Store.data.movimentos.filter(m => m.origemId === v.id && m.tipo === 'saida').forEach(m => { sal[m.produtoId] = (sal[m.produtoId] || 0) + num(m.quantidade); });
  const req = {};
  v.itens.forEach(i => { req[i.produtoId] = (req[i.produtoId] || 0) + num(i.qtd); });
  const faltas = Object.entries(req).filter(([id, q]) => q > (sal[id] || 0)).map(([id, q]) => `${nomeProduto(id)} (saldo ${qtdFmt(sal[id] || 0)}, pedido ${qtdFmt(q)})`);
  return faltas.length ? `<div class="note warn">Atenção: estoque insuficiente para ${faltas.map(esc).join('; ')}. O saldo ficará negativo.</div>` : '';
}

const NOVO_PROD = '__novo__';
function prodOptionsPedido(sel) {
  // "Selecione…" continua sendo a primeira opção; logo abaixo vem o atalho de cadastro
  const o = prodOptions(sel), i = o.indexOf('</option>') + 9;
  return o.slice(0, i) + `<option value="${NOVO_PROD}">➕ Cadastrar novo produto…</option>` + o.slice(i);
}
function itemRow(it, V) {
  return `<tr>
    <td class="c-prod"><select data-i="prod">${prodOptionsPedido(it.produtoId)}</select></td>
    <td class="c-qtd"><input data-i="qtd" inputmode="decimal" value="${esc(it.qtd ?? 1)}"></td>
    <td class="c-val"><input data-i="valor" inputmode="decimal" value="${dec(it.valor)}" placeholder="${V ? 'preço' : 'custo'}"></td>
    <td class="c-sub" data-i="sub"></td>
    <td class="act"><button type="button" class="icon-btn del" data-i="rm" title="Remover">${ICON.del}</button></td>
  </tr>`;
}

function formPedido(tipo, p) {
  const V = tipo === 'vendas';
  const novo = !p;
  p = p ? { ...p, itens: p.itens.map(i => ({ ...i })) } : {
    numero: proxNumero(Store.data[tipo]), data: hoje(), status: V ? 'Em aberto' : 'Em aberto', canal: 'Loja física',
    formaPgto: V ? 'Pix' : 'Boleto', parcelas: 1, vencimento: V ? hoje() : addDias(hoje(), 30), frete: '', desconto: '', itens: [{ qtd: 1 }],
  };
  const contatos = Store.data.contatos.filter(c => c.tipo === 'Ambos' || c.tipo === (V ? 'Cliente' : 'Fornecedor')).sort((a, b) => a.nome.localeCompare(b.nome)).map(c => [c.id, c.nome]);
  const statusAnterior = p.status;
  Modal.open({
    title: novo ? (V ? 'Nova venda' : 'Novo pedido de compra') : `${V ? 'Venda' : 'Pedido de compra'} nº ${p.numero}`,
    submit: 'Salvar pedido',
    body: `
      <div class="grid g4">
        ${field('Número', inp('numero', p.numero, 'required'))}
        ${field('Data *', inp('data', p.data, 'type="date" required'))}
        ${field(V ? 'Cliente' : 'Fornecedor *', `<select name="contatoId" ${V ? '' : 'required'}>${opt(contatos, V ? p.clienteId : p.fornecedorId, V ? 'Consumidor final' : 'Selecione…')}</select>`, 'span2')}
        ${V ? field('Canal de venda', `<select name="canal">${opt(CANAIS, p.canal)}</select>`) : ''}
        ${field('Situação', `<select name="status" id="pedStatus">${opt(V ? ST_VENDA : ST_COMPRA, p.status)}</select>`)}
        <div class="span2" style="display:flex;align-items:end"><button type="button" class="btn ghost sm" id="novoContato">${ICON.plus}Novo ${V ? 'cliente' : 'fornecedor'}</button></div>
      </div>
      <div class="inline-new" id="pnlContato" hidden>
        <div class="inline-head"><b>Novo ${V ? 'cliente' : 'fornecedor'}</b><span class="muted">cadastro rápido — já fica selecionado neste pedido</span></div>
        <div class="grid g4">
          ${field('Nome / razão social *', '<input data-nc="nome" autocomplete="off">', 'span2')}
          ${field('CPF / CNPJ', '<input data-nc="documento" autocomplete="off">')}
          ${field('Telefone / WhatsApp', '<input data-nc="telefone" inputmode="tel" autocomplete="off">')}
          ${field('E-mail', '<input data-nc="email" type="email" autocomplete="off">', 'span2')}
          ${field('Cidade', '<input data-nc="cidade" autocomplete="off">')}
          ${field('UF', '<input data-nc="uf" maxlength="2" autocomplete="off">')}
        </div>
        <div class="inline-actions"><button type="button" class="btn ghost sm" data-nc-cancel>Cancelar</button><button type="button" class="btn primary sm" data-nc-save>Salvar ${V ? 'cliente' : 'fornecedor'}</button></div>
      </div>
      <div class="section-t">Itens</div>
      <div class="items"><table>
        <thead><tr><th>Produto</th><th>Qtd</th><th>${V ? 'Preço unit.' : 'Custo unit.'}</th><th class="r">Subtotal</th><th></th></tr></thead>
        <tbody id="itensBody">${p.itens.map(i => itemRow(i, V)).join('')}</tbody>
      </table><div class="items-add"><button type="button" class="btn ghost sm" id="addItem">${ICON.plus}Adicionar item</button><button type="button" class="btn ghost sm" id="addProdNovo">${ICON.plus}Cadastrar novo produto</button>${Store.data.produtos.length ? '' : '<span class="muted" style="font-size:13px;font-weight:700">Nenhum produto cadastrado ainda — cadastre aqui mesmo, sem sair do pedido.</span>'}</div></div>
      <div class="inline-new" id="pnlProduto" hidden>
        <div class="inline-head"><b>Novo produto</b><span class="muted">cadastro rápido — entra direto no item do pedido</span></div>
        <div class="grid g4">
          ${field('Nome do produto *', '<input data-np="nome" autocomplete="off">', 'span2')}
          ${field('SKU / código', '<input data-np="sku" autocomplete="off">')}
          ${field('Categoria', '<input data-np="categoria" list="dlCatsPed" autocomplete="off">' + `<datalist id="dlCatsPed">${[...new Set(Store.data.produtos.map(x => x.categoria).filter(Boolean))].sort().map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
          ${field('Unidade', `<select data-np="unidade">${opt(['un', 'cx', 'kg', 'g', 'L', 'm', 'par', 'kit', 'pct'], 'un')}</select>`)}
          ${field('Custo (R$)' + (V ? '' : ' *'), '<input data-np="custo" inputmode="decimal" placeholder="0,00" autocomplete="off">')}
          ${field('Preço de venda (R$)' + (V ? ' *' : ''), '<input data-np="preco" inputmode="decimal" placeholder="0,00" autocomplete="off">')}
          ${field('Estoque mínimo', '<input data-np="estoqueMin" inputmode="decimal" placeholder="0" autocomplete="off">')}
        </div>
        <div class="inline-actions"><button type="button" class="btn ghost sm" data-np-cancel>Cancelar</button><button type="button" class="btn primary sm" data-np-save>Salvar produto e usar no item</button></div>
      </div>
      <div class="grid g4" style="margin-top:14px">
        ${field('Frete (R$)', inp('frete', dec(p.frete), 'inputmode="decimal" placeholder="0,00" id="pedFrete"'))}
        ${field('Desconto (R$)', inp('desconto', dec(p.desconto), 'inputmode="decimal" placeholder="0,00" id="pedDesc"'))}
        <div class="span2 totals" style="align-items:end;margin:0"><span>Produtos: <span id="tProd">R$ 0,00</span></span><span>Total: <b id="tTotal">R$ 0,00</b></span></div>
      </div>
      <div class="section-t">Pagamento</div>
      <div class="grid g4">
        ${field('Forma de pagamento', `<select name="formaPgto">${opt(FORMAS, p.formaPgto)}</select>`)}
        ${field('Parcelas', inp('parcelas', p.parcelas || 1, 'type="number" min="1" max="48"'))}
        ${field('1º vencimento', inp('vencimento', p.vencimento || p.data, 'type="date"'))}
      </div>
      ${field('Observações', `<textarea name="obs">${esc(p.obs)}</textarea>`, '')}
      <div class="note">${V ? 'Ao salvar como <b>Atendido</b>, o sistema dá baixa no estoque e gera as contas a receber (Pix/dinheiro/débito à vista já entram como recebidas).' : 'Ao salvar como <b>Recebido</b>, os produtos entram no estoque, o custo do produto é atualizado e as contas a pagar são geradas.'}</div>`,
    onOpen: body => {
      const tb = $('#itensBody', body);
      const recalc = () => {
        let s = 0;
        $$('tr', tb).forEach(tr => { const v = num($('[data-i=qtd]', tr).value) * num($('[data-i=valor]', tr).value); s += v; $('[data-i=sub]', tr).textContent = brl(v); });
        $('#tProd').textContent = brl(s);
        $('#tTotal').textContent = brl(s + num($('#pedFrete').value) - num($('#pedDesc').value));
      };
      tb.addEventListener('input', recalc);
      // ---- cadastro rápido de produto
      const pnlP = $('#pnlProduto', body);
      let linhaAlvo = null;
      const abrirProduto = tr => {
        linhaAlvo = tr;
        $$('[data-np]', pnlP).forEach(i => { i.value = i.tagName === 'SELECT' ? 'un' : ''; });
        let n = Store.data.produtos.length + 1, sku;
        do { sku = 'CH' + String(n++).padStart(4, '0'); } while (Store.data.produtos.some(x => x.sku === sku));
        $('[data-np=sku]', pnlP).value = sku;
        pnlP.hidden = false; pnlP.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setTimeout(() => $('[data-np=nome]', pnlP).focus(), 50);
      };
      const fecharProduto = () => { pnlP.hidden = true; linhaAlvo = null; };
      const salvarProduto = () => {
        const g = k => $(`[data-np=${k}]`, pnlP).value.trim();
        if (!g('nome')) { toast('Informe o nome do produto', 'err'); $('[data-np=nome]', pnlP).focus(); return; }
        if (V && !num(g('preco'))) { toast('Informe o preço de venda', 'err'); $('[data-np=preco]', pnlP).focus(); return; }
        if (!V && !num(g('custo'))) { toast('Informe o custo do produto', 'err'); $('[data-np=custo]', pnlP).focus(); return; }
        if (g('sku') && Store.data.produtos.some(x => x.sku === g('sku'))) { toast('Já existe um produto com esse SKU', 'err'); return; }
        const pr = { id: uid(), sku: g('sku'), nome: g('nome'), categoria: g('categoria'), unidade: g('unidade') || 'un', custo: r2(g('custo')), preco: r2(g('preco')), estoqueMin: num(g('estoqueMin')), ean: '', ncm: '', ativo: 'sim', criadoEm: agora() };
        Store.commit([up('produtos', pr)]);
        // atualiza as listas de produto de todas as linhas, mantendo o que já estava escolhido
        $$('[data-i=prod]', tb).forEach(s => { const v = s.value; s.innerHTML = prodOptionsPedido(v === NOVO_PROD ? '' : v); });
        let tr = linhaAlvo && tb.contains(linhaAlvo) ? linhaAlvo : null;
        if (!tr) { tr = $$('tr', tb).find(r => !$('[data-i=prod]', r).value); }
        if (!tr) { tb.insertAdjacentHTML('beforeend', itemRow({ qtd: 1 }, V)); tr = $('tr:last-child', tb); }
        $('[data-i=prod]', tr).value = pr.id;
        $('[data-i=valor]', tr).value = dec(V ? pr.preco : pr.custo);
        fecharProduto(); recalc();
        const hint = $('.items-add .muted', body); if (hint) hint.remove();
        toast('Produto cadastrado e adicionado ao pedido', 'ok');
        setTimeout(() => $('[data-i=qtd]', tr).select(), 50);
      };
      $('[data-np-save]', pnlP).onclick = salvarProduto;
      $('[data-np-cancel]', pnlP).onclick = fecharProduto;
      pnlP.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvarProduto(); } });
      $('#addProdNovo', body).onclick = () => abrirProduto(null);

      tb.addEventListener('change', e => {
        if (e.target.dataset.i === 'prod' && e.target.value === NOVO_PROD) {
          e.target.value = '';
          abrirProduto(e.target.closest('tr'));
          return;
        }
        if (e.target.dataset.i === 'prod') {
          const pr = produto(e.target.value);
          if (pr) $('[data-i=valor]', e.target.closest('tr')).value = dec(V ? pr.preco : pr.custo);
          recalc();
        }
      });
      tb.addEventListener('click', e => {
        const b = e.target.closest('[data-i=rm]');
        if (b) { if ($$('tr', tb).length > 1) b.closest('tr').remove(); else { $('select', b.closest('tr')).value = ''; } recalc(); }
      });
      $('#addItem', body).onclick = () => { tb.insertAdjacentHTML('beforeend', itemRow({ qtd: 1 }, V)); recalc(); $('tr:last-child select', tb).focus(); };
      $('#pedFrete').oninput = recalc; $('#pedDesc').oninput = recalc;
      // ---- cadastro rápido de cliente / fornecedor
      const pnlC = $('#pnlContato', body);
      const fecharContato = () => { pnlC.hidden = true; };
      const salvarContato = () => {
        const g = k => $(`[data-nc=${k}]`, pnlC).value.trim();
        if (!g('nome')) { toast('Informe o nome', 'err'); $('[data-nc=nome]', pnlC).focus(); return; }
        const c = { id: uid(), tipo: V ? 'Cliente' : 'Fornecedor', nome: g('nome'), documento: g('documento'), telefone: g('telefone'), email: g('email'), cidade: g('cidade'), uf: g('uf').toUpperCase(), obs: '', criadoEm: agora() };
        Store.commit([up('contatos', c)]);
        const sel = $('[name=contatoId]', body);
        sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.nome)}</option>`);
        sel.value = c.id;
        fecharContato();
        toast((V ? 'Cliente' : 'Fornecedor') + ' cadastrado e selecionado', 'ok');
      };
      $('#novoContato', body).onclick = () => {
        $$('[data-nc]', pnlC).forEach(i => { i.value = ''; });
        pnlC.hidden = false; setTimeout(() => $('[data-nc=nome]', pnlC).focus(), 50);
      };
      $('[data-nc-save]', pnlC).onclick = salvarContato;
      $('[data-nc-cancel]', pnlC).onclick = fecharContato;
      pnlC.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvarContato(); } });
      recalc();
    },
    onSubmit: (fd, body) => {
      if (!$('#pnlProduto', body).hidden && $('[data-np=nome]', body).value.trim()) { toast('Termine o cadastro do produto (Salvar produto) ou clique em Cancelar', 'err'); return false; }
      if (!$('#pnlContato', body).hidden && $('[data-nc=nome]', body).value.trim()) { toast('Termine o cadastro (Salvar) ou clique em Cancelar', 'err'); return false; }
      const itens = $$('#itensBody tr', body).map(tr => ({ produtoId: $('[data-i=prod]', tr).value, qtd: num($('[data-i=qtd]', tr).value), valor: r2($('[data-i=valor]', tr).value) }))
        .filter(i => i.produtoId && i.qtd > 0);
      if (!itens.length) { toast('Adicione pelo menos um item com produto e quantidade', 'err'); return false; }
      if (Store.data[tipo].some(x => String(x.numero) === String(fd.numero).trim() && x.id !== p.id)) { toast('Já existe um pedido com esse número', 'err'); return false; }
      const total = r2(totalItens(itens) + num(fd.frete) - num(fd.desconto));
      const rec = {
        id: p.id || uid(), numero: String(fd.numero).trim(), data: fd.data, status: fd.status, itens,
        frete: r2(fd.frete), desconto: r2(fd.desconto), total, formaPgto: fd.formaPgto,
        parcelas: Math.max(1, Math.floor(num(fd.parcelas)) || 1), vencimento: fd.vencimento || fd.data, obs: fd.obs, criadoEm: p.criadoEm || agora(),
      };
      if (V) { rec.clienteId = fd.contatoId; rec.canal = fd.canal; } else { rec.fornecedorId = fd.contatoId; }
      const efeitos = V ? efeitosVenda(rec) : efeitosCompra(rec);
      const salvar = () => { Store.commit([up(tipo, rec), ...efeitos]); toast(novo ? 'Pedido criado' : 'Pedido atualizado', 'ok'); };
      const fin = Store.data[V ? 'receber' : 'pagar'].filter(r => r.origemId === rec.id);
      if (fin.some(r => r.status === 'Pago') && (num(p.total) !== total || statusAnterior !== rec.status)) toast('Este pedido tem parcelas já baixadas: as contas não foram regeneradas. Ajuste no financeiro se necessário.');
      if (V && rec.status === 'Atendido') {
        const falta = faltaEstoque(rec);
        if (falta) { Modal.close(); setTimeout(() => confirmar('Salvar mesmo assim?' + falta, salvar, 'Salvar'), 50); return false; }
      }
      salvar();
    },
  });
}
function formVenda(p) { formPedido('vendas', p); }
/* =========================================================
   CPF / CNPJ — identificação automática e busca na Receita
   ========================================================= */
const soDig = s => String(s || '').replace(/\D/g, '');
function cpfValido(v) {
  const c = soDig(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== +c[t]) return false;
  }
  return true;
}
function cnpjValido(v) {
  const c = soDig(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0, p = n - 7; for (let i = 0; i < n; i++) { s += +c[i] * p--; if (p < 2) p = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
function fmtDoc(v) {
  const d = soDig(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2');
}
function tipoDoc(v) {
  const d = soDig(v);
  if (d.length === 11) return cpfValido(d) ? 'cpf' : 'cpf-invalido';
  if (d.length === 14) return cnpjValido(d) ? 'cnpj' : 'cnpj-invalido';
  return d.length ? 'incompleto' : '';
}
const fmtTel = v => { const d = soDig(v); if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return v || ''; };
const fmtCep = v => { const d = soDig(v); return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : (v || ''); };
const titulo = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());

/* Consulta dados públicos do CNPJ (Receita Federal) — BrasilAPI e, se falhar, CNPJ.ws */
async function buscarCNPJ(cnpj) {
  const c = soDig(cnpj);
  try {
    const r = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + c);
    if (r.status === 404) throw new Error('CNPJ não encontrado na Receita');
    if (r.ok) {
      const d = await r.json();
      return {
        nome: d.razao_social || '', fantasia: d.nome_fantasia || '', telefone: fmtTel(d.ddd_telefone_1 || d.ddd_telefone_2), email: String(d.email || '').toLowerCase(),
        cep: fmtCep(d.cep), cidade: titulo(d.municipio), uf: d.uf || '', situacao: d.descricao_situacao_cadastral || '',
        endereco: [titulo([d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' ')), d.numero, titulo(d.complemento), titulo(d.bairro)].filter(Boolean).join(', '),
      };
    }
  } catch (e) { if (/não encontrado/.test(e.message)) throw e; }
  const r2 = await fetch('https://publica.cnpj.ws/cnpj/' + c);
  if (!r2.ok) throw new Error(r2.status === 404 ? 'CNPJ não encontrado na Receita' : 'Consulta indisponível agora (tente em 1 minuto)');
  const d = await r2.json(), e = d.estabelecimento || {};
  return {
    nome: d.razao_social || '', fantasia: e.nome_fantasia || '', telefone: fmtTel((e.ddd1 || '') + (e.telefone1 || '')), email: String(e.email || '').toLowerCase(),
    cep: fmtCep(e.cep), cidade: titulo(e.cidade?.nome), uf: e.estado?.sigla || '', situacao: e.situacao_cadastral || '',
    endereco: [titulo([e.tipo_logradouro, e.logradouro].filter(Boolean).join(' ')), e.numero, titulo(e.complemento), titulo(e.bairro)].filter(Boolean).join(', '),
  };
}

/* Liga um campo de CPF/CNPJ: máscara, identificação automática, validação e busca na Receita.
   get(k) devolve o input do campo k (nome, fantasia, telefone, email, cep, endereco, cidade, uf). */
function ligarDocumento(docInput, statusEl, get, ignorarId) {
  let ultimo = '';
  const status = (html, cls = '') => { statusEl.className = 'doc-status ' + cls; statusEl.innerHTML = html; };
  const atualizar = async () => {
    const d = soDig(docInput.value);
    const pos = docInput.selectionStart, antes = docInput.value.length;
    docInput.value = fmtDoc(d);
    if (document.activeElement === docInput && pos === antes) docInput.setSelectionRange(docInput.value.length, docInput.value.length);
    const t = tipoDoc(d);
    const dup = d.length >= 11 && Store.data.contatos.find(c => soDig(c.documento) === d && c.id !== ignorarId);
    if (!t) return status('Digite o CPF (11 dígitos) ou o CNPJ (14 dígitos). O tipo é identificado sozinho.');
    if (t === 'incompleto') return status(d.length < 11 ? `${d.length} dígito(s)…` : `Parece um CNPJ: ${d.length}/14 dígitos…`);
    if (t === 'cpf-invalido') return status('CPF inválido — confira os números.', 'bad');
    if (t === 'cnpj-invalido') return status('CNPJ inválido — confira os números.', 'bad');
    if (dup) return status(`Já existe um cadastro com este documento: <b>${esc(dup.nome)}</b>.`, 'warn');
    if (t === 'cpf') return status('<b>Pessoa física</b> · CPF válido ✓', 'ok');
    if (d === ultimo) return;
    ultimo = d;
    status('<b>Pessoa jurídica</b> · CNPJ válido · buscando dados na Receita…', 'load');
    try {
      const r = await buscarCNPJ(d);
      if (soDig(docInput.value) !== d) return;
      for (const k of ['nome', 'fantasia', 'telefone', 'email', 'cep', 'endereco', 'cidade', 'uf']) { const i = get(k); if (i && r[k]) i.value = r[k]; }
      const sit = String(r.situacao || '').toUpperCase();
      status(`<b>Pessoa jurídica</b> · dados preenchidos pela Receita ✓${sit ? ` · situação: <b>${esc(sit)}</b>` : ''}`, sit && sit !== 'ATIVA' ? 'warn' : 'ok');
    } catch (e) {
      ultimo = '';
      status(`<b>Pessoa jurídica</b> · CNPJ válido. ${esc(e.message || 'Não foi possível consultar a Receita')} — preencha os dados manualmente.`, 'warn');
    }
  };
  if (docInput._atualizarDoc) { docInput._atualizarDoc(); return; }   // já ligado: só reavalia
  docInput._atualizarDoc = atualizar;
  docInput.addEventListener('input', atualizar);
  atualizar();
}

/* Markup: custo × (1 + markup%) = preço de venda. Editar o preço recalcula o markup. */
const fmtPct = v => (isFinite(v) ? (Math.round(v * 100) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2, useGrouping: false }) : '');
function ligarMarkup(custo, markup, preco) {
  const pelaMarkup = () => {
    const c = num(custo.value), m = markup.value.trim();
    if (c > 0 && m !== '') preco.value = dec(c * (1 + num(m) / 100));
  };
  markup.addEventListener('input', pelaMarkup);
  custo.addEventListener('input', pelaMarkup);
  preco.addEventListener('input', () => {
    const c = num(custo.value), v = num(preco.value);
    markup.value = c > 0 && v > 0 ? fmtPct((v / c - 1) * 100) : '';
  });
  if (!markup.value && num(custo.value) > 0 && num(preco.value) > 0) markup.value = fmtPct((num(preco.value) / num(custo.value) - 1) * 100);
}

/* Campos de cadastro de pessoa (usados no cadastro rápido e no cadastro completo) */
function camposPessoa(pref, c = {}) {
  const a = k => `data-${pref}="${k}"`;
  return `
    <div class="grid g4">
      <label class="f span2">CPF ou CNPJ<input ${a('documento')} inputmode="numeric" autocomplete="off" value="${esc(c.documento || '')}" placeholder="Só números — o tipo é identificado sozinho"><span class="doc-status" ${a('docStatus')}></span></label>
      ${field('Nome / razão social *', `<input ${a('nome')} autocomplete="off" value="${esc(c.nome || '')}">`, 'span2')}
      ${field('Nome fantasia', `<input ${a('fantasia')} autocomplete="off" value="${esc(c.fantasia || '')}">`, 'span2')}
      ${field('Telefone / WhatsApp', `<input ${a('telefone')} inputmode="tel" autocomplete="off" value="${esc(c.telefone || '')}">`)}
      ${field('E-mail', `<input ${a('email')} type="email" autocomplete="off" value="${esc(c.email || '')}">`)}
      ${field('CEP', `<input ${a('cep')} inputmode="numeric" autocomplete="off" value="${esc(c.cep || '')}">`)}
      ${field('Endereço', `<input ${a('endereco')} autocomplete="off" value="${esc(c.endereco || '')}">`, 'span3')}
      ${field('Cidade', `<input ${a('cidade')} autocomplete="off" value="${esc(c.cidade || '')}">`, 'span3')}
      ${field('UF', `<input ${a('uf')} maxlength="2" autocomplete="off" value="${esc(c.uf || '')}">`)}
    </div>`;
}
function lerPessoa(root, pref) {
  const g = k => ($(`[data-${pref}="${k}"]`, root)?.value || '').trim();
  return { documento: fmtDoc(g('documento')), nome: g('nome'), fantasia: g('fantasia'), telefone: g('telefone'), email: g('email'), cep: g('cep'), endereco: g('endereco'), cidade: g('cidade'), uf: g('uf').toUpperCase() };
}

/* Campo de busca de fornecedor: sugestões a partir de 3 letras + opção de cadastrar */
function fornecedorPicker(wrap, onNovo) {
  const txt = $('.ac-txt', wrap), hid = $('input[type=hidden]', wrap), list = $('.ac-list', wrap);
  let itens = [], ativo = -1;
  const lista = () => Store.data.contatos.filter(c => c.tipo === 'Fornecedor' || c.tipo === 'Ambos');
  const fechar = () => { list.hidden = true; ativo = -1; };
  const marcar = () => $$('.ac-item', list).forEach((el, i) => el.classList.toggle('on', i === ativo));
  const escolher = c => { hid.value = c.id; txt.value = c.nome; wrap.classList.add('ok'); fechar(); };
  const abrir = () => {
    const q = txt.value.trim(), d = soDig(q);
    if (q.length < 3) { itens = []; list.innerHTML = '<div class="ac-hint">Digite pelo menos 3 letras do nome (ou números do CNPJ/CPF)…</div>'; list.hidden = false; return; }
    const r = lista().filter(c => match(q, c.nome, c.fantasia) || (d.length >= 3 && soDig(c.documento).includes(d)))
      .sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 8);
    itens = [...r.map(c => ({ c })), { novo: true }];
    list.innerHTML = (r.length ? '' : '<div class="ac-hint">Nenhum fornecedor encontrado.</div>')
      + r.map((c, i) => `<div class="ac-item" data-k="${i}"><b>${esc(c.nome)}</b><small>${esc([c.fantasia, c.documento, c.cidade && c.cidade + (c.uf ? '/' + c.uf : '')].filter(Boolean).join(' · '))}</small></div>`).join('')
      + `<div class="ac-item ac-novo" data-k="${r.length}">➕ Cadastrar novo fornecedor${q ? ` “${esc(q)}”` : ''}</div>`;
    ativo = 0; marcar(); list.hidden = false;
  };
  const pick = k => { const it = itens[k]; if (!it) return; if (it.novo) { fechar(); onNovo(txt.value.trim()); } else escolher(it.c); };
  txt.addEventListener('input', () => { hid.value = ''; wrap.classList.remove('ok'); abrir(); });
  txt.addEventListener('focus', () => { if (!hid.value) abrir(); });
  txt.addEventListener('blur', () => setTimeout(fechar, 150));
  txt.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); if (!list.hidden) pick(ativo); return; }
    if (list.hidden || !itens.length) return;
    if (e.key === 'ArrowDown') { ativo = Math.min(itens.length - 1, ativo + 1); marcar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { ativo = Math.max(0, ativo - 1); marcar(); e.preventDefault(); }
    else if (e.key === 'Escape') { fechar(); e.preventDefault(); e.stopPropagation(); }
  });
  list.addEventListener('mousedown', e => { const it = e.target.closest('.ac-item'); if (!it) return; e.preventDefault(); pick(+it.dataset.k); });
  if (hid.value) wrap.classList.add('ok');
  return { escolher };
}

/* =========================================================
   PEDIDO DE COMPRA
   ========================================================= */
function itemRowCompra(it) {
  const un = it.un || 'UN', emb = un !== 'UN';
  return `<tr>
    <td class="c-prod"><select data-i="prod">${prodOptionsPedido(it.produtoId)}</select></td>
    <td class="c-un"><select data-i="un" title="Como vem na compra">${opt(UN_COMPRA, un)}</select></td>
    <td class="c-fat"><input data-i="fator" inputmode="numeric" value="${emb ? esc(it.fator || '') : ''}" placeholder="${emb ? 'ex.: 12' : '—'}" ${emb ? '' : 'disabled'} title="Quantas unidades vêm em cada embalagem"></td>
    <td class="c-qtd"><input data-i="qtd" inputmode="decimal" value="${esc(it.qtd ?? 1)}"></td>
    <td class="c-val"><input data-i="valor" inputmode="decimal" value="${dec(it.valor)}" placeholder="custo"></td>
    <td class="c-sub"><span data-i="sub"></span><small data-i="eq"></small></td>
    <td class="act"><button type="button" class="icon-btn del" data-i="rm" title="Remover">${ICON.del}</button></td>
  </tr>`;
}

function formCompra(p) {
  const novo = !p;
  p = p ? { ...p, itens: p.itens.map(i => ({ ...i })) } : {
    data: hoje(), status: 'Em aberto', formaPgto: 'Boleto', parcelas: 1, vencimento: addDias(hoje(), 30), previsao: '', frete: '', desconto: '', itens: [{ qtd: 1, un: 'UN' }],
  };
  const numeroPrevisto = novo ? proxNumero(Store.data.compras) : p.numero;
  const forn = contato(p.fornecedorId);
  const formas = FORMAS_COMPRA.includes(p.formaPgto) || !p.formaPgto ? FORMAS_COMPRA : [...FORMAS_COMPRA, p.formaPgto];
  const statusAnterior = p.status;
  Modal.open({
    title: novo ? 'Novo pedido de compra' : `Pedido de compra nº ${p.numero}`,
    submit: 'Salvar pedido',
    body: `
      <div class="grid g4">
        <label class="f">Nº do pedido<div class="num-fixo" title="Número sequencial automático">${esc(numeroPrevisto)}${novo ? '<small>confirmado ao salvar</small>' : ''}</div></label>
        ${field('Data do pedido *', inp('data', p.data, 'type="date" required'))}
        ${field('Situação', `<select name="status" id="pedStatus">${opt(ST_COMPRA, p.status)}</select>`)}
        <label class="f span4">Fornecedor *
          <div class="ac" id="acForn">
            <input class="ac-txt" autocomplete="off" placeholder="Digite 3 letras do nome ou o CNPJ/CPF…" value="${esc(forn?.nome || '')}">
            <input type="hidden" name="contatoId" value="${esc(p.fornecedorId || '')}">
            <div class="ac-list" hidden></div>
          </div>
        </label>
      </div>
      <div class="inline-new" id="pnlContato" hidden>
        <div class="inline-head"><b>Novo fornecedor</b><span class="muted">digite o CNPJ para preencher tudo automaticamente pela Receita</span></div>
        ${camposPessoa('nc')}
        <div class="inline-actions"><button type="button" class="btn ghost sm" data-nc-cancel>Cancelar</button><button type="button" class="btn primary sm" data-nc-save>Salvar fornecedor</button></div>
      </div>
      <div class="section-t">Itens</div>
      <div class="items"><table>
        <thead><tr><th>Produto</th><th>Embalagem</th><th>Unid. por emb.</th><th>Qtd</th><th>Custo por emb.</th><th class="r">Subtotal</th><th></th></tr></thead>
        <tbody id="itensBody">${p.itens.map(itemRowCompra).join('')}</tbody>
      </table><div class="items-add"><button type="button" class="btn ghost sm" id="addItem">${ICON.plus}Adicionar item</button><button type="button" class="btn ghost sm" id="addProdNovo">${ICON.plus}Cadastrar novo produto</button><span class="muted" id="eqTotal" style="font-size:13px;font-weight:800;margin-left:auto"></span></div></div>
      <div class="inline-new" id="pnlProduto" hidden>
        <div class="inline-head"><b>Novo produto</b><span class="muted">cadastro rápido — entra direto no item do pedido</span></div>
        <div class="grid g4">
          ${field('Nome do produto *', '<input data-np="nome" autocomplete="off">', 'span2')}
          ${field('SKU / código', '<input data-np="sku" autocomplete="off">')}
          ${field('Categoria', '<input data-np="categoria" list="dlCatsPed" autocomplete="off">' + `<datalist id="dlCatsPed">${[...new Set(Store.data.produtos.map(x => x.categoria).filter(Boolean))].sort().map(x => `<option value="${esc(x)}">`).join('')}</datalist>`)}
          ${field('Custo por unidade (R$)', '<input data-np="custo" inputmode="decimal" placeholder="0,00" autocomplete="off">')}
          ${field('Markup (%)', '<input data-np="markup" inputmode="decimal" placeholder="ex.: 50" autocomplete="off">')}
          ${field('Preço de venda (R$)', '<input data-np="preco" inputmode="decimal" placeholder="0,00" autocomplete="off">')}
          ${field('Estoque mínimo (un)', '<input data-np="estoqueMin" inputmode="decimal" placeholder="0" autocomplete="off">')}
        </div>
        <div class="inline-actions"><button type="button" class="btn ghost sm" data-np-cancel>Cancelar</button><button type="button" class="btn primary sm" data-np-save>Salvar produto e usar no item</button></div>
      </div>
      <div class="grid g4" style="margin-top:14px">
        ${field('Frete (R$)', inp('frete', dec(p.frete), 'inputmode="decimal" placeholder="0,00" id="pedFrete"'))}
        ${field('Desconto (R$)', inp('desconto', dec(p.desconto), 'inputmode="decimal" placeholder="0,00" id="pedDesc"'))}
        <div class="span2 totals" style="align-items:end;margin:0"><span>Produtos: <span id="tProd">R$ 0,00</span></span><span>Total: <b id="tTotal">R$ 0,00</b></span></div>
      </div>
      <div class="section-t">Pagamento</div>
      <div class="grid g4">
        ${field('Forma de pagamento', `<select name="formaPgto" id="pgForma">${opt(formas, p.formaPgto)}</select>`)}
        ${field('Parcelas', inp('parcelas', p.parcelas || 1, 'type="number" min="1" max="48" id="pgParc"'))}
        ${field('1º vencimento', inp('vencimento', p.vencimento || p.data, 'type="date" id="pgVenc"'))}
        <div class="f" style="justify-content:end"><span class="muted" id="pgResumo" style="font-size:13px;font-weight:800"></span></div>
      </div>
      ${field('Observações', `<textarea name="obs">${esc(p.obs)}</textarea>`, '')}
      <div class="note">As <b>contas a pagar</b> são lançadas assim que o pedido é salvo (ideal para pré-venda: o boleto pode vencer antes da mercadoria chegar). Ao marcar como <b>Recebido</b>, os produtos entram no estoque <b>em unidades</b> e o custo unitário do produto é atualizado.</div>`,
    onOpen: body => {
      const tb = $('#itensBody', body);
      const recalc = () => {
        let s = 0, un = 0;
        $$('tr', tb).forEach(tr => {
          const q = num($('[data-i=qtd]', tr).value), v = num($('[data-i=valor]', tr).value);
          const u = $('[data-i=un]', tr).value, f = u === 'UN' ? 1 : Math.max(0, num($('[data-i=fator]', tr).value));
          s += q * v; un += q * (f || 0);
          $('[data-i=sub]', tr).textContent = brl(q * v);
          $('[data-i=eq]', tr).textContent = u === 'UN' ? '' : (f ? `= ${qtdFmt(q * f)} un · ${brl(f ? v / f : 0)}/un` : 'informe unid. por emb.');
          $('[data-i=eq]', tr).classList.toggle('neg', u !== 'UN' && !f);
        });
        $('#tProd').textContent = brl(s);
        const total = s + num($('#pedFrete').value) - num($('#pedDesc').value);
        $('#tTotal').textContent = brl(total);
        $('#eqTotal').textContent = un ? `Entrada no estoque: ${qtdFmt(un)} unidade(s)` : '';
        const pix = $('#pgForma').value === 'Pix';
        $('#pgParc').disabled = pix; if (pix) $('#pgParc').value = 1;
        const n = Math.max(1, Math.floor(num($('#pgParc').value)) || 1);
        $('#pgResumo').textContent = total > 0 ? (n > 1 ? `${n}x de ${brl(total / n)}` : `1x de ${brl(total)}`) + ' em contas a pagar' : '';
      };
      tb.addEventListener('input', recalc);
      tb.addEventListener('change', e => {
        const tr = e.target.closest('tr');
        if (e.target.dataset.i === 'prod' && e.target.value === NOVO_PROD) { e.target.value = ''; abrirProduto(tr); return; }
        if (e.target.dataset.i === 'un') {
          const f = $('[data-i=fator]', tr), emb = e.target.value !== 'UN';
          f.disabled = !emb; f.placeholder = emb ? 'ex.: 12' : '—'; if (!emb) f.value = ''; else setTimeout(() => f.focus(), 30);
        }
        if (e.target.dataset.i === 'prod' || e.target.dataset.i === 'un' || e.target.dataset.i === 'fator') {
          const pr = produto($('[data-i=prod]', tr).value);
          const u = $('[data-i=un]', tr).value, f = u === 'UN' ? 1 : num($('[data-i=fator]', tr).value);
          if (pr && num(pr.custo) && f && (e.target.dataset.i === 'prod' || !num($('[data-i=valor]', tr).value))) $('[data-i=valor]', tr).value = dec(num(pr.custo) * f);
        }
        recalc();
      });
      tb.addEventListener('click', e => {
        const b = e.target.closest('[data-i=rm]');
        if (b) { if ($$('tr', tb).length > 1) b.closest('tr').remove(); else { $('select', b.closest('tr')).value = ''; } recalc(); }
      });
      $('#addItem', body).onclick = () => { tb.insertAdjacentHTML('beforeend', itemRowCompra({ qtd: 1, un: 'UN' })); recalc(); $('tr:last-child select', tb).focus(); };
      ['#pedFrete', '#pedDesc', '#pgParc'].forEach(s => $(s, body).oninput = recalc);
      $('#pgForma', body).onchange = recalc;

      // ---- fornecedor: busca + cadastro rápido
      const pnlC = $('#pnlContato', body);
      const picker = fornecedorPicker($('#acForn', body), texto => {
        $$('[data-nc]', pnlC).forEach(i => { if (i.tagName === 'INPUT') i.value = ''; });
        if (/\d{3,}/.test(texto) && soDig(texto).length >= 3) $('[data-nc=documento]', pnlC).value = texto; else $('[data-nc=nome]', pnlC).value = texto;
        pnlC.hidden = false;
        ligarDocumento($('[data-nc=documento]', pnlC), $('[data-nc=docStatus]', pnlC), k => $(`[data-nc=${k}]`, pnlC));
        setTimeout(() => $('[data-nc=documento]', pnlC).focus(), 50);
      });
      const salvarContato = () => {
        const d = lerPessoa(pnlC, 'nc');
        if (!d.nome) { toast('Informe o nome ou a razão social', 'err'); $('[data-nc=nome]', pnlC).focus(); return; }
        const t = tipoDoc(d.documento);
        if (t === 'cpf-invalido' || t === 'cnpj-invalido') { toast('CPF/CNPJ inválido', 'err'); return; }
        const c = { id: uid(), tipo: 'Fornecedor', ...d, obs: '', criadoEm: agora() };
        Store.commit([up('contatos', c)]);
        picker.escolher(c);
        pnlC.hidden = true;
        toast('Fornecedor cadastrado e selecionado', 'ok');
      };
      $('[data-nc-save]', pnlC).onclick = salvarContato;
      $('[data-nc-cancel]', pnlC).onclick = () => { pnlC.hidden = true; };
      pnlC.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvarContato(); } });

      // ---- produto: cadastro rápido
      const pnlP = $('#pnlProduto', body);
      let linhaAlvo = null;
      const abrirProduto = tr => {
        linhaAlvo = tr;
        $$('[data-np]', pnlP).forEach(i => { i.value = ''; });
        let n = Store.data.produtos.length + 1, sku;
        do { sku = 'CH' + String(n++).padStart(4, '0'); } while (Store.data.produtos.some(x => x.sku === sku));
        $('[data-np=sku]', pnlP).value = sku;
        pnlP.hidden = false; pnlP.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setTimeout(() => $('[data-np=nome]', pnlP).focus(), 50);
      };
      const salvarProduto = () => {
        const g = k => $(`[data-np=${k}]`, pnlP).value.trim();
        if (!g('nome')) { toast('Informe o nome do produto', 'err'); $('[data-np=nome]', pnlP).focus(); return; }
        if (g('sku') && Store.data.produtos.some(x => x.sku === g('sku'))) { toast('Já existe um produto com esse SKU', 'err'); return; }
        const pr = { id: uid(), sku: g('sku'), nome: g('nome'), categoria: g('categoria'), unidade: 'un', custo: r2(g('custo')), preco: r2(g('preco')), estoqueMin: num(g('estoqueMin')), ean: '', ncm: '', ativo: 'sim', criadoEm: agora() };
        Store.commit([up('produtos', pr)]);
        $$('[data-i=prod]', tb).forEach(s => { const v = s.value; s.innerHTML = prodOptionsPedido(v === NOVO_PROD ? '' : v); });
        let tr = linhaAlvo && tb.contains(linhaAlvo) ? linhaAlvo : $$('tr', tb).find(r => !$('[data-i=prod]', r).value);
        if (!tr) { tb.insertAdjacentHTML('beforeend', itemRowCompra({ qtd: 1, un: 'UN' })); tr = $('tr:last-child', tb); }
        $('[data-i=prod]', tr).value = pr.id;
        const u = $('[data-i=un]', tr).value, f = u === 'UN' ? 1 : num($('[data-i=fator]', tr).value);
        if (pr.custo && f) $('[data-i=valor]', tr).value = dec(pr.custo * f);
        pnlP.hidden = true; linhaAlvo = null; recalc();
        toast('Produto cadastrado e adicionado ao pedido', 'ok');
        setTimeout(() => $('[data-i=un]', tr).focus(), 50);
      };
      $('[data-np-save]', pnlP).onclick = salvarProduto;
      $('[data-np-cancel]', pnlP).onclick = () => { pnlP.hidden = true; linhaAlvo = null; };
      pnlP.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvarProduto(); } });
      $('#addProdNovo', body).onclick = () => abrirProduto(null);
      ligarMarkup($('[data-np=custo]', pnlP), $('[data-np=markup]', pnlP), $('[data-np=preco]', pnlP));
      recalc();
    },
    onSubmit: (fd, body) => {
      if (!$('#pnlProduto', body).hidden && $('[data-np=nome]', body).value.trim()) { toast('Termine o cadastro do produto (Salvar produto) ou clique em Cancelar', 'err'); return false; }
      if (!$('#pnlContato', body).hidden && $('[data-nc=nome]', body).value.trim()) { toast('Termine o cadastro do fornecedor (Salvar fornecedor) ou clique em Cancelar', 'err'); return false; }
      if (!fd.contatoId) { toast('Escolha um fornecedor na lista (digite 3 letras) ou cadastre um novo', 'err'); $('#acForn .ac-txt', body).focus(); return false; }
      const linhas = $$('#itensBody tr', body).map(tr => {
        const un = $('[data-i=un]', tr).value;
        return { produtoId: $('[data-i=prod]', tr).value, un, fator: un === 'UN' ? 1 : Math.floor(num($('[data-i=fator]', tr).value)), qtd: num($('[data-i=qtd]', tr).value), valor: r2($('[data-i=valor]', tr).value) };
      }).filter(i => i.produtoId && i.qtd > 0);
      if (!linhas.length) { toast('Adicione pelo menos um item com produto e quantidade', 'err'); return false; }
      const semFator = linhas.find(i => i.un !== 'UN' && !(i.fator > 0));
      if (semFator) { toast(`Informe quantas unidades vêm em cada ${UN_COMPRA.find(u => u[0] === semFator.un)[1].toLowerCase()} de “${nomeProduto(semFator.produtoId)}”`, 'err'); return false; }
      const total = r2(totalItens(linhas) + num(fd.frete) - num(fd.desconto));
      const formaPgto = fd.formaPgto || 'Boleto';
      const rec = {
        id: p.id || uid(),
        numero: novo ? String(proxNumero(Store.data.compras)) : p.numero,   // número definido só agora, ao salvar
        data: fd.data, previsao: p.previsao || '', status: fd.status, fornecedorId: fd.contatoId, itens: linhas,
        frete: r2(fd.frete), desconto: r2(fd.desconto), total, formaPgto,
        parcelas: formaPgto === 'Pix' ? 1 : Math.max(1, Math.floor(num(fd.parcelas)) || 1),
        vencimento: fd.vencimento || fd.data, obs: fd.obs, criadoEm: p.criadoEm || agora(),
        recebidoEm: fd.status === 'Recebido' ? (p.recebidoEm || hoje()) : '',
      };
      const fin = Store.data.pagar.filter(r => r.origemId === rec.id);
      if (fin.some(r => r.status === 'Pago') && (num(p.total) !== total || statusAnterior !== rec.status)) toast('Este pedido tem parcelas já pagas: as contas não foram refeitas. Ajuste no financeiro se necessário.');
      Store.commit([up('compras', rec), ...efeitosCompra(rec)]);
      toast(novo ? `Pedido de compra nº ${rec.numero} criado` : 'Pedido atualizado', 'ok');
    },
  });
}


function imprimirPedido(tipo, p) {
  const V = tipo === 'vendas';
  const c = contato(V ? p.clienteId : p.fornecedorId);
  const w = window.open('', '_blank');
  if (!w) return toast('Permita pop-ups para imprimir', 'err');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${V ? 'Pedido de venda' : 'Pedido de compra'} ${esc(p.numero)}</title>
  <style>body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:14px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}th{background:#0B3A8C;color:#FFD400}.r{text-align:right}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FFD400;padding-bottom:12px}.tot{margin-top:12px;text-align:right;font-size:16px}img{height:80px}</style></head><body>
  <div class="head"><img src="${new URL('logo.png', location.href)}"><div style="text-align:right"><h1>${V ? 'Pedido de venda' : 'Pedido de compra'} nº ${esc(p.numero)}</h1><div>Data: ${dataBR(p.data)} · Situação: ${esc(p.status)}</div></div></div>
  <p><b>${V ? 'Cliente' : 'Fornecedor'}:</b> ${esc(c?.nome || (V ? 'Consumidor final' : ''))}${c?.documento ? ' · ' + esc(c.documento) : ''}${c?.telefone ? ' · ' + esc(c.telefone) : ''}${c?.email ? ' · ' + esc(c.email) : ''}${c?.cidade ? '<br>' + esc(c.cidade) + (c.uf ? '/' + esc(c.uf) : '') : ''}</p>
  <table><thead><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead><tbody>
  ${p.itens.map(i => `<tr><td>${esc(produto(i.produtoId)?.sku || '')} ${esc(nomeProduto(i.produtoId))}${!V && i.un && i.un !== 'UN' ? ` <small>(${esc(i.un)} c/ ${esc(i.fator)} un)</small>` : ''}</td><td class="r">${qtdFmt(i.qtd)}${!V && i.un && i.un !== 'UN' ? ' ' + esc(i.un) : ''}</td><td class="r">${brl(i.valor)}</td><td class="r">${brl(num(i.qtd) * num(i.valor))}</td></tr>`).join('')}
  </tbody></table>
  <div class="tot">Produtos: ${brl(totalItens(p.itens))}<br>Frete: ${brl(p.frete)} · Desconto: ${brl(p.desconto)}<br><b>Total: ${brl(p.total)}</b></div>
  <p><b>Pagamento:</b> ${esc(p.formaPgto)} · ${esc(p.parcelas)}x · 1º venc. ${dataBR(p.vencimento)}</p>
  ${p.obs ? `<p><b>Obs.:</b> ${esc(p.obs)}</p>` : ''}
  <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
  w.document.close();
}

/* =========================================================
   CONTAS A PAGAR / RECEBER
   ========================================================= */
function viewContas(tipo) {
  const el = $('#view');
  const R = tipo === 'receber';
  const k = R ? 'Rec' : 'Pag';
  actions(`<button class="btn accent" id="novaConta">${ICON.plus}${R ? 'Nova conta a receber' : 'Nova conta a pagar'}</button>`);
  const q = UI['q' + k] || '';
  const st = UI['st' + k] ?? 'abertas';
  const mes = UI['m' + k] ?? '';
  const lista = Store.data[tipo]
    .filter(c => { const s = statusConta(c); return st === 'todas' || (st === 'abertas' ? s !== 'Pago' : st === 'vencidas' ? s === 'Vencido' : s === 'Pago'); })
    .filter(c => !mes || (c.vencimento || '').startsWith(mes))
    .filter(c => match(q, c.descricao, nomeContato(c.contatoId), c.categoria, c.obs))
    .sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
  const soma = f => lista.filter(f).reduce((s, c) => s + num(c.valor), 0);
  const tAb = soma(c => c.status !== 'Pago'), tPg = lista.filter(c => c.status === 'Pago').reduce((s, c) => s + num(c.valorPago || c.valor), 0), tVc = soma(c => statusConta(c) === 'Vencido');
  el.innerHTML = `
    <div class="kpis">
      <div class="card kpi ${R ? 'green' : 'red'}"><div class="lbl">Em aberto (filtro)</div><div class="val">${brl(tAb)}</div></div>
      <div class="card kpi red"><div class="lbl">Vencido (filtro)</div><div class="val">${brl(tVc)}</div></div>
      <div class="card kpi blue"><div class="lbl">${R ? 'Recebido' : 'Pago'} (filtro)</div><div class="val">${brl(tPg)}</div></div>
    </div>
    <div class="toolbar">
      ${searchBox('q' + k, q, 'Buscar por descrição, contato, categoria…')}
      <input type="month" id="m${k}" value="${esc(mes)}" title="Mês de vencimento">
      <div class="chips">${[['abertas', 'Em aberto'], ['vencidas', 'Vencidas'], ['pagas', R ? 'Recebidas' : 'Pagas'], ['todas', 'Todas']].map(([v, t]) => `<button class="chip ${st === v ? 'on' : ''}" data-st="${v}">${t}</button>`).join('')}</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Vencimento</th><th>Descrição</th><th>${R ? 'Cliente' : 'Fornecedor'}</th><th>Categoria</th><th class="r">Valor</th><th>Situação</th><th>${R ? 'Recebido em' : 'Pago em'}</th><th></th></tr></thead>
      <tbody>${lista.length ? lista.map(c => {
        const s = statusConta(c);
        return `<tr>
          <td class="${s === 'Vencido' ? 'neg strong' : ''}">${dataBR(c.vencimento)}</td>
          <td class="wrap strong">${esc(c.descricao)}</td>
          <td class="wrap">${esc(nomeContato(c.contatoId))}</td>
          <td class="muted">${esc(c.categoria)}</td>
          <td class="r strong">${brl(c.valor)}</td>
          <td><span class="badge ${s === 'Pago' ? 'green' : s === 'Vencido' ? 'red' : 'amber'}">${s === 'Pago' ? (R ? 'Recebido' : 'Pago') : s}</span></td>
          <td class="muted">${c.status === 'Pago' ? dataBR(c.pagoEm) + (num(c.valorPago) && num(c.valorPago) !== num(c.valor) ? ' · ' + brl(c.valorPago) : '') : ''}</td>
          <td class="act"><span class="inner">
            ${c.status === 'Pago' ? `<button class="btn ghost sm" data-estorno="${c.id}">${ICON.undo}Estornar</button>` : `<button class="btn ghost sm" data-baixa="${c.id}">${ICON.check}${R ? 'Receber' : 'Pagar'}</button>`}
            <button class="icon-btn" data-edit="${c.id}" title="Editar">${ICON.edit}</button>
            <button class="icon-btn del" data-del="${c.id}" title="Excluir">${ICON.del}</button></span></td>
        </tr>`;
      }).join('') : emptyRow(8, 'Nenhuma conta com esses filtros', '💰')}</tbody>
      ${lista.length ? `<tfoot><tr><td colspan="4">${lista.length} conta(s)</td><td class="r">${brl(soma(() => true))}</td><td colspan="3"></td></tr></tfoot>` : ''}
    </table></div>`;
  bindSearch('q' + k, 'q' + k);
  $('#m' + k).onchange = e => { UI['m' + k] = e.target.value; render(); };
  $$('[data-st]', el).forEach(b => b.onclick = () => { UI['st' + k] = b.dataset.st; render(); });
  const find = id => Store.data[tipo].find(c => c.id === id);
  $('#novaConta').onclick = () => formConta(tipo);
  $$('[data-edit]', el).forEach(b => b.onclick = () => formConta(tipo, find(b.dataset.edit)));
  $$('[data-baixa]', el).forEach(b => b.onclick = () => formBaixa(tipo, find(b.dataset.baixa)));
  $$('[data-estorno]', el).forEach(b => b.onclick = () => {
    const c = find(b.dataset.estorno);
    confirmar(`Estornar a baixa de <b>${esc(c.descricao)}</b>? Ela volta para “em aberto”.`, () => Store.commit([up(tipo, { ...c, status: 'Aberto', pagoEm: '', valorPago: '' })]), 'Estornar');
  });
  $$('[data-del]', el).forEach(b => b.onclick = () => {
    const c = find(b.dataset.del);
    confirmar(`Excluir a conta <b>${esc(c.descricao)}</b> (${brl(c.valor)})?${c.origemId ? '<div class="note warn">Esta conta foi gerada por um pedido. Se o pedido for salvo novamente, ela pode ser recriada.</div>' : ''}`, () => Store.commit([del(tipo, c.id)]), 'Excluir');
  });
}

function formConta(tipo, c) {
  const R = tipo === 'receber';
  const novo = !c;
  c = c || { vencimento: hoje(), categoria: R ? 'Vendas' : 'Fornecedores', status: 'Aberto' };
  const contatos = [...Store.data.contatos].sort((a, b) => a.nome.localeCompare(b.nome)).map(x => [x.id, x.nome]);
  Modal.open({
    title: novo ? (R ? 'Nova conta a receber' : 'Nova conta a pagar') : 'Editar conta',
    body: `<div class="grid g2">
      ${field('Descrição *', inp('descricao', c.descricao, 'required placeholder="Ex.: Aluguel setembro"'), 'span2')}
      ${field(R ? 'Cliente' : 'Fornecedor / favorecido', `<select name="contatoId">${opt(contatos, c.contatoId, '—')}</select>`)}
      ${field('Categoria', inp('categoria', c.categoria, 'list="dlCat"') + `<datalist id="dlCat">${(R ? CAT_RECEBER : CAT_PAGAR).map(x => `<option value="${x}">`).join('')}</datalist>`)}
      ${field('Valor (R$) *', inp('valor', dec(c.valor), 'inputmode="decimal" required placeholder="0,00"'))}
      ${field('Vencimento *', inp('vencimento', c.vencimento, 'type="date" required'))}
      ${novo ? field('Repetir (nº de meses)', inp('repetir', 1, 'type="number" min="1" max="60"')) : ''}
      ${novo ? field('Já está ' + (R ? 'recebida' : 'paga') + '?', `<select name="jaPago">${opt([['nao', 'Não'], ['sim', 'Sim, hoje']], 'nao')}</select>`) : ''}
      ${field('Observações', `<textarea name="obs">${esc(c.obs)}</textarea>`, 'span2')}
    </div>`,
    onSubmit: fd => {
      const valor = r2(fd.valor);
      if (valor <= 0) { toast('Informe um valor maior que zero', 'err'); return false; }
      const base = { ...c, descricao: fd.descricao.trim(), contatoId: fd.contatoId, categoria: fd.categoria.trim(), valor, vencimento: fd.vencimento, obs: fd.obs };
      if (!novo) { Store.commit([up(tipo, base)]); toast('Conta atualizada', 'ok'); return; }
      const n = Math.max(1, Math.floor(num(fd.repetir)) || 1);
      const ops = [];
      for (let i = 0; i < n; i++) {
        const pago = fd.jaPago === 'sim' && i === 0;
        ops.push(up(tipo, { ...base, id: uid(), descricao: base.descricao + (n > 1 ? ` (${i + 1}/${n})` : ''), vencimento: addMeses(fd.vencimento, i), status: pago ? 'Pago' : 'Aberto', pagoEm: pago ? hoje() : '', valorPago: pago ? valor : '', origem: 'manual', origemId: '', criadoEm: agora() }));
      }
      Store.commit(ops);
      toast(n > 1 ? `${n} contas lançadas` : 'Conta lançada', 'ok');
    },
  });
}

function formBaixa(tipo, c) {
  const R = tipo === 'receber';
  Modal.open({
    title: R ? 'Registrar recebimento' : 'Registrar pagamento', small: true, submit: R ? 'Confirmar recebimento' : 'Confirmar pagamento',
    body: `<p style="margin:0 0 14px;font-weight:800">${esc(c.descricao)}<br><span class="muted">Vencimento ${dataBR(c.vencimento)} · ${brl(c.valor)}</span></p>
      <div class="grid g2">
        ${field(R ? 'Recebido em' : 'Pago em', inp('pagoEm', hoje(), 'type="date" required'))}
        ${field('Valor (com juros/desconto)', inp('valorPago', dec(c.valor), 'inputmode="decimal" required'))}
      </div>`,
    onSubmit: fd => { Store.commit([up(tipo, { ...c, status: 'Pago', pagoEm: fd.pagoEm, valorPago: r2(fd.valorPago) })]); toast(R ? 'Recebimento registrado' : 'Pagamento registrado', 'ok'); },
  });
}

/* =========================================================
   CONTATOS
   ========================================================= */
function viewContatos(el, tipo) {
  const F = tipo === 'Fornecedor';
  const k = F ? 'Forn' : 'Cli';
  actions(`<button class="btn accent" id="novoCont">${ICON.plus}${F ? 'Novo fornecedor' : 'Novo cliente'}</button>`);
  const q = UI['q' + k] || '';
  const lista = Store.data.contatos.filter(c => c.tipo === tipo || c.tipo === 'Ambos')
    .filter(c => match(q, c.nome, c.documento, c.email, c.telefone, c.cidade)).sort((a, b) => a.nome.localeCompare(b.nome));
  // resumo de movimento por contato
  const mov = {};
  (F ? Store.data.compras : Store.data.vendas).filter(p => p.status !== 'Cancelado').forEach(p => {
    const id = F ? p.fornecedorId : p.clienteId; if (!id) return;
    mov[id] = mov[id] || { n: 0, t: 0, ult: '' }; mov[id].n++; mov[id].t += num(p.total); if ((p.data || '') > mov[id].ult) mov[id].ult = p.data;
  });
  el.innerHTML = `
    <div class="toolbar">${searchBox('q' + k, q, 'Buscar por nome, CPF/CNPJ, e-mail, telefone…')}</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nome</th><th>CPF / CNPJ</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th class="r">${F ? 'Compras' : 'Vendas'}</th><th class="r">Total</th><th>Última</th><th></th></tr></thead>
      <tbody>${lista.length ? lista.map(c => { const m = mov[c.id] || { n: 0, t: 0, ult: '' }; return `<tr>
        <td class="wrap strong">${esc(c.nome)} ${c.tipo === 'Ambos' ? '<span class="badge gray">cliente e fornecedor</span>' : ''}${c.fantasia ? `<br><span class="muted" style="font-weight:700;font-size:12.5px">${esc(c.fantasia)}</span>` : ''}</td>
        <td>${esc(c.documento)}</td><td>${c.telefone ? `<a href="https://wa.me/55${esc(String(c.telefone).replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c.telefone)}</a>` : ''}</td>
        <td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</td><td>${esc(c.cidade)}${c.uf ? '/' + esc(c.uf) : ''}</td>
        <td class="r">${m.n}</td><td class="r strong">${brl(m.t)}</td><td class="muted">${dataBR(m.ult)}</td>
        <td class="act"><span class="inner"><button class="icon-btn" data-edit="${c.id}" title="Editar">${ICON.edit}</button><button class="icon-btn del" data-del="${c.id}" title="Excluir">${ICON.del}</button></span></td>
      </tr>`; }).join('') : emptyRow(9, Store.data.contatos.length ? 'Nenhum resultado' : (F ? 'Nenhum fornecedor cadastrado' : 'Nenhum cliente cadastrado'), F ? '🏭' : '👥')}</tbody>
    </table></div>`;
  bindSearch('q' + k, 'q' + k);
  $('#novoCont').onclick = () => formContato(null, tipo);
  $$('[data-edit]', el).forEach(b => b.onclick = () => formContato(contato(b.dataset.edit)));
  $$('[data-del]', el).forEach(b => b.onclick = () => {
    const c = contato(b.dataset.del);
    const usado = Store.data.vendas.some(v => v.clienteId === c.id) || Store.data.compras.some(v => v.fornecedorId === c.id) || [...Store.data.pagar, ...Store.data.receber].some(x => x.contatoId === c.id);
    if (usado) return toast('Este cadastro está em pedidos ou contas e não pode ser excluído.', 'err');
    confirmar(`Excluir <b>${esc(c.nome)}</b>?`, () => Store.commit([del('contatos', c.id)]), 'Excluir');
  });
}

function formContato(c, tipo = 'Cliente') {
  const novo = !c;
  c = c || { tipo };
  const nomeTipo = c.tipo === 'Fornecedor' ? 'fornecedor' : c.tipo === 'Ambos' ? 'cadastro' : 'cliente';
  Modal.open({
    title: novo ? 'Novo ' + nomeTipo : 'Editar ' + nomeTipo,
    body: `
      <input type="hidden" name="tipo" value="${esc(c.tipo)}">
      ${camposPessoa('pc', c)}
      <div style="margin-top:14px">${field('Observações', `<textarea name="obs">${esc(c.obs)}</textarea>`)}</div>`,
    onOpen: body => ligarDocumento($('[data-pc=documento]', body), $('[data-pc=docStatus]', body), k => $(`[data-pc=${k}]`, body), c.id),
    onSubmit: (fd, body) => {
      const d = lerPessoa(body, 'pc');
      if (!d.nome) { toast('Informe o nome ou a razão social', 'err'); $('[data-pc=nome]', body).focus(); return false; }
      const t = tipoDoc(d.documento);
      if (t === 'cpf-invalido' || t === 'cnpj-invalido') { toast('CPF/CNPJ inválido — confira os números', 'err'); return false; }
      Store.commit([up('contatos', { ...c, ...d, id: c.id || uid(), tipo: fd.tipo, obs: fd.obs, criadoEm: c.criadoEm || agora() })]);
      toast(novo ? 'Cadastro salvo' : 'Cadastro atualizado', 'ok');
    },
  });
}

/* =========================================================
   CONFIGURAÇÕES — backup automático
   ========================================================= */
const LS_SNAP = 'cheel_erp_snapshots_v1';
function snapshotsLocais() { try { return JSON.parse(localStorage.getItem(LS_SNAP) || '[]'); } catch (e) { return []; } }
/* Guarda 1 cópia por dia neste aparelho (últimos 7 dias) */
function backupLocalDiario(forcar) {
  const temDados = Object.values(Store.data).some(l => l.length);
  if (!temDados) return false;
  let snaps = snapshotsLocais();
  const dia = hoje();
  if (!forcar && snaps.some(s => s.dia === dia)) return false;
  snaps = snaps.filter(s => s.dia !== dia);
  snaps.unshift({ dia, em: agora(), dados: Store.data });
  snaps = snaps.slice(0, 7);
  for (let n = snaps.length; n > 0; n--) {
    try { localStorage.setItem(LS_SNAP, JSON.stringify(snaps.slice(0, n))); return true; } catch (e) { /* sem espaço: guarda menos dias */ }
  }
  return false;
}
async function backupAutomatico() {
  backupLocalDiario();
  if (Store.online) { try { await Store.api({ action: 'backupAuto' }); } catch (e) { /* script antigo ou sem internet: tenta de novo no próximo login */ } }
}

function viewConfig(el) {
  const snaps = snapshotsLocais();
  const total = Object.values(Store.data).reduce((s, l) => s + l.length, 0);
  el.innerHTML = `
    <div class="card" style="max-width:860px">
      <h3>${ICON.sync} Backup automático</h3>
      ${Store.online ? `
        <p class="muted" style="margin:0 0 14px;font-weight:700">Todo dia o sistema salva uma <b>cópia completa da planilha</b> no Google Drive da conta da loja, na pasta <b>“Cheel Out Shop — Backups do ERP”</b>. Ficam guardados os <b>últimos 30 dias</b>.</p>
        <div id="bkDrive" class="note">Consultando backups no Google Drive…</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
          <button class="btn primary" id="bkAgora">${ICON.sync}Fazer backup agora</button>
          <a class="btn ghost" id="bkPasta" href="https://drive.google.com/drive/search?q=Cheel%20Out%20Shop%20%E2%80%94%20Backups%20do%20ERP" target="_blank" rel="noopener">Abrir pasta no Google Drive</a>
        </div>` : `
        <div class="note warn">O sistema está em <b>modo local</b>: os dados ficam só neste navegador. Enquanto a planilha do Google não estiver conectada, o backup automático é guardado apenas aqui.</div>`}
      <div class="section-t">Cópias guardadas neste aparelho (últimos 7 dias)</div>
      ${snaps.length ? `<ul class="list">${snaps.map((s, i) => `<li><span class="l">${dataBR(s.dia)}<span class="s">${Object.values(s.dados || {}).reduce((a, l) => a + (l?.length || 0), 0)} registros · salvo às ${new Date(s.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></span><button class="btn ghost sm" data-snap="${i}">${ICON.down}Baixar</button></li>`).join('')}</ul>`
        : `<div class="empty" style="padding:24px">${total ? 'A primeira cópia será feita no próximo login.' : 'Nenhum dado lançado ainda.'}</div>`}
    </div>`;
  $$('[data-snap]', el).forEach(b => b.onclick = () => { const s = snaps[+b.dataset.snap]; baixar(`cheeloutshop-backup-${s.dia}.json`, JSON.stringify(s.dados, null, 2), 'application/json'); });
  if (!Store.online) return;
  const box = $('#bkDrive', el);
  const mostrar = info => {
    if (!info) return;
    if (info.pastaUrl) $('#bkPasta', el).href = info.pastaUrl;
    box.innerHTML = info.arquivos && info.arquivos.length
      ? `<b>Último backup:</b> ${new Date(info.arquivos[0].data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${info.arquivos.length} cópia(s) guardada(s)
         <ul class="list" style="margin-top:8px">${info.arquivos.slice(0, 7).map(a => `<li><span class="l">${esc(a.nome)}</span><a class="btn ghost sm" href="${esc(a.url)}" target="_blank" rel="noopener">Abrir</a></li>`).join('')}</ul>`
      : 'Nenhum backup no Google Drive ainda. O primeiro é feito automaticamente hoje.';
  };
  Store.api({ action: 'backupList' }).then(mostrar).catch(e => {
    box.className = 'note warn';
    box.innerHTML = /desconhecida/i.test(e.message) ? 'Para ativar o backup no Google Drive, atualize o script da planilha (veja o README, passo “Atualizar o script”).' : 'Não consegui consultar os backups: ' + esc(e.message);
    $('#bkAgora', el).disabled = true;
  });
  $('#bkAgora', el).onclick = async ev => {
    const b = ev.currentTarget; b.disabled = true; const t = b.innerHTML; b.textContent = 'Salvando cópia…';
    try { await Store.api({ action: 'backupNow' }); backupLocalDiario(true); toast('Backup salvo no Google Drive', 'ok'); mostrar(await Store.api({ action: 'backupList' })); }
    catch (e) { toast('Falhou: ' + e.message, 'err'); }
    b.disabled = false; b.innerHTML = t;
  };
}

function viewConfigAvancado(el) {
  const cfg = Store.cfg;
  const qtd = Object.entries(Store.data).map(([k, v]) => `${k}: ${v.length}`).join(' · ');
  el.innerHTML = `
    <div class="two even">
      <div class="card">
        <h3>Conexão com o Google Sheets</h3>
        <div class="grid">
          ${field('URL do App da Web (Apps Script)', `<input id="cfgUrl" value="${esc(cfg.url)}" placeholder="https://script.google.com/macros/s/…/exec">`)}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" id="cfgSalvar">Salvar conexão</button>
            <button class="btn ghost" id="cfgTestar">Testar</button>
            ${cfg.url ? '<button class="btn danger" id="cfgDesc">Usar modo local</button>' : ''}
          </div>
          <div class="note">${Store.online ? `Conectado. Os dados são lidos e gravados na planilha. ${Store.queue.length ? `<b>${Store.queue.length} alteração(ões) aguardando envio.</b>` : ''}` : 'Modo local: os dados ficam salvos apenas neste navegador. Para usar a planilha, cole a URL do Apps Script acima (ou no arquivo <code class="code">config.js</code>).'}</div>
          ${Store.online ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="cfgRecarregar">${ICON.sync}Recarregar da planilha</button><button class="btn ghost" id="cfgEnviar">Enviar dados deste navegador para a planilha</button></div>` : ''}
        </div>
      </div>
      <div class="card">
        <h3>Acesso</h3>
        <div class="email-fixed" style="margin-bottom:14px"><span class="avatar">${esc((Auth.sess?.email || 'c')[0].toUpperCase())}</span>${esc(Auth.sess?.email || '')}</div>
        <form id="trocaSenha" class="grid" autocomplete="off">
          <div class="grid g2">
            ${field('Senha atual', '<input type="password" name="atual" required autocomplete="current-password">', 'span2')}
            ${field('Nova senha', '<input type="password" name="nova" required minlength="8" autocomplete="new-password">')}
            ${field('Confirmar nova senha', '<input type="password" name="conf" required autocomplete="new-password">')}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" type="submit">Trocar senha</button><button class="btn ghost" type="button" id="cfgSair">Sair do sistema</button></div>
        </form>
      </div>
    </div>
    <div class="two even">
      <div class="card">
        <h3>Backup</h3>
        <p class="muted" style="margin-top:0;font-weight:700">${qtd}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" id="bkExport">${ICON.down}Exportar backup (.json)</button>
          <label class="btn ghost" style="cursor:pointer">Importar backup<input type="file" id="bkImport" accept=".json,application/json" hidden></label>
          <button class="btn ghost" id="bkCsv">${ICON.down}Exportar produtos (.csv)</button>
        </div>
      </div>
      <div class="card">
        <h3>Dados de exemplo</h3>
        <p class="muted" style="margin-top:0;font-weight:700">Crie alguns produtos, contatos e pedidos para testar o sistema. Use só em uma base vazia.</p>
        <button class="btn ghost" id="demo">Carregar dados de exemplo</button>
        <button class="btn danger" id="zerar">Apagar todos os dados</button>
      </div>
    </div>`;

  const urlCampo = () => $('#cfgUrl').value.trim();
  $('#cfgTestar').onclick = async () => {
    const tmp = Store.cfg.url; Store.cfg.url = urlCampo();
    try { if (!Store.cfg.url) throw new Error('Informe a URL'); await Store.api({ action: 'ping' }); toast('Conexão OK com o Apps Script', 'ok'); }
    catch (e) { toast('Falhou: ' + e.message, 'err'); }
    Store.cfg.url = tmp;
  };
  $('#cfgSalvar').onclick = async () => {
    const url = urlCampo();
    if (!url) return toast('Informe a URL', 'err');
    const tmp = Store.cfg.url; Store.cfg.url = url;
    try { await Store.api({ action: 'ping' }); } catch (e) { Store.cfg.url = tmp; return toast('Não conectou: ' + e.message, 'err'); }
    Store.cfg.url = tmp;
    trocarConexao(url);
  };
  $('#cfgDesc') && ($('#cfgDesc').onclick = () => confirmar('Passar a usar o modo local (dados só neste navegador)? Os dados da planilha continuam guardados nela.', () => trocarConexao(''), 'Usar modo local'));
  $('#cfgSair').onclick = () => Auth.logout();
  $('#trocaSenha').onsubmit = async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    if (fd.nova.length < 8) return toast('A nova senha precisa ter pelo menos 8 caracteres', 'err');
    if (fd.nova !== fd.conf) return toast('As senhas novas não conferem', 'err');
    try { await Auth.trocarSenha(fd.atual, fd.nova); e.target.reset(); toast('Senha alterada', 'ok'); }
    catch (err) { toast(err.message, 'err'); }
  };
  $('#cfgRecarregar') && ($('#cfgRecarregar').onclick = async () => { await Store.load(); render(); toast('Dados recarregados', 'ok'); });
  $('#cfgEnviar') && ($('#cfgEnviar').onclick = () => confirmar('Enviar todos os registros deste navegador para a planilha? Registros com o mesmo ID serão sobrescritos.', async () => { await enviarTudo(); toast('Dados enviados', 'ok'); render(); }, 'Enviar'));

  $('#bkExport').onclick = () => baixar(`cheeloutshop-backup-${hoje()}.json`, JSON.stringify(Store.data, null, 2), 'application/json');
  $('#bkCsv').onclick = () => {
    const sal = saldos();
    const linhas = [['SKU', 'Nome', 'Categoria', 'Unidade', 'Custo', 'Preço', 'Estoque', 'Estoque mínimo', 'EAN', 'NCM', 'Ativo']]
      .concat(Store.data.produtos.map(p => [p.sku, p.nome, p.categoria, p.unidade, r2(p.custo), r2(p.preco), sal[p.id] || 0, p.estoqueMin, p.ean, p.ncm, p.ativo]));
    baixar(`produtos-${hoje()}.csv`, '﻿' + linhas.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
  };
  $('#bkImport').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.produtos)) throw new Error('Arquivo não parece um backup do ERP');
        confirmar('Importar este backup? Os registros serão adicionados/atualizados (por ID).', async () => {
          const ops = [];
          for (const k of Object.keys(COLS)) (d[k] || []).forEach(r => r.id && ops.push(up(k, Store.normalize(k, r))));
          await Store.commit(ops);
          toast(`${ops.length} registros importados`, 'ok');
        }, 'Importar');
      } catch (err) { toast('Erro: ' + err.message, 'err'); }
    };
    rd.readAsText(f);
  };
  $('#demo').onclick = () => {
    if (Store.data.produtos.length) return toast('Já existem produtos cadastrados. Use em uma base vazia.', 'err');
    confirmar('Carregar dados de exemplo?', () => Store.commit(dadosDemo()).then(() => toast('Dados de exemplo carregados', 'ok')), 'Carregar');
  };
  $('#zerar').onclick = () => confirmar('<b>Apagar TODOS os dados</b>' + (Store.online ? ' (inclusive da planilha)' : ' deste navegador') + '? Faça um backup antes. Esta ação não pode ser desfeita.', () => {
    const ops = [];
    for (const k of Object.keys(COLS)) Store.data[k].forEach(r => ops.push(del(k, r.id)));
    return Store.commit(ops).then(() => toast('Dados apagados', 'ok'));
  }, 'Apagar tudo');
}

async function enviarTudo() {
  const ops = [];
  for (const k of Object.keys(COLS)) Store.data[k].forEach(r => ops.push(up(k, r)));
  Store.queue.push(...ops);
  Store.saveCache();
  await Store.flush();
}

function baixar(nome, conteudo, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function dadosDemo() {
  const t = agora();
  const P = [
    ['CH0001', 'Camiseta Oversized Preta', 'Camisetas', 39.9, 89.9, 5],
    ['CH0002', 'Camiseta Oversized Branca', 'Camisetas', 39.9, 89.9, 5],
    ['CH0003', 'Moletom Canguru Azul', 'Moletons', 79.9, 169.9, 3],
    ['CH0004', 'Boné Aba Curva Amarelo', 'Acessórios', 22.5, 59.9, 4],
    ['CH0005', 'Meia Cano Alto (kit 3)', 'Acessórios', 12.0, 34.9, 10],
    ['CH0006', 'Bermuda Moletom Cinza', 'Bermudas', 45.0, 99.9, 3],
  ].map(([sku, nome, categoria, custo, preco, min]) => ({ id: uid(), sku, nome, categoria, unidade: 'un', custo, preco, estoqueMin: min, ean: '', ncm: '', ativo: 'sim', criadoEm: t }));
  const forn = { id: uid(), tipo: 'Fornecedor', nome: 'Malharia Exemplo Ltda', documento: '00.000.000/0001-00', telefone: '(11) 99999-0000', email: 'contato@exemplo.com', cidade: 'São Paulo', uf: 'SP', criadoEm: t };
  const cli = { id: uid(), tipo: 'Cliente', nome: 'Cliente Exemplo', documento: '', telefone: '(11) 98888-0000', email: '', cidade: 'São Paulo', uf: 'SP', criadoEm: t };
  const ops = [...P.map(p => up('produtos', p)), up('contatos', forn), up('contatos', cli)];
  Store.apply(ops);
  const d0 = addDias(hoje(), -20);
  const compra = { id: uid(), numero: '1', data: d0, fornecedorId: forn.id, status: 'Recebido', itens: P.map(p => ({ produtoId: p.id, qtd: 20, valor: p.custo })), frete: 50, desconto: 0, formaPgto: 'Boleto', parcelas: 2, vencimento: addDias(d0, 30), obs: '', criadoEm: t };
  compra.total = r2(totalItens(compra.itens) + 50);
  const efC = [up('compras', compra), ...efeitosCompra(compra)];
  Store.apply(efC); ops.push(...efC);
  const vendas = [
    { canal: 'Instagram / WhatsApp', itens: [{ produtoId: P[0].id, qtd: 2, valor: 89.9 }, { produtoId: P[3].id, qtd: 1, valor: 59.9 }], formaPgto: 'Pix', parcelas: 1, dias: -10 },
    { canal: 'Loja física', itens: [{ produtoId: P[2].id, qtd: 1, valor: 169.9 }], formaPgto: 'Cartão de crédito', parcelas: 3, dias: -3 },
    { canal: 'Shopee', itens: [{ produtoId: P[4].id, qtd: 4, valor: 34.9 }], formaPgto: 'Marketplace', parcelas: 1, dias: -1 },
  ].map((v, i) => {
    const data = addDias(hoje(), v.dias);
    const rec = { id: uid(), numero: String(i + 1), data, clienteId: cli.id, canal: v.canal, status: 'Atendido', itens: v.itens, frete: 0, desconto: 0, formaPgto: v.formaPgto, parcelas: v.parcelas, vencimento: v.formaPgto === 'Pix' ? data : addDias(data, 30), obs: '', criadoEm: t };
    rec.total = totalItens(rec.itens);
    return rec;
  });
  for (const v of vendas) { const ef = [up('vendas', v), ...efeitosVenda(v)]; Store.apply(ef); ops.push(...ef); }
  ops.push(up('pagar', { id: uid(), descricao: 'Aluguel da loja', contatoId: '', categoria: 'Aluguel', vencimento: addDias(hoje(), 5), valor: 1800, status: 'Aberto', pagoEm: '', valorPago: '', origem: 'manual', origemId: '', obs: '', criadoEm: t }));
  return ops; // commit reaplica (upsert é idempotente) e envia para a planilha
}

/* =========================================================
   LOGIN / ACESSO
   ========================================================= */
const b64e = u8 => btoa(String.fromCharCode(...u8));
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function pbkdf2(senha, saltB64) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: b64d(saltB64), iterations: 150000 }, key, 256);
  return b64e(new Uint8Array(bits));
}
const normEmail = e => String(e || '').trim().toLowerCase();

const Auth = {
  sess: null,
  get token() { return this.sess?.token || ''; },
  get modo() { return Store.online ? 'online' : 'local'; },

  init() {
    try { this.sess = JSON.parse(localStorage.getItem(LS_SESSION) || sessionStorage.getItem(LS_SESSION) || 'null'); } catch (e) { this.sess = null; }
    if (this.sess && (Date.now() > num(this.sess.exp) || this.sess.modo !== this.modo || (this.sess.modo === 'online' && this.sess.url !== Store.cfg.url))) this.limpar();
    $('#ano').textContent = new Date().getFullYear();
    if (this.sess) this.entrar(); else this.mostrarLogin('login');
  },
  salvar(s, lembrar) {
    this.sess = { ...s, email: normEmail(s.email), modo: this.modo, url: Store.cfg.url };
    try {
      localStorage.removeItem(LS_SESSION); sessionStorage.removeItem(LS_SESSION);
      (lembrar ? localStorage : sessionStorage).setItem(LS_SESSION, JSON.stringify(this.sess));
    } catch (e) {}
  },
  limpar() {
    this.sess = null;
    try { localStorage.removeItem(LS_SESSION); sessionStorage.removeItem(LS_SESSION); } catch (e) {}
  },

  /* ---- usuários do modo local ---- */
  locais() { try { return JSON.parse(localStorage.getItem(LS_USERS) || '{}'); } catch (e) { return {}; } },
  gravarLocal(email, reg) { const u = this.locais(); if (reg) u[email] = reg; else delete u[email]; localStorage.setItem(LS_USERS, JSON.stringify(u)); },
  checarEmail(email) { if (normEmail(email) !== EMAIL_PADRAO) throw new Error('E-mail não autorizado a acessar este sistema.'); },
  checarSenha(s) { if (String(s).length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.'); },
  expLocal(lembrar) { return Date.now() + (lembrar ? 30 * 864e5 : 12 * 36e5); },

  async login(email, senha, lembrar) {
    email = normEmail(email);
    if (Store.online) {
      const r = await Store.api({ action: 'login', email, senha, lembrar });
      this.salvar(r, lembrar);
    } else {
      this.checarEmail(email);
      const u = this.locais()[email];
      if (!u) throw new Error('Este e-mail ainda não tem acesso. Clique em "Criar novo acesso".');
      if (await pbkdf2(senha, u.salt) !== u.hash) throw new Error('E-mail ou senha incorretos.');
      this.salvar({ email, exp: this.expLocal(lembrar) }, lembrar);
    }
  },
  async registrar(email, senha, lembrar) {
    email = normEmail(email);
    this.checarSenha(senha);
    if (Store.online) {
      const r = await Store.api({ action: 'register', email, senha, lembrar });
      this.salvar(r, lembrar);
    } else {
      this.checarEmail(email);
      if (this.locais()[email]) throw new Error('Este e-mail já tem acesso cadastrado. Use "Entrar" ou "Esqueci minha senha".');
      const salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
      this.gravarLocal(email, { salt, hash: await pbkdf2(senha, salt), criadoEm: agora() });
      this.salvar({ email, exp: this.expLocal(lembrar) }, lembrar);
    }
  },
  async trocarSenha(atual, nova) {
    this.checarSenha(nova);
    if (Store.online) return Store.api({ action: 'changePassword', atual, nova });
    const email = this.sess.email, u = this.locais()[email];
    if (!u || await pbkdf2(atual, u.salt) !== u.hash) throw new Error('Senha atual incorreta.');
    const salt = b64e(crypto.getRandomValues(new Uint8Array(16)));
    this.gravarLocal(email, { ...u, salt, hash: await pbkdf2(nova, salt) });
  },

  entrar() {
    document.body.classList.remove('locked');
    $('#userMail').textContent = this.sess.email;
    $('#appVer').textContent = `Versão ${APP_VERSAO} · ${APP_DATA_VERSAO}`;
    $('.user-chip .avatar').textContent = this.sess.email[0].toUpperCase();
    setSync(Store.online ? 'sync' : 'local');
    render();
    Store.load().then(async () => {
      render();
      await migrarLocal();
      setTimeout(backupAutomatico, 20000);   // depois que tudo carregou, sem disputar com o uso
    });
  },
  async logout() {
    if (Store.online && Store.queue.length) {
      const ok = await Store.flush();
      if (!ok && !window.confirm('Há alterações que ainda não foram enviadas para a planilha. Elas ficam guardadas neste navegador e serão enviadas no próximo login. Sair mesmo assim?')) return;
    }
    if (Store.online) {
      Store.api({ action: 'logout' }).catch(() => {});
      // não deixa cópia dos dados no computador depois de sair (exceto pendências)
      if (!Store.queue.length) { for (const k of Object.keys(COLS)) Store.data[k] = []; Store.saveCache(); }
    }
    this.limpar();
    this.mostrarLogin('login');
  },
  expirou() {
    if (!this.sess) return;
    this.limpar();
    this.mostrarLogin('login', 'Sua sessão expirou. Entre novamente.');
  },

  /* ---- telas ---- */
  mostrarLogin(tela, aviso) {
    $('#modal').open && Modal.close();
    document.body.classList.add('locked');
    document.body.classList.remove('menu-open');
    renderAuth(tela, aviso);
  },
};

/* ---------- Animação de entrada: logo voa até o centro, explode e lança cartas ---------- */
const CARD_TIPOS = [
  ['t-fire', 'M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-1-3 2 1 4 3.5 4 6.5A6 6 0 0 1 6 14.5C6 9 12 7 12 2z'],
  ['t-water', 'M12 2s-6 7-6 12a6 6 0 0 0 12 0c0-5-6-12-6-12z'],
  ['t-grass', 'M20 4C9 4 4 9 4 16c0 1.5.3 3 1 4 1-5 5-9 10-10-4 2-7 5-8 10 9 0 13-6 13-16z'],
  ['t-electric', 'M13 2 4 14h6l-2 8 10-13h-6l1-7z'],
  ['t-psychic', 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z'],
];
const NOMES_CARTA = ['Cheel', 'Out', 'Shop', 'Mega', 'Turbo', 'Ultra', 'Flash', 'Max'];

function cartaHTML(i) {
  const [cls, d] = CARD_TIPOS[i % CARD_TIPOS.length];
  return `<div class="tc-inner">
    <div class="tc-face tc-front ${cls}"><div class="tc-body">
      <div class="tc-top"><span>${NOMES_CARTA[i % NOMES_CARTA.length]}</span><b>${(i * 37 % 9 + 6) * 10}</b></div>
      <div class="tc-art"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></div>
      <div class="tc-lines"><i></i><i></i><i></i></div>
    </div><div class="tc-holo"></div></div>
    <div class="tc-face tc-back"><svg viewBox="0 0 48 48"><use href="#mark"/></svg></div>
  </div>`;
}

function animarEntrada(depois) {
  const intro = $('#intro'), fly = $('#flyLogo'), img = $('img', fly), bg = $('#introBg');
  const reduz = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const A = (el, kf, o) => el.animate(kf, { fill: 'both', ...o });
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ponto de partida: a logo onde ela está na tela de login
  const origem = [$('.hero-logo'), $('img.auth-mobile-brand')].find(e => e && e.offsetParent !== null);
  const vw = innerWidth, vh = innerHeight;
  const alvoW = Math.min(480, vw * 0.72, vh * 0.62 * 1.24);
  let r = origem ? origem.getBoundingClientRect() : null;
  if (!r || !r.width) r = { left: vw / 2 - alvoW / 4, top: vh / 2 - alvoW / 5, width: alvoW / 2, height: alvoW / 2.47 };
  // a logo é desenhada já no tamanho final (nitidez) e começa "encolhida" no lugar de origem
  const alvoH = alvoW * (r.height / r.width);
  Object.assign(fly.style, { left: (vw - alvoW) / 2 + 'px', top: (vh - alvoH) / 2 + 'px', width: alvoW + 'px' });
  const dx = (r.left + r.width / 2) - vw / 2, dy = (r.top + r.height / 2) - vh / 2, s0 = r.width / alvoW;

  // limpa execuções anteriores
  intro.getAnimations({ subtree: true }).forEach(a => a.cancel());
  $('#fxCards').innerHTML = ''; $('#fxSparks').innerHTML = '';
  intro.classList.add('on');
  if (origem) origem.style.visibility = 'hidden';
  const fim = () => { intro.classList.remove('on'); if (origem) origem.style.visibility = ''; $('#fxCards').innerHTML = ''; $('#fxSparks').innerHTML = ''; };

  if (reduz) {
    A(bg, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 500 });
    fly.style.opacity = 0;
    setTimeout(depois, 200); setTimeout(fim, 520);
    return;
  }
  fly.style.opacity = '';
  // espera 2 quadros para o navegador preparar as camadas antes de começar a mexer (evita o "tranco" inicial)
  fly.style.transform = `translate(${dx}px,${dy}px) scale(${s0})`;  // já nasce exatamente sobre a logo original
  requestAnimationFrame(() => requestAnimationFrame(() => rodarTimeline()));
  function rodarTimeline() {

  const T_HIT = 720;   // momento da explosão
  const T_OUT = 2100;  // início da saída

  // 1) fundo escurece
  A(bg, [{ opacity: 0 }, { opacity: 1 }], { duration: 520, easing: 'ease-out' });

  // 2) logo sai do canto e voa até o centro (antecipação + overshoot)
  A(fly, [
    { transform: `translate(${dx}px,${dy}px) scale(${s0}) rotate(0deg)`, offset: 0 },
    { transform: `translate(${dx}px,${dy + 6}px) scale(${s0 * .94}) rotate(2deg)`, offset: .12 },
    { transform: 'translate(0,0) scale(1.08) rotate(-4deg)', offset: .82 },
    { transform: 'translate(0,0) scale(1) rotate(0deg)', offset: 1 },
  ], { duration: T_HIT, easing: 'cubic-bezier(.55,0,.25,1)' });

  // 3) impacto: logo "pulsa" e brilha
  A(img, [
    { transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: .18 }, { transform: 'scale(.97)', offset: .45 },
    { transform: 'scale(1.02)', offset: .7 }, { transform: 'scale(1)' },
  ], { duration: 700, delay: T_HIT, easing: 'ease-out', fill: 'none' });
  A($('#flyGlow'), [
    { opacity: 0, transform: 'translate(-50%,-50%) scale(.42)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(.84)', offset: .15 },
    { opacity: .35, transform: 'translate(-50%,-50%) scale(.92)', offset: .6 },
    { opacity: 0, transform: 'translate(-50%,-50%) scale(1)' },
  ], { duration: 1100, delay: T_HIT, easing: 'ease-out' });

  // tremida de câmera
  A($('#fx'), [0, 1, 2, 3, 4, 5, 6].map(i => ({ transform: i === 6 ? 'translate(0,0)' : `translate(${rnd(-9, 9)}px,${rnd(-7, 7)}px)` })), { duration: 320, delay: T_HIT, fill: 'none' });

  // 4) explosão: núcleo de luz, ondas de choque e raios
  A($('#fxCore'), [{ opacity: 0, transform: 'scale(.06)' }, { opacity: 1, transform: 'scale(.34)', offset: .15 }, { opacity: 0, transform: 'scale(1)' }], { duration: 650, delay: T_HIT, easing: 'cubic-bezier(.2,.8,.3,1)' });
  A($('#fxRing1'), [{ opacity: 0, transform: 'scale(.07)' }, { opacity: 1, offset: .1 }, { opacity: 0, transform: 'scale(1)' }], { duration: 750, delay: T_HIT, easing: 'cubic-bezier(.1,.7,.3,1)' });
  A($('#fxRing2'), [{ opacity: 0, transform: 'scale(.07)' }, { opacity: .9, offset: .1 }, { opacity: 0, transform: 'scale(.8)' }], { duration: 850, delay: T_HIT + 110, easing: 'cubic-bezier(.1,.7,.3,1)' });
  A($('#fxRays'), [{ opacity: 0, transform: 'rotate(0deg) scale(1)' }, { opacity: 1, transform: 'rotate(12deg) scale(1.65)', offset: .2 }, { opacity: .7, offset: .7 }, { opacity: 0, transform: 'rotate(40deg) scale(1.85)' }], { duration: T_OUT - T_HIT + 300, delay: T_HIT, easing: 'ease-out' });

  // aparelhos mais simples recebem menos elementos
  const leve = (navigator.hardwareConcurrency || 8) <= 4 || vw < 700;

  // faíscas
  const sparks = $('#fxSparks');
  for (let i = 0; i < (leve ? 18 : 30); i++) {
    const sp = document.createElement('i');
    sp.className = 'spark' + (i % 3 === 0 ? ' long' : '');
    sparks.appendChild(sp);
    const ang = rnd(0, Math.PI * 2), dist = rnd(140, Math.max(vw, vh) * 0.45);
    const rot = ang * 180 / Math.PI;
    A(sp, [
      { transform: `rotate(${rot}deg) translate(0,0) scale(1)`, opacity: 1 },
      { transform: `rotate(${rot}deg) translate(${dist}px,0) scale(.2)`, opacity: 0 },
    ], { duration: rnd(500, 900), delay: T_HIT + rnd(0, 80), easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' });
  }

  // 5) cartas lançadas de trás da logo
  const cards = $('#fxCards');
  const cardW = Math.max(110, Math.min(160, vw * 0.112));
  const N = leve ? 12 : 16;
  for (let i = 0; i < N; i++) {
    const c = document.createElement('div');
    c.className = 'tcard';
    c.innerHTML = cartaHTML(i);
    cards.appendChild(c);
    const w = cardW, h = w * 1.4;
    c.style.marginLeft = -w / 2 + 'px'; c.style.marginTop = -h / 2 + 'px';
    // leque: espalha por 360°, com leve preferência para cima
    const ang = (i / N) * Math.PI * 2 + rnd(-.18, .18) - Math.PI / 2;
    const dist = Math.max(vw, vh) * rnd(.62, .85);
    const ex = Math.cos(ang) * dist, ey = Math.sin(ang) * dist * .9;
    const mx = ex * .42, my = ey * .42 - rnd(40, 110);      // arco
    const rz = rnd(-260, 260), ry = (Math.random() < .5 ? -1 : 1) * rnd(360, 720);
    const dur = rnd(1250, 1650), delay = T_HIT + 30 + i * 18;
    A(c, [
      { transform: 'translate(0,0) rotate(0deg) scale(.2)', opacity: 0 },
      { transform: `translate(${mx * .35}px,${my * .35}px) rotate(${rz * .2}deg) scale(.7)`, opacity: 1, offset: .12 },
      { transform: `translate(${mx}px,${my}px) rotate(${rz * .55}deg) scale(.88)`, opacity: 1, offset: .45 },
      { transform: `translate(${ex}px,${ey}px) rotate(${rz}deg) scale(1)`, opacity: 0 },
    ], { duration: dur, delay, easing: 'cubic-bezier(.15,.6,.35,1)' });
    A($('.tc-inner', c), [{ transform: 'rotateY(180deg) rotateX(0deg)' }, { transform: `rotateY(${180 + ry}deg) rotateX(${rnd(-40, 40)}deg)` }], { duration: dur, delay, easing: 'cubic-bezier(.2,.7,.4,1)' });
  }

  // 6) monta o painel por baixo e sai da animação
  // monta o painel num momento calmo da animação (evita engasgo na explosão)
  setTimeout(depois, T_OUT - 380);
  const img2 = { duration: 520, delay: T_OUT, easing: 'cubic-bezier(.6,0,.4,1)', fill: 'forwards' };
  A(fly, [
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: 'translate(0,0) scale(1.35)', opacity: 0 },
  ], img2);
  A(bg, [{ opacity: 1 }, { opacity: 0 }], { ...img2, duration: 600 });
  setTimeout(fim, T_OUT + 650);
  }
}

const EYE = '<svg viewBox="0 0 24 24"><path d="M12 5C7 5 2.7 8.1 1 12.5 2.7 16.9 7 20 12 20s9.3-3.1 11-7.5C21.3 8.1 17 5 12 5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>';
const pwdInput = (name, ph, ac, id = '') => `<div class="pwd"><input type="password" name="${name}" ${id ? `id="${id}"` : ''} placeholder="${ph}" autocomplete="${ac}" required><button type="button" class="icon-btn eye" data-eye tabindex="-1" aria-label="Mostrar senha">${EYE}</button></div>`;
const emailBox = () => `<div class="email-fixed"><span class="avatar">${esc(EMAIL_PADRAO[0].toUpperCase())}</span><span>${esc(EMAIL_PADRAO)}</span></div><input type="hidden" name="email" value="${esc(EMAIL_PADRAO)}">`;

function forcaSenha(s) {
  let p = 0;
  if (s.length >= 8) p++;
  if (s.length >= 12) p++;
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) p++;
  if (/\d/.test(s)) p++;
  if (/[^A-Za-z0-9]/.test(s)) p++;
  return Math.min(4, p);
}

function renderAuth(tela, aviso = '', extra = {}) {
  const card = $('#authCard');
  const online = Store.online;
  let html = '';
  if (tela === 'login') {
    html = `<h2>Entrar</h2><p class="lead">Acesse o painel de gestão da Cheel Out Shop.</p>
      <form id="fAuth" novalidate>
        ${aviso ? `<div class="${extra.ok ? 'auth-ok' : 'auth-err'}">${esc(aviso)}</div>` : ''}
        <label class="f">E-mail<input type="email" name="email" value="${esc(extra.email || EMAIL_PADRAO)}" autocomplete="username" required></label>
        <label class="f">Senha${pwdInput('senha', 'Sua senha', 'current-password')}</label>
        <div class="row-between"><label class="check"><input type="checkbox" name="lembrar" checked>Manter conectado</label><button type="button" class="link" data-go="esqueci">Esqueci minha senha</button></div>
        <button class="btn primary block" type="submit">Entrar</button>
        <div class="divider">primeiro acesso?</div>
        <button type="button" class="btn ghost block" data-go="novo">Criar novo acesso</button>
      </form>`;
  } else if (tela === 'novo') {
    html = `<h2>Novo acesso</h2><p class="lead">Crie a senha para entrar no sistema.</p>
      <form id="fAuth" novalidate>
        ${aviso ? `<div class="auth-err">${esc(aviso)}</div>` : ''}
        <label class="f">E-mail de acesso${emailBox()}</label>
        <label class="f">Crie uma senha${pwdInput('senha', 'Mínimo de 8 caracteres', 'new-password', 'nSenha')}<div class="strength"><i id="forca"></i></div><span class="hint-s" id="forcaTxt">Use letras maiúsculas, minúsculas, números e símbolos.</span></label>
        <label class="f">Confirme a senha${pwdInput('conf', 'Repita a senha', 'new-password')}</label>
        <label class="check"><input type="checkbox" name="lembrar" checked>Manter conectado</label>
        <button class="btn accent block" type="submit">Criar acesso e entrar</button>
        <button type="button" class="link" data-go="login" style="justify-self:center">← Voltar para o login</button>
      </form>`;
  } else if (tela === 'esqueci') {
    html = online ? `<h2>Esqueci minha senha</h2><p class="lead">Vamos enviar um código de 6 dígitos para o e-mail de acesso.</p>
      <form id="fAuth" novalidate>
        ${aviso ? `<div class="auth-err">${esc(aviso)}</div>` : ''}
        <label class="f">E-mail${emailBox()}</label>
        <button class="btn primary block" type="submit">Enviar código</button>
        <button type="button" class="link" data-go="codigo" style="justify-self:center">Já tenho um código</button>
        <button type="button" class="link" data-go="login" style="justify-self:center">← Voltar para o login</button>
      </form>`
      : `<h2>Esqueci minha senha</h2><p class="lead">No modo local a senha fica guardada só neste navegador e não dá para enviar código por e-mail.</p>
      <form id="fAuth" novalidate>
        ${aviso ? `<div class="auth-err">${esc(aviso)}</div>` : ''}
        <div class="note warn" style="margin:0">Você pode redefinir o acesso deste navegador. Os dados do ERP <b>não</b> são apagados, e você cria uma senha nova em seguida.</div>
        <button class="btn primary block" type="submit">Redefinir acesso neste navegador</button>
        <button type="button" class="link" data-go="login" style="justify-self:center">← Voltar para o login</button>
      </form>`;
  } else if (tela === 'codigo') {
    html = `<h2>Nova senha</h2><p class="lead">Digite o código enviado para <b>${esc(EMAIL_PADRAO)}</b> e escolha a nova senha.</p>
      <form id="fAuth" novalidate>
        ${aviso ? `<div class="${extra.ok ? 'auth-ok' : 'auth-err'}">${esc(aviso)}</div>` : ''}
        <input type="hidden" name="email" value="${esc(EMAIL_PADRAO)}">
        <label class="f">Código de 6 dígitos<input name="codigo" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required style="letter-spacing:.4em;font-weight:900;font-size:20px"></label>
        <label class="f">Nova senha${pwdInput('senha', 'Mínimo de 8 caracteres', 'new-password', 'nSenha')}<div class="strength"><i id="forca"></i></div><span class="hint-s" id="forcaTxt"></span></label>
        <label class="f">Confirme a nova senha${pwdInput('conf', 'Repita a senha', 'new-password')}</label>
        <button class="btn primary block" type="submit">Salvar nova senha e entrar</button>
        <button type="button" class="link" data-go="login" style="justify-self:center">← Voltar para o login</button>
      </form>`;
  } else if (tela === 'conexao') {
    html = `<h2>Conexão</h2><p class="lead">Cole a URL do App da Web do Apps Script (termina em <code class="code">/exec</code>).</p>
      <form id="fAuth" novalidate>
        ${aviso ? `<div class="auth-err">${esc(aviso)}</div>` : ''}
        <label class="f">URL do Apps Script<input name="url" value="${esc(Store.cfg.url)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
        <button class="btn primary block" type="submit">Salvar e conectar</button>
        ${Store.cfg.url ? '<button type="button" class="btn ghost block" id="usarLocal">Usar modo local (sem planilha)</button>' : ''}
        <button type="button" class="link" data-go="login" style="justify-self:center">← Voltar para o login</button>
      </form>`;
  }
  card.innerHTML = html;
  $('#authMode').innerHTML = online
    ? `<span class="dot on"></span>Conectado à planilha do Google · <button class="link" data-go="conexao" style="font-size:13px">alterar</button>`
    : `<span class="dot"></span>Modo local (dados neste navegador) · <button class="link" data-go="conexao" style="font-size:13px">conectar planilha</button>`;

  $$('[data-go]').forEach(b => b.onclick = () => renderAuth(b.dataset.go));
  $$('[data-eye]', card).forEach(b => b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; });
  const ns = $('#nSenha');
  if (ns) ns.oninput = () => {
    const f = forcaSenha(ns.value);
    const cores = ['#D23B3B', '#D23B3B', '#F28C00', '#2A6BE0', '#12925A'];
    $('#forca').style.width = (ns.value ? (f + 1) * 20 : 0) + '%';
    $('#forca').style.background = cores[f];
    $('#forcaTxt').textContent = !ns.value ? 'Use letras maiúsculas, minúsculas, números e símbolos.' : ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'][f];
  };
  $('#usarLocal') && ($('#usarLocal').onclick = () => trocarConexao(''));
  // prévia: clicar na logo da tela de login toca a animação (não faz login)
  $$('.hero-logo, img.auth-mobile-brand').forEach(l => { l.style.cursor = 'pointer'; l.title = 'Ver animação'; l.onclick = () => animarEntrada(() => {}); });
  const ver = $('#authMode'); if (ver && !ver.querySelector('.ver')) ver.insertAdjacentHTML('beforeend', '<span class="ver">· v' + APP_VERSAO + '</span>');
  const first = $('input:not([type=hidden]):not([type=checkbox])', card);
  if (first && !first.value) first.focus(); else { const s = $('input[type=password]', card); s && s.focus(); }

  $('#fAuth').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    const fd = Object.fromEntries(new FormData(f).entries());
    const lembrar = !!fd.lembrar;
    const btn = $('button[type=submit]', f);
    const txt = btn.textContent;
    btn.disabled = true; btn.textContent = 'Aguarde…';
    try {
      if (tela === 'login') {
        if (!fd.email || !fd.senha) throw new Error('Informe e-mail e senha.');
        await Auth.login(fd.email, fd.senha, lembrar);
        animarEntrada(() => Auth.entrar());
      } else if (tela === 'novo' || tela === 'codigo') {
        if (tela === 'codigo' && !/^\d{6}$/.test(String(fd.codigo).trim())) throw new Error('Digite o código de 6 dígitos.');
        Auth.checarSenha(fd.senha);
        if (fd.senha !== fd.conf) throw new Error('As senhas não conferem.');
        if (tela === 'novo') await Auth.registrar(fd.email, fd.senha, lembrar);
        else { const r = await Store.api({ action: 'reset', email: fd.email, codigo: fd.codigo, senha: fd.senha }); Auth.salvar(r, false); }
        animarEntrada(() => Auth.entrar());
        setTimeout(() => toast(tela === 'novo' ? 'Acesso criado. Bem-vindo!' : 'Senha alterada', 'ok'), 1800);
      } else if (tela === 'esqueci') {
        if (Store.online) {
          await Store.api({ action: 'forgot', email: EMAIL_PADRAO });
          renderAuth('codigo', 'Código enviado! Confira a caixa de entrada (e o spam) de ' + EMAIL_PADRAO + '.', { ok: true });
        } else {
          if (!window.confirm('Redefinir o acesso deste navegador? Você vai criar uma senha nova.')) throw new Error('');
          Auth.gravarLocal(EMAIL_PADRAO, null);
          renderAuth('novo');
        }
      } else if (tela === 'conexao') {
        const url = String(fd.url || '').trim();
        if (!url) throw new Error('Cole a URL do Apps Script.');
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) throw new Error('A URL deve começar com https://script.google.com/');
        const tmp = Store.cfg.url; Store.cfg.url = url;
        try { await Store.api({ action: 'ping' }); } finally { Store.cfg.url = tmp; }
        trocarConexao(url);
      }
    } catch (err) {
      if (err.message && $('#authCard form') === f) {
        let box = $('.auth-err, .auth-ok', f);
        if (!box) { box = document.createElement('div'); f.prepend(box); }
        box.className = 'auth-err'; box.textContent = err.message;
      }
      if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = txt; }
    }
  };
}

/* Troca a planilha (ou volta para o modo local). Exige novo login. */
function trocarConexao(url) {
  const tinhaLocal = !Store.online && url && Object.values(Store.data).some(l => l.length);
  if (tinhaLocal) { try { localStorage.setItem(LS_MIGRAR, JSON.stringify(Store.data)); } catch (e) {} }
  if (Store.online && Auth.sess) Store.api({ action: 'logout' }).catch(() => {});
  Store.cfg.url = url;
  Store.queue = [];
  Store.saveCfg();
  Store.saveCache();
  Auth.limpar();
  Auth.mostrarLogin('login', url ? 'Planilha conectada. Entre (ou crie o acesso) para continuar.' : 'Modo local ativado.', { ok: true });
}

/* Depois do primeiro login na planilha, oferece enviar os dados que estavam no modo local */
async function migrarLocal() {
  if (!Store.online) return;
  let d = null;
  try { d = JSON.parse(localStorage.getItem(LS_MIGRAR) || 'null'); } catch (e) {}
  if (!d) return;
  const total = Object.values(d).reduce((s, l) => s + (l?.length || 0), 0);
  const limpar = () => { try { localStorage.removeItem(LS_MIGRAR); } catch (e) {} };
  if (!total) return limpar();
  confirmar(`Encontramos <b>${total} registro(s)</b> que estavam salvos no modo local deste navegador. Deseja enviá-los para a planilha?`, async () => {
    const ops = [];
    for (const k of Object.keys(COLS)) (d[k] || []).forEach(r => r.id && ops.push(up(k, Store.normalize(k, r))));
    limpar();
    await Store.commit(ops);
    toast('Dados enviados para a planilha', 'ok');
  }, 'Enviar para a planilha');
  $$('[data-close]').forEach(b => b.addEventListener('click', limpar, { once: true }));
}

/* ---------------- Início ---------------- */
Store.init();
Auth.init();
window.addEventListener('online', () => Auth.sess && Store.flush());
$('#logoutBtn').onclick = () => Auth.logout();
$('#sync').onclick = detalhesSync;
setInterval(() => { if (Auth.sess && Store.online && Store.queue.length) Store.flush(); }, 30000);
document.addEventListener('visibilitychange', () => {
  // ao voltar para o app, busca o que o sócio lançou (no máximo 1 vez por minuto)
  if (document.visibilityState !== 'visible' || !Auth.sess || !Store.online) return;
  if (Store.queue.length) { Store.flush(); return; }
  if (Date.now() - (Store.ultimaLeitura || 0) > 60000 && !$('#modal').open) Store.load().then(render);
});
