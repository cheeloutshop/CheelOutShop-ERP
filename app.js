/* =========================================================
   Cheel Out Shop — ERP
   Front-end estático (GitHub Pages) + Google Sheets via Apps Script
   ========================================================= */
'use strict';

const COLS = {
  produtos:   ['id', 'sku', 'nome', 'categoria', 'unidade', 'custo', 'preco', 'estoqueMin', 'ean', 'ncm', 'ativo', 'criadoEm'],
  contatos:   ['id', 'tipo', 'nome', 'documento', 'telefone', 'email', 'cidade', 'uf', 'obs', 'criadoEm'],
  movimentos: ['id', 'data', 'produtoId', 'tipo', 'quantidade', 'custoUnit', 'origem', 'origemId', 'obs', 'criadoEm'],
  compras:    ['id', 'numero', 'data', 'fornecedorId', 'status', 'itens', 'frete', 'desconto', 'total', 'formaPgto', 'parcelas', 'vencimento', 'obs', 'criadoEm'],
  vendas:     ['id', 'numero', 'data', 'clienteId', 'canal', 'status', 'itens', 'frete', 'desconto', 'total', 'formaPgto', 'parcelas', 'vencimento', 'obs', 'criadoEm'],
  pagar:      ['id', 'descricao', 'contatoId', 'categoria', 'vencimento', 'valor', 'status', 'pagoEm', 'valorPago', 'origem', 'origemId', 'obs', 'criadoEm'],
  receber:    ['id', 'descricao', 'contatoId', 'categoria', 'vencimento', 'valor', 'status', 'pagoEm', 'valorPago', 'origem', 'origemId', 'obs', 'criadoEm'],
};

const LS_DATA = 'cheel_erp_data_v1';
const LS_CFG = 'cheel_erp_cfg_v1';
const LS_QUEUE = 'cheel_erp_queue_v1';

const CANAIS = ['Loja física', 'Site', 'Mercado Livre', 'Shopee', 'Amazon', 'TikTok Shop', 'Instagram / WhatsApp', 'Outro'];
const FORMAS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Transferência', 'Marketplace'];
const A_VISTA = ['Pix', 'Dinheiro', 'Cartão de débito'];
const ST_VENDA = ['Orçamento', 'Em aberto', 'Atendido', 'Cancelado'];
const ST_COMPRA = ['Em aberto', 'Recebido', 'Cancelado'];
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
  cfg: { url: '', key: '' },
  queue: [],

  init() {
    try { this.cfg = { ...this.cfg, ...JSON.parse(localStorage.getItem(LS_CFG) || '{}') }; } catch (e) {}
    try {
      const d = JSON.parse(localStorage.getItem(LS_DATA) || 'null');
      if (d) for (const k of Object.keys(COLS)) this.data[k] = (d[k] || []).map(r => this.normalize(k, r));
    } catch (e) {}
    try { this.queue = JSON.parse(localStorage.getItem(LS_QUEUE) || '[]'); } catch (e) { this.queue = []; }
  },
  get online() { return !!(this.cfg.url && this.cfg.key); },
  normalize(sheet, r) {
    const o = { ...r };
    if ('itens' in o && typeof o.itens === 'string') { try { o.itens = JSON.parse(o.itens || '[]'); } catch (e) { o.itens = []; } }
    if (COLS[sheet].includes('itens') && !Array.isArray(o.itens)) o.itens = [];
    return o;
  },
  saveCfg() { try { localStorage.setItem(LS_CFG, JSON.stringify(this.cfg)); } catch (e) {} },
  saveCache() {
    try {
      localStorage.setItem(LS_DATA, JSON.stringify(this.data));
      localStorage.setItem(LS_QUEUE, JSON.stringify(this.queue));
    } catch (e) {}
  },
  async api(payload) {
    const res = await fetch(this.cfg.url, { method: 'POST', body: JSON.stringify({ ...payload, key: this.cfg.key }) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Erro desconhecido');
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
  async flush() {
    if (!this.online || !this.queue.length) return true;
    setSync('sync');
    try {
      while (this.queue.length) {
        const lote = this.queue.slice(0, 150);
        await this.api({ action: 'batch', ops: lote });
        this.queue.splice(0, lote.length);
        this.saveCache();
      }
      setSync('ok');
      return true;
    } catch (e) {
      setSync('erro', e.message);
      toast('Não consegui salvar na planilha: ' + e.message + '. As alterações ficam guardadas e serão reenviadas.', 'err');
      return false;
    }
  },
  async commit(ops) {
    if (!ops.length) return;
    this.apply(ops);
    if (this.online) this.queue.push(...ops);
    this.saveCache();
    render();
    await this.flush();
  },
  async load() {
    if (!this.online) { setSync('local'); return; }
    const ok = await this.flush();
    if (!ok) return;
    setSync('sync');
    try {
      const d = await this.api({ action: 'getAll' });
      for (const k of Object.keys(COLS)) this.data[k] = (d[k] || []).map(r => this.normalize(k, r));
      this.saveCache();
      setSync('ok');
    } catch (e) {
      setSync('erro', e.message);
      toast('Erro ao carregar da planilha: ' + e.message, 'err');
    }
  },
};
const up = (sheet, record) => ({ op: 'upsert', sheet, record });
const del = (sheet, id) => ({ op: 'delete', sheet, id });

function setSync(state, detalhe) {
  const el = $('#sync');
  el.className = 'sync ' + (state === 'local' ? '' : state);
  const txt = { local: 'Modo local (sem planilha)', ok: 'Sincronizado com a planilha', sync: 'Sincronizando…', erro: 'Erro de sincronização' }[state];
  $('.txt', el).textContent = txt + (state === 'erro' && Store.queue.length ? ` · ${Store.queue.length} pendente(s)` : '');
  el.title = detalhe || '';
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
function efeitosCompra(c) {
  const ops = [];
  Store.data.movimentos.filter(m => m.origem === 'compra' && m.origemId === c.id).forEach(m => ops.push(del('movimentos', m.id)));
  const pags = Store.data.pagar.filter(r => r.origem === 'compra' && r.origemId === c.id);
  const temPago = pags.some(r => r.status === 'Pago');
  if (c.status === 'Recebido') {
    for (const it of c.itens) {
      ops.push(up('movimentos', {
        id: uid(), data: c.data, produtoId: it.produtoId, tipo: 'entrada', quantidade: num(it.qtd),
        custoUnit: num(it.valor), origem: 'compra', origemId: c.id, obs: 'Pedido de compra nº ' + c.numero, criadoEm: agora(),
      }));
      const p = produto(it.produtoId);
      if (p && num(it.valor) > 0 && num(p.custo) !== num(it.valor)) ops.push(up('produtos', { ...p, custo: num(it.valor) }));
    }
    if (!temPago) {
      pags.forEach(r => ops.push(del('pagar', r.id)));
      const parc = gerarParcelas(num(c.total), c.parcelas, c.vencimento || c.data);
      for (const p of parc) {
        ops.push(up('pagar', {
          id: uid(), descricao: `Pedido de compra nº ${c.numero}` + (parc.length > 1 ? ` · parcela ${p.n}/${parc.length}` : ''),
          contatoId: c.fornecedorId, categoria: 'Fornecedores', vencimento: p.vencimento, valor: p.valor,
          status: 'Aberto', pagoEm: '', valorPago: '', origem: 'compra', origemId: c.id, obs: c.formaPgto || '', criadoEm: agora(),
        }));
      }
    }
  } else {
    pags.filter(r => r.status !== 'Pago').forEach(r => ops.push(del('pagar', r.id)));
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
  contatos: { t: 'Clientes e fornecedores', s: 'Cadastro de contatos', fn: viewContatos },
  produtos: { t: 'Produtos', s: 'Cadastro de produtos, preços e custos', fn: viewProdutos },
  estoque:  { t: 'Controle de estoque', s: 'Saldos, movimentações e balanço', fn: viewEstoque },
  receber:  { t: 'Contas a receber', s: 'Recebimentos de clientes', fn: () => viewContas('receber') },
  pagar:    { t: 'Contas a pagar', s: 'Pagamentos a fornecedores e despesas', fn: () => viewContas('pagar') },
  config:   { t: 'Configurações', s: 'Conexão com Google Sheets e backup', fn: viewConfig },
};
const UI = {}; // estado de filtros por tela
function rota() { const r = location.hash.replace('#/', '').split('?')[0]; return ROUTES[r] ? r : 'painel'; }
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

  const limite = addDias(hoje(), 7);
  const proximas = [
    ...recAb.map(c => ({ ...c, _t: 'receber' })),
    ...pagAb.map(c => ({ ...c, _t: 'pagar' })),
  ].filter(c => c.vencimento <= limite).sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 8);

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
        <h3>Vencimentos (vencidos e próximos 7 dias)</h3>
        ${proximas.length ? `<ul class="list">${proximas.map(c => `
          <li><span class="l">${esc(c.descricao)}<span class="s">${c._t === 'receber' ? 'Receber' : 'Pagar'} · ${dataBR(c.vencimento)} ${statusConta(c) === 'Vencido' ? '· <b class="neg">vencido</b>' : ''}${c.contatoId ? ' · ' + esc(nomeContato(c.contatoId)) : ''}</span></span>
          <span class="num ${c._t === 'receber' ? 'pos' : 'neg'}">${c._t === 'receber' ? '+' : '−'} ${brl(c.valor)}</span></li>`).join('')}</ul>`
          : '<div class="empty">Nada vencendo nos próximos 7 dias 🎉</div>'}
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
      $('#pCusto').oninput = upd; $('#pPreco').oninput = upd; upd();
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
          ${!V && p.status === 'Em aberto' ? `<button class="btn ghost sm" data-fat="${p.id}" title="Entrada no estoque e gera contas a pagar">${ICON.check}Receber</button>` : ''}
          <button class="icon-btn" data-print="${p.id}" title="Imprimir">${ICON.print}</button>
          <button class="icon-btn" data-edit="${p.id}" title="Editar">${ICON.edit}</button>
          <button class="icon-btn del" data-del="${p.id}" title="Excluir">${ICON.del}</button></span></td>
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
      confirmar(`Confirmar recebimento do pedido de compra nº ${p.numero}? Os produtos entram no estoque e as contas a pagar serão geradas.`, () => Store.commit([up(tipo, novo), ...efeitosCompra(novo)]).then(() => toast('Mercadoria recebida', 'ok')), 'Receber');
    }
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

function itemRow(it, V) {
  return `<tr>
    <td class="c-prod"><select data-i="prod">${prodOptions(it.produtoId)}</select></td>
    <td class="c-qtd"><input data-i="qtd" inputmode="decimal" value="${esc(it.qtd ?? 1)}"></td>
    <td class="c-val"><input data-i="valor" inputmode="decimal" value="${dec(it.valor)}" placeholder="${V ? 'preço' : 'custo'}"></td>
    <td class="c-sub" data-i="sub"></td>
    <td class="act"><button type="button" class="icon-btn del" data-i="rm" title="Remover">${ICON.del}</button></td>
  </tr>`;
}

function formPedido(tipo, p) {
  const V = tipo === 'vendas';
  if (!Store.data.produtos.length) return toast('Cadastre produtos antes de lançar pedidos', 'err');
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
        <div class="${V ? 'span2' : 'span2'}" style="display:flex;align-items:end"><button type="button" class="btn ghost sm" id="novoContato">${ICON.plus}Cadastrar ${V ? 'cliente' : 'fornecedor'}</button></div>
      </div>
      <div class="section-t">Itens</div>
      <div class="items"><table>
        <thead><tr><th>Produto</th><th>Qtd</th><th>${V ? 'Preço unit.' : 'Custo unit.'}</th><th class="r">Subtotal</th><th></th></tr></thead>
        <tbody id="itensBody">${p.itens.map(i => itemRow(i, V)).join('')}</tbody>
      </table><div class="items-add"><button type="button" class="btn ghost sm" id="addItem">${ICON.plus}Adicionar item</button></div></div>
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
      tb.addEventListener('change', e => {
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
      $('#novoContato', body).onclick = () => {
        const nome = prompt(`Nome do ${V ? 'cliente' : 'fornecedor'}:`);
        if (!nome || !nome.trim()) return;
        const c = { id: uid(), tipo: V ? 'Cliente' : 'Fornecedor', nome: nome.trim(), criadoEm: agora() };
        Store.apply([up('contatos', c)]); Store.queue.push(up('contatos', c)); Store.saveCache(); Store.flush();
        const sel = $('[name=contatoId]', body);
        sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.nome)}</option>`);
        sel.value = c.id;
      };
      recalc();
    },
    onSubmit: (fd, body) => {
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
function formCompra(p) { formPedido('compras', p); }

function imprimirPedido(tipo, p) {
  const V = tipo === 'vendas';
  const c = contato(V ? p.clienteId : p.fornecedorId);
  const w = window.open('', '_blank');
  if (!w) return toast('Permita pop-ups para imprimir', 'err');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${V ? 'Pedido de venda' : 'Pedido de compra'} ${esc(p.numero)}</title>
  <style>body{font-family:Arial,sans-serif;color:#111;margin:32px;font-size:14px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}th{background:#0B3A8C;color:#FFD400}.r{text-align:right}.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #FFD400;padding-bottom:12px}.tot{margin-top:12px;text-align:right;font-size:16px}img{height:80px}</style></head><body>
  <div class="head"><img src="${new URL('logo.jpg', location.href)}"><div style="text-align:right"><h1>${V ? 'Pedido de venda' : 'Pedido de compra'} nº ${esc(p.numero)}</h1><div>Data: ${dataBR(p.data)} · Situação: ${esc(p.status)}</div></div></div>
  <p><b>${V ? 'Cliente' : 'Fornecedor'}:</b> ${esc(c?.nome || (V ? 'Consumidor final' : ''))}${c?.documento ? ' · ' + esc(c.documento) : ''}${c?.telefone ? ' · ' + esc(c.telefone) : ''}${c?.email ? ' · ' + esc(c.email) : ''}${c?.cidade ? '<br>' + esc(c.cidade) + (c.uf ? '/' + esc(c.uf) : '') : ''}</p>
  <table><thead><tr><th>Produto</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="r">Subtotal</th></tr></thead><tbody>
  ${p.itens.map(i => `<tr><td>${esc(produto(i.produtoId)?.sku || '')} ${esc(nomeProduto(i.produtoId))}</td><td class="r">${qtdFmt(i.qtd)}</td><td class="r">${brl(i.valor)}</td><td class="r">${brl(num(i.qtd) * num(i.valor))}</td></tr>`).join('')}
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
function viewContatos(el) {
  actions(`<button class="btn accent" id="novoCont">${ICON.plus}Novo contato</button>`);
  const q = UI.qCont || '';
  const f = UI.fCont || '';
  const lista = Store.data.contatos.filter(c => !f || c.tipo === f || c.tipo === 'Ambos').filter(c => match(q, c.nome, c.documento, c.email, c.telefone, c.cidade)).sort((a, b) => a.nome.localeCompare(b.nome));
  el.innerHTML = `
    <div class="toolbar">${searchBox('qCont', q, 'Buscar por nome, CPF/CNPJ, e-mail, telefone…')}
      <div class="chips">${[['', 'Todos'], ['Cliente', 'Clientes'], ['Fornecedor', 'Fornecedores']].map(([v, t]) => `<button class="chip ${f === v ? 'on' : ''}" data-f="${v}">${t}</button>`).join('')}</div></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Nome</th><th>Tipo</th><th>CPF / CNPJ</th><th>Telefone</th><th>E-mail</th><th>Cidade</th><th></th></tr></thead>
      <tbody>${lista.length ? lista.map(c => `<tr>
        <td class="wrap strong">${esc(c.nome)}</td><td><span class="badge ${c.tipo === 'Fornecedor' ? 'amber' : ''}">${esc(c.tipo)}</span></td>
        <td>${esc(c.documento)}</td><td>${c.telefone ? `<a href="https://wa.me/55${esc(String(c.telefone).replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c.telefone)}</a>` : ''}</td>
        <td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}</td><td>${esc(c.cidade)}${c.uf ? '/' + esc(c.uf) : ''}</td>
        <td class="act"><span class="inner"><button class="icon-btn" data-edit="${c.id}">${ICON.edit}</button><button class="icon-btn del" data-del="${c.id}">${ICON.del}</button></span></td>
      </tr>`).join('') : emptyRow(7, 'Nenhum contato', '👥')}</tbody>
    </table></div>`;
  bindSearch('qCont', 'qCont');
  $$('[data-f]', el).forEach(b => b.onclick = () => { UI.fCont = b.dataset.f; render(); });
  $('#novoCont').onclick = () => formContato();
  $$('[data-edit]', el).forEach(b => b.onclick = () => formContato(contato(b.dataset.edit)));
  $$('[data-del]', el).forEach(b => b.onclick = () => {
    const c = contato(b.dataset.del);
    const usado = Store.data.vendas.some(v => v.clienteId === c.id) || Store.data.compras.some(v => v.fornecedorId === c.id) || [...Store.data.pagar, ...Store.data.receber].some(x => x.contatoId === c.id);
    if (usado) return toast('Este contato está em pedidos ou contas e não pode ser excluído.', 'err');
    confirmar(`Excluir <b>${esc(c.nome)}</b>?`, () => Store.commit([del('contatos', c.id)]), 'Excluir');
  });
}

function formContato(c) {
  const novo = !c;
  c = c || { tipo: 'Cliente' };
  Modal.open({
    title: novo ? 'Novo contato' : 'Editar contato',
    body: `<div class="grid g4">
      ${field('Nome / razão social *', inp('nome', c.nome, 'required'), 'span3')}
      ${field('Tipo', `<select name="tipo">${opt(['Cliente', 'Fornecedor', 'Ambos'], c.tipo)}</select>`)}
      ${field('CPF / CNPJ', inp('documento', c.documento))}
      ${field('Telefone / WhatsApp', inp('telefone', c.telefone, 'inputmode="tel"'))}
      ${field('E-mail', inp('email', c.email, 'type="email"'), 'span2')}
      ${field('Cidade', inp('cidade', c.cidade), 'span3')}
      ${field('UF', inp('uf', c.uf, 'maxlength="2"'))}
      ${field('Observações', `<textarea name="obs">${esc(c.obs)}</textarea>`, 'span4')}
    </div>`,
    onSubmit: fd => {
      Store.commit([up('contatos', { ...c, id: c.id || uid(), nome: fd.nome.trim(), tipo: fd.tipo, documento: fd.documento.trim(), telefone: fd.telefone.trim(), email: fd.email.trim(), cidade: fd.cidade.trim(), uf: fd.uf.trim().toUpperCase(), obs: fd.obs, criadoEm: c.criadoEm || agora() })]);
      toast(novo ? 'Contato cadastrado' : 'Contato atualizado', 'ok');
    },
  });
}

/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */
function viewConfig(el) {
  const cfg = Store.cfg;
  const qtd = Object.entries(Store.data).map(([k, v]) => `${k}: ${v.length}`).join(' · ');
  el.innerHTML = `
    <div class="two even">
      <div class="card">
        <h3>Conexão com o Google Sheets</h3>
        <div class="grid">
          ${field('URL do App da Web (Apps Script)', `<input id="cfgUrl" value="${esc(cfg.url)}" placeholder="https://script.google.com/macros/s/…/exec">`)}
          ${field('Senha da API (a mesma do API_KEY no Apps Script)', `<input id="cfgKey" type="password" value="${esc(cfg.key)}">`)}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" id="cfgSalvar">Salvar e conectar</button>
            <button class="btn ghost" id="cfgTestar">Testar conexão</button>
            ${cfg.url ? '<button class="btn danger" id="cfgDesc">Desconectar</button>' : ''}
          </div>
          <div class="note">${Store.online ? `Conectado. Os dados são lidos e gravados na planilha. ${Store.queue.length ? `<b>${Store.queue.length} alteração(ões) aguardando envio.</b>` : ''}` : 'Sem planilha conectada: os dados ficam salvos apenas neste navegador.'}</div>
          ${Store.online ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" id="cfgRecarregar">${ICON.sync}Recarregar da planilha</button><button class="btn ghost" id="cfgEnviar">Enviar dados deste navegador para a planilha</button></div>` : ''}
        </div>
      </div>
      <div class="card">
        <h3>Como conectar (uma vez só)</h3>
        <ol class="steps">
          <li>Crie uma planilha nova no Google Sheets.</li>
          <li>Menu <b>Extensões › Apps Script</b>, apague tudo e cole o conteúdo de <code>apps-script/Code.gs</code>.</li>
          <li>Troque a senha em <code>API_KEY</code> e salve.</li>
          <li>Selecione a função <code>setup</code> e clique em <b>Executar</b> (autorize).</li>
          <li><b>Implantar › Nova implantação › App da Web</b> — Executar como: <b>Eu</b>; Acesso: <b>Qualquer pessoa</b>.</li>
          <li>Copie a URL que termina em <code>/exec</code> e cole ao lado com a senha.</li>
        </ol>
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

  const lerCampos = () => ({ url: $('#cfgUrl').value.trim(), key: $('#cfgKey').value.trim() });
  $('#cfgTestar').onclick = async () => {
    const tmp = Store.cfg; Store.cfg = lerCampos();
    try { const r = await Store.api({ action: 'ping' }); toast('Conexão OK com a planilha “' + r.planilha + '”', 'ok'); }
    catch (e) { toast('Falhou: ' + e.message, 'err'); }
    Store.cfg = tmp;
  };
  $('#cfgSalvar').onclick = async () => {
    const c = lerCampos();
    if (!c.url || !c.key) return toast('Informe a URL e a senha', 'err');
    const tmp = Store.cfg; Store.cfg = c;
    try { await Store.api({ action: 'ping' }); } catch (e) { Store.cfg = tmp; return toast('Não conectou: ' + e.message, 'err'); }
    const tinhaLocal = !tmp.url && Object.values(Store.data).some(l => l.length);
    Store.saveCfg();
    if (tinhaLocal) {
      confirmar('Conectado! Você tem dados salvos neste navegador. Deseja <b>enviá-los para a planilha</b>? (Se escolher Cancelar, os dados da planilha serão carregados e os locais substituídos.)', async () => { await enviarTudo(); await Store.load(); render(); }, 'Enviar para a planilha');
      $$('[data-close]').forEach(b => b.addEventListener('click', async () => { await Store.load(); render(); }, { once: true }));
    } else { await Store.load(); render(); toast('Conectado à planilha', 'ok'); }
  };
  $('#cfgDesc') && ($('#cfgDesc').onclick = () => confirmar('Desconectar da planilha? Uma cópia dos dados continua neste navegador.', () => { Store.cfg = { url: '', key: '' }; Store.queue = []; Store.saveCfg(); Store.saveCache(); setSync('local'); render(); }, 'Desconectar'));
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

/* ---------------- Início ---------------- */
Store.init();
setSync(Store.online ? 'sync' : 'local');
render();
Store.load().then(render);
window.addEventListener('online', () => Store.flush());
