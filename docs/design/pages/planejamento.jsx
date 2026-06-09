// Planejamento — the demand→production bridge (pipeline D).
//   PEDIDOS importados → DEMANDA mapeada → sugere [CORTE + IMPRESSÃO] → MONTAGEM
// Computes net demand in the shared WIP vocabulary (peças lisas + impressos),
// subtracting finished stock, WIP stock, and quantities already in open orders.
// Exports window.OrionDemand so Montagem (printing.jsx) reuses the same engine.

// ───────── vocabulary bridges between the fulfillment world and the WIP tiers ─────────
const GARMENT_TO_BASE = {
  'Camiseta': 'Camiseta', 'Cropped': 'Cropped',
  'Moletom Canguru': 'Moletom Canguru', 'Moletom': 'Moletom Canguru',
  'Bolsa ecobag': 'Ecobag', 'Ecobag': 'Ecobag', 'Bolsa': 'Ecobag',
};
const normSize = (s) => {
  const t = String(s || '').trim();
  if (/^unico$/i.test(t) || /^único$/i.test(t)) return 'Único';
  return t.toUpperCase();
};
const dmNorm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// product name → blank base (used to match open Corte orders to a blank tier)
const productNameToBase = (name) => {
  const n = dmNorm(name);
  if (n.includes('cropped')) return 'Cropped';
  if (n.includes('moletom') || n.includes('canguru')) return 'Moletom Canguru';
  if (n.includes('tote') || n.includes('ecobag') || n.includes('bolsa')) return 'Ecobag';
  if (n.includes('camiseta') || n.includes('t-shirt') || n.includes('tshirt') || n.includes('box')) return 'Camiseta';
  return null;
};

// ───────── the engine ─────────
(function () {
  const D = () => window.ORION_DATA;

  // open demand = imported orders not yet montados/conferidos
  const openOrders = () => D().fulfillment.orders.filter(o => o.status !== 'conferido');

  // find the blank tier row that satisfies a (garment,color,size) demand
  const blankFor = (garment, color, size) => {
    const base = GARMENT_TO_BASE[garment];
    if (!base) return null;
    const sz = normSize(size);
    return D().blankPieces.find(b => b.base === base && dmNorm(b.color) === dmNorm(color) && normSize(b.size) === sz) || null;
  };
  // find the impresso tier row for an estampa (front side is the primary component)
  const printedFor = (estampa) => {
    const rows = D().printed.filter(p => String(p.code) === String(estampa));
    return rows.find(p => p.side === 'frente') || rows[0] || null;
  };
  // finished-goods stock for a fulfillment SKU. When the blank tier is known we can
  // reconstruct the exact assembled SKU (skuFor) and read it back precisely — this is
  // what closes the loop after a Montagem credits finished product.
  const finishedFor = (estampa, garment, color, size, blank) => {
    if (blank && window.StockStore) {
      const sku = window.StockStore.skuFor(blank, estampa);
      const row = D().stock.find(s => s.sku === sku);
      if (row) return row.count;
    }
    const sz = normSize(size);
    return D().stock
      .filter(s => dmNorm(s.product).includes(dmNorm(garment).slice(0, 4)) && dmNorm(s.color) === dmNorm(color) && normSize(s.size) === sz && String(s.print || '').includes(String(estampa)))
      .reduce((a, s) => a + s.count, 0);
  };

  // WIP for a blank tier already flowing through Corte + Costura (not yet credited)
  const blankInProduction = (blank) => {
    if (!blank) return 0;
    let wip = 0;
    // open Corte orders matching base+color → planned not yet cut
    (D().cutting || []).forEach(c => {
      if (c.status === 'concluido') return;
      if (productNameToBase(c.product) !== blank.base) return;
      if (dmNorm(c.color) !== dmNorm(blank.color)) return;
      (c.grade || []).forEach(g => { if (normSize(g.size) === normSize(blank.size)) wip += Math.max(0, (g.planned || 0) - (g.actual || 0)); });
    });
    // open Costura lines reference the blank id directly → planned not yet received
    (D().sewing || []).forEach(sw => {
      if (sw.status === 'recebido') return;
      (sw.lines || []).forEach(l => { if (l.id === blank.id) wip += Math.max(0, (l.planned || 0) - (l.received || 0)); });
    });
    return wip;
  };
  // WIP for an estampa already in open Impressão orders
  const printedInProduction = (estampa) => {
    let wip = 0;
    (D().printing || []).forEach(p => {
      if (p.status === 'concluido') return;
      if (String(p.estampa) !== String(estampa)) return;
      wip += Math.max(0, (p.planned || 0) - (p.printed || 0));
    });
    return wip;
  };

  // Build the full demand model from the open orders.
  function build() {
    const orders = openOrders();
    const skuMap = new Map();   // estampa|garment|color|size → demand row
    let pieces = 0;

    orders.forEach(o => o.items.forEach(it => {
      const key = `${it.estampa}|${it.garment}|${it.color}|${normSize(it.size)}`;
      pieces += it.qty;
      if (!skuMap.has(key)) {
        skuMap.set(key, {
          key, estampa: it.estampa, garment: it.garment, color: it.color, size: normSize(it.size),
          product: it.product, needed: 0, orders: new Set(),
        });
      }
      const row = skuMap.get(key);
      row.needed += it.qty;
      row.orders.add(o.id);
    }));

    // enrich each demand SKU with component availability
    const skus = [...skuMap.values()].map(r => {
      const blank = blankFor(r.garment, r.color, r.size);
      const printed = printedFor(r.estampa);
      const finished = finishedFor(r.estampa, r.garment, r.color, r.size, blank);
      const net = Math.max(0, r.needed - finished);   // qty that must be assembled
      const blankHave = blank ? blank.count : 0;
      const printedHave = printed ? printed.count : 0;
      const blankShort = Math.max(0, net - blankHave);
      const printedShort = Math.max(0, net - printedHave);
      const buildable = Math.max(0, Math.min(net, blankHave, printedHave));
      let state = 'pronto';
      if (blankShort > 0 && printedShort > 0) state = 'ambos';
      else if (blankShort > 0) state = 'lisa';
      else if (printedShort > 0) state = 'impresso';
      return {
        ...r, orders: [...r.orders], blank, printed, finished, net,
        blankHave, printedHave, blankShort, printedShort, buildable, state,
      };
    }).sort((a, b) => b.needed - a.needed);

    // ════════ SUGESTÕES DE PRODUÇÃO ════════
    // Cada sugestão combina dois motores: a DEMANDA dos pedidos e o ESTOQUE MÍNIMO.
    // Para um tier:  produzir = falta p/ demanda + falta p/ repor o mínimo.

    // ── Cortes: por tier de peça lisa (base|cor|tam) ──
    const blankNeed = new Map();
    D().blankPieces.forEach(b => {
      blankNeed.set(`${b.base}|${b.color}|${normSize(b.size)}`, {
        base: b.base, color: b.color, size: normSize(b.size), garment: b.garment,
        count: b.count, min: b.min || 0, wip: blankInProduction(b), demand: 0, orders: new Set(), tier: b,
      });
    });
    skus.forEach(s => {
      if (s.net <= 0) return;
      const base = (s.blank && s.blank.base) || GARMENT_TO_BASE[s.garment];
      if (!base) return;
      const color = (s.blank && s.blank.color) || s.color;
      const k = `${base}|${color}|${s.size}`;
      if (!blankNeed.has(k)) blankNeed.set(k, { base, color, size: s.size, garment: s.garment, count: 0, min: 0, wip: blankInProduction(s.blank), demand: 0, orders: new Set(), tier: s.blank });
      const e = blankNeed.get(k);
      e.demand += s.net;
      s.orders.forEach(o => e.orders.add(o));
    });
    const corteMap = new Map();
    blankNeed.forEach(e => {
      const demandShort = Math.max(0, e.demand - e.count - e.wip);
      const afterDemand = Math.max(0, e.count + e.wip - e.demand);
      const stockShort = Math.max(0, e.min - afterDemand);
      const total = demandShort + stockShort;
      if (total <= 0) return;
      const ck = `${e.base}|${e.color}`;
      if (!corteMap.has(ck)) corteMap.set(ck, { key: ck, base: e.base, garment: e.garment, color: e.color, grade: [], total: 0, demand: 0, stock: 0, orders: new Set() });
      const g = corteMap.get(ck);
      g.grade.push({ size: e.size, qty: total, demandQty: demandShort, stockQty: stockShort });
      g.total += total; g.demand += demandShort; g.stock += stockShort;
      e.orders.forEach(o => g.orders.add(o));
    });
    const cortes = [...corteMap.values()].map(c => ({
      key: c.key, base: c.base, garment: c.garment, color: c.color, total: c.total, demand: c.demand, stock: c.stock,
      orders: [...c.orders],
      gradeRows: c.grade.sort((a, b) => sizeOrder(a.size) - sizeOrder(b.size)),
      sources: [c.demand > 0 && 'demanda', c.stock > 0 && 'estoque'].filter(Boolean),
    })).sort((a, b) => b.total - a.total);

    // ── Impressões: por estampa (tier frente como referência) ──
    const imprNeed = new Map();
    D().printed.forEach(p => {
      if (p.side && p.side !== 'frente') return;
      imprNeed.set(String(p.code), {
        code: String(p.code), name: p.name, tone: p.tone || 'warm', png: p.png || 'ok',
        count: p.count, min: p.min || 0, wip: printedInProduction(p.code), demand: 0, orders: new Set(),
      });
    });
    skus.forEach(s => {
      if (s.net <= 0) return;
      const code = String(s.estampa);
      if (!imprNeed.has(code)) {
        const est = D().fulfillment.estampas[code] || {};
        imprNeed.set(code, { code, name: est.name || ('Estampa ' + code), tone: est.tone || 'warm', png: est.png || 'ok', count: s.printedHave, min: 0, wip: printedInProduction(code), demand: 0, orders: new Set() });
      }
      const e = imprNeed.get(code);
      e.demand += s.net;
      s.orders.forEach(o => e.orders.add(o));
    });
    const impressoes = [];
    imprNeed.forEach(e => {
      const demandShort = Math.max(0, e.demand - e.count - e.wip);
      const afterDemand = Math.max(0, e.count + e.wip - e.demand);
      const stockShort = Math.max(0, e.min - afterDemand);
      const total = demandShort + stockShort;
      if (total <= 0) return;
      impressoes.push({
        key: e.code, code: e.code, name: e.name, tone: e.tone, png: e.png, total, demand: demandShort, stock: stockShort,
        orders: [...e.orders], sources: [demandShort > 0 && 'demanda', stockShort > 0 && 'estoque'].filter(Boolean),
      });
    });
    impressoes.sort((a, b) => b.total - a.total);

    const totals = {
      toCut: cortes.reduce((a, c) => a + c.total, 0),
      toPrint: impressoes.reduce((a, c) => a + c.total, 0),
      cortes: cortes.length, impressoes: impressoes.length,
      demandDriven: cortes.filter(c => c.demand > 0).length + impressoes.filter(c => c.demand > 0).length,
      stockDriven: cortes.filter(c => c.stock > 0).length + impressoes.filter(c => c.stock > 0).length,
    };
    return { skus, cortes, impressoes, totals };
  }

  const sizeOrder = (s) => ({ 'P': 1, 'M': 2, 'G': 3, 'GG': 4, 'XG': 5, 'Único': 9 }[s] || 6);

  // Is an order ready to be separated? True when every item's assembled SKU is in
  // finished stock in sufficient quantity (i.e. Montagem has produced it).
  function orderReady(o) {
    if (!o || !o.items || !o.items.length) return false;
    return o.items.every(it => {
      const blank = blankFor(it.garment, it.color, it.size);
      if (!blank || !window.StockStore) return false;
      const sku = window.StockStore.skuFor(blank, it.estampa);
      const row = D().stock.find(s => s.sku === sku);
      return !!row && row.count >= it.qty;
    });
  }

  // ── actions: create draft Corte / Impressão orders on their boards ──
  function createCorteOrders(cortes, operator) {
    const arr = D().cutting;
    let next = Math.max(214, ...arr.map(i => +String(i.code).replace('CO-', '') || 0)) + 1;
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    const made = [];
    cortes.forEach(c => {
      const code = `CO-${next++}`;
      const grade = c.gradeRows.map(r => ({ size: r.size, planned: r.qty, actual: 0 }));
      const planned = grade.reduce((a, g) => a + g.planned, 0);
      arr.unshift({ id: code, code, product: c.base, color: c.color, status: 'pendente', roll: '—', planned, actual: 0, operator: operator || 'Joana Pires', date, grade, _fromPlan: true });
      made.push(code);
    });
    return made;
  }
  function ensurePrintSpec(code) {
    const prints = D().prints;
    if (prints.find(p => p.id === String(code))) return;
    const est = D().fulfillment.estampas[code] || {};
    const tone = est.tone || 'warm';
    prints.unshift({
      id: String(code), name: est.name || ('Estampa ' + code), technique: 'DTF', cost: 4.0, tag: 'demanda', tone,
      sides: ['front'],
      variations: [{ id: 'v1', name: 'Padrão', ink: '#1f1f1f', front: { file: est.png === 'ok' ? `${code}_frente.png` : null, png: est.png || 'ok' } }],
    });
  }
  function createImpressaoOrders(impressoes, operator) {
    const arr = D().printing;
    let next = Math.max(216, ...arr.map(i => +String(i.code).replace('IM-', '') || 0)) + 1;
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    const made = [];
    impressoes.forEach(im => {
      ensurePrintSpec(im.code);
      const code = `IM-${next++}`;
      arr.unshift({ id: code, code, estampa: String(im.code), status: 'pendente', roll: '—', planned: im.total, printed: 0, operator: operator || 'Joana Pires', date, consumed: 0, _fromPlan: true });
      made.push(code);
    });
    return made;
  }

  window.OrionDemand = { build, blankFor, printedFor, createCorteOrders, createImpressaoOrders, orderReady, GARMENT_TO_BASE, normSize, sizeOrder };
})();

// ───────── small presentational helpers ─────────
const SRC = {
  demanda: { label: 'Demanda', icon: 'shopping-bag', fg: 'var(--brand-sales)' },
  estoque: { label: 'Estoque baixo', icon: 'trending-down', fg: 'var(--warn)' },
};
const SourceBadge = ({ kind, detail }) => {
  const c = SRC[kind];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 500,
      color: c.fg, background: `color-mix(in oklab, ${c.fg} 11%, var(--surface))`, border: `1px solid color-mix(in oklab, ${c.fg} 22%, var(--surface))`, whiteSpace: 'nowrap' }}>
      <Icon name={c.icon} size={10.5}/> {c.label}{detail ? <span style={{ opacity: .7 }}>· {detail}</span> : null}
    </span>
  );
};

const garmentGlyph = (garment, px = 16) => {
  const base = GARMENT_TO_BASE[garment];
  if (base === 'Ecobag') return <Icon name="shopping-bag" size={px}/>;
  const gid = base === 'Moletom Canguru' ? 'moletom' : 'camiseta';
  const G = (typeof GARMENT_GLYPHS !== 'undefined' && GARMENT_GLYPHS) || window.GARMENT_GLYPHS;
  return (G && G[gid])
    ? React.cloneElement(G[gid], { width: px, height: px, strokeWidth: 1.4 })
    : <Icon name="shirt" size={px}/>;
};

// ───────── the page: suggested production orders, and why ─────────
function Planejamento({ setRoute }) {
  const store = useStock();
  const [model, setModel] = React.useState(() => window.OrionDemand.build());
  const [filter, setFilter] = React.useState('all'); // all | demanda | estoque
  const [pickCorte, setPickCorte] = React.useState(() => new Set());
  const [pickImpr, setPickImpr] = React.useState(() => new Set());
  const [created, setCreated] = React.useState(null);

  React.useEffect(() => store.subscribe(() => setModel(window.OrionDemand.build())), []);
  React.useEffect(() => {
    setPickCorte(new Set(model.cortes.map(c => c.key)));
    setPickImpr(new Set(model.impressoes.map(c => c.key)));
  }, [model.cortes.length, model.impressoes.length]);

  const matchFilter = (s) => filter === 'all' || (filter === 'demanda' ? s.demand > 0 : s.stock > 0);
  const cortes = model.cortes.filter(matchFilter);
  const impressoes = model.impressoes.filter(matchFilter);
  const totals = model.totals;

  const toggle = (fn) => (k) => fn(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleCorte = toggle(setPickCorte);
  const toggleImpr = toggle(setPickImpr);

  const selCortes = cortes.filter(c => pickCorte.has(c.key));
  const selImpr = impressoes.filter(c => pickImpr.has(c.key));
  const selN = selCortes.length + selImpr.length;
  const canCreate = selN > 0;

  const createOrders = () => {
    const cMade = window.OrionDemand.createCorteOrders(selCortes);
    const iMade = window.OrionDemand.createImpressaoOrders(selImpr);
    setCreated({ cortes: cMade, impressoes: iMade });
    window.StockStore.toast(`${cMade.length} corte${cMade.length === 1 ? '' : 's'} · ${iMade.length} impress${iMade.length === 1 ? 'ão' : 'ões'} — criada${cMade.length + iMade.length === 1 ? '' : 's'}`);
    setModel(window.OrionDemand.build());
  };

  const empty = cortes.length === 0 && impressoes.length === 0;

  return (
    <div className="page">
      <PageHead sub="planejamento" title="Planejamento" titleEm="de produção"
                desc="Ordens de corte e impressão sugeridas pelo Orion."
                actions={<button className="btn" onClick={() => { setModel(window.OrionDemand.build()); setCreated(null); }}><Icon name="refresh-cw" size={14}/> Recalcular</button>}/>

      <HelpCard id="planejamento" icon="radar" tone="var(--brand-prod)" maxW={780} title="Como o Orion sugere produção">
        <HelpBody>
          Cada sugestão tem um motivo. <b style={{ color: 'var(--brand-sales)' }}>Demanda</b>: um pedido pede um SKU que falta no estoque acabado. <b style={{ color: 'var(--warn)' }}>Estoque baixo</b>: uma peça lisa ou impresso caiu abaixo do mínimo. A quantidade já desconta o que está em produção; ao criar, as ordens entram como <b>pendentes</b> no Corte e na Impressão.
        </HelpBody>
        <Flow accent="var(--brand-prod)" steps={[
          { icon: 'shopping-bag', label: 'Demanda', sub: 'pedidos & mínimo' },
          { icon: 'radar', label: 'Sugestões', sub: 'o Orion calcula', tone: 'accent' },
          { icon: 'check-circle-2', label: 'Você revisa', sub: 'ajusta a seleção' },
          { icon: 'scissors', label: 'Ordens', sub: 'corte & impressão', tone: 'ok' },
        ]}/>
      </HelpCard>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Seg value={filter} onChange={setFilter} options={[
          { value: 'all', label: `Tudo (${model.cortes.length + model.impressoes.length})` },
          { value: 'demanda', label: `Demanda (${totals.demandDriven})` },
          { value: 'estoque', label: `Estoque baixo (${totals.stockDriven})` },
        ]}/>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--ink-3)' }}>
          <b style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontSize: 15 }}>{totals.toCut}</b> peças a cortar · <b style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontSize: 15 }}>{totals.toPrint}</b> impressos a imprimir
        </span>
      </div>

      {empty ? (
        <div className="card"><div style={{ padding: '46px 16px' }}>
          <Empty icon="check-circle-2" title="Nada a produzir agora"
                 desc={filter === 'all' ? 'A demanda dos pedidos está coberta e nenhum tier está abaixo do mínimo.' : 'Nenhuma sugestão para este filtro.'}/>
        </div></div>
      ) : (
        <div className="grid g-cols-2">
          {/* ── Cortes ── */}
          <SuggestColumn icon="scissors" title="Cortes" count={cortes.length} total={cortes.reduce((a, c) => a + c.total, 0)} unit="peças">
            {cortes.map(c => {
              const on = pickCorte.has(c.key);
              return (
                <label key={c.key} style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 16px', borderTop: '1px solid var(--line-soft)', cursor: 'pointer', background: on ? 'color-mix(in oklab, var(--brand-prod) 5%, var(--surface))' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="checkbox" checked={on} onChange={() => toggleCorte(c.key)} style={{ width: 16, height: 16, accentColor: 'var(--brand-prod)', flexShrink: 0 }}/>
                    <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}>{garmentGlyph(c.garment, 19)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{c.base} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {c.color}</span></div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {c.gradeRows.map(g => (
                          <span key={g.size} className="num" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, padding: '2px 7px', borderRadius: 5, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', fontSize: 11, color: 'var(--ink-2)' }}>
                            <b style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{g.size}</b><span style={{ color: 'var(--ink-3)' }}>·</span>{g.qty}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--brand-prod)', lineHeight: 1 }}>{c.total}</div>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>a cortar</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 9, borderTop: '1px solid var(--line-soft)' }}>
                    {c.sources.map(s => <SourceBadge key={s} kind={s} detail={s === 'demanda' ? `${c.orders.length} ${c.orders.length === 1 ? 'pedido' : 'pedidos'}` : null}/>)}
                  </div>
                </label>
              );
            })}
          </SuggestColumn>

          {/* ── Impressões ── */}
          <SuggestColumn icon="printer" title="Impressões" count={impressoes.length} total={impressoes.reduce((a, c) => a + c.total, 0)} unit="impressos">
            {impressoes.map(im => {
              const on = pickImpr.has(im.key);
              return (
                <label key={im.key} style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 16px', borderTop: '1px solid var(--line-soft)', cursor: 'pointer', background: on ? 'color-mix(in oklab, var(--brand-prod) 5%, var(--surface))' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input type="checkbox" checked={on} onChange={() => toggleImpr(im.key)} style={{ width: 16, height: 16, accentColor: 'var(--brand-prod)', flexShrink: 0 }}/>
                    <PrintThumb tone={im.tone} size={36}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{im.code}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{im.name}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--brand-prod)', lineHeight: 1 }}>{im.total}</div>
                      <div style={{ fontSize: 9.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>a imprimir</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingTop: 9, borderTop: '1px solid var(--line-soft)' }}>
                    {im.sources.map(s => <SourceBadge key={s} kind={s} detail={s === 'demanda' ? `${im.orders.length} ${im.orders.length === 1 ? 'pedido' : 'pedidos'}` : null}/>)}
                    <PngBadge png={im.png}/>
                  </div>
                </label>
              );
            })}
          </SuggestColumn>
        </div>
      )}

      {/* action bar */}
      {!empty && (
        <div className="card" style={{ marginTop: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          background: canCreate ? 'color-mix(in oklab, var(--brand-prod) 6%, var(--surface))' : 'var(--surface)', borderColor: canCreate ? 'color-mix(in oklab, var(--brand-prod) 24%, var(--surface))' : 'var(--line)' }}>
          <Icon name="clipboard-check" size={18} style={{ color: 'var(--brand-prod)', flexShrink: 0 }}/>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 16 }}>{selCortes.length}</b> corte{selCortes.length === 1 ? '' : 's'} · <b style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 16 }}>{selImpr.length}</b> impress{selImpr.length === 1 ? 'ão' : 'ões'} selecionada{selN === 1 ? '' : 's'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexShrink: 0 }}>
            {created && <button className="btn btn-sm" onClick={() => setRoute('cutting')}><Icon name="arrow-up-right" size={13}/> Ver no Corte</button>}
            <button className="btn btn-primary" disabled={!canCreate} onClick={createOrders}>
              <Icon name="plus" size={14}/> Criar {selN} {selN === 1 ? 'ordem' : 'ordens'}
            </button>
          </span>
        </div>
      )}

      {created && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', marginTop: 14, borderRadius: 10, background: 'var(--ok-bg)', border: '1px solid color-mix(in oklab, var(--ok) 22%, var(--surface))', fontSize: 13, color: 'var(--ok)' }}>
          <Icon name="check-circle-2" size={16}/>
          <span>Ordens abertas como <b>pendentes</b> no Corte e na Impressão{created.cortes.length ? ` · ${created.cortes.join(', ')}` : ''}{created.impressoes.length ? ` · ${created.impressoes.join(', ')}` : ''}.</span>
        </div>
      )}
    </div>
  );
}

// Coluna de sugestões (Cortes / Impressões)
const SuggestColumn = ({ icon, title, count, total, unit, children }) => {
  const has = React.Children.count(children) > 0;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: 'color-mix(in oklab, var(--brand-prod) 12%, var(--surface))', color: 'var(--brand-prod)', flexShrink: 0 }}><Icon name={icon} size={15}/></span>
        <div className="card-title" style={{ fontSize: 14, flex: 1 }}>{title} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {count}</span></div>
        {has && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}><b style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontSize: 15 }}>{total}</b> {unit}</span>}
      </div>
      {has ? children : (
        <div style={{ padding: '30px 18px', textAlign: 'center', fontSize: 12.5, color: 'var(--ink-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Icon name="check" size={20} style={{ color: 'var(--ok)' }}/>
          Nada a produzir
        </div>
      )}
    </div>
  );
};

Object.assign(window, { Planejamento, GARMENT_TO_BASE });
