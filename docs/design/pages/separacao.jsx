// Pedidos — fulfillment workspace (Mapeamento / Separação-Checkout / Lotes)
// This file owns the tabbed shell + Separação tab + the Etiqueta print modal.
// Lotes & Mapeamento tabs live in pages/lotes.jsx (exported to window).

const FF = () => ORION_DATA.fulfillment;

// ───────── deterministic pseudo-random (for fake barcodes / QR / codes) ─────────
const ffHash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const ffRng = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pieceCode = (orderId, idx) => {
  const r = ffRng(ffHash(orderId + ':' + idx));
  let s = ''; for (let i = 0; i < 6; i++) s += Math.floor(r() * 36).toString(36).toUpperCase();
  return `${orderId}-${idx}-${s}`;
};

const FF_COLOR = { 'Preto': '#1f1f1f', 'Branco': '#f4f1ea', 'Off-white': '#efe6d3', 'Cru': '#e7dcc4', 'Marrom': '#7a4b2a', 'Areia': '#cfb98e', 'Verde': '#3a4a3d', 'Vermelho': '#b03a2e' };
const FF_TONE = { warm: ['#f4d9b8', '#c2410c'], sand: ['#efe6d3', '#a16207'], moss: ['#d6dfd0', '#3a4a3d'], bone: ['#f4f1ea', '#7a7160'], stone: ['#dfd9cd', '#57534e'] };

const orderPieces = (o) => o.items.reduce((a, i) => a + i.qty, 0);

// Flatten orders → one piece object per physical piece
const piecesFromOrders = (orders) => {
  const out = [];
  orders.forEach(o => {
    const total = orderPieces(o);
    let idx = 0;
    o.items.forEach(it => {
      for (let q = 0; q < it.qty; q++) {
        idx++;
        out.push({ orderId: o.id, estampa: it.estampa, product: it.product, garment: it.garment,
          color: it.color, size: it.size, sku: `${it.estampa}-${it.color}-${it.size}`,
          code: pieceCode(o.id, idx), index: idx, total });
      }
    });
  });
  return out;
};

// Synthesize pieces for a lote (uses real orders when present, else its estampa grid)
const piecesFromLote = (lote, orders) => {
  const real = (orders || []).filter(o => o.lote === lote.id);
  if (real.length) return piecesFromOrders(real);
  const out = [];
  lote.estampas.forEach(e => {
    const est = FF().estampas[e.code];
    for (let i = 0; i < e.items; i++) {
      const idx = out.length + 1;
      out.push({ orderId: lote.id, estampa: e.code, product: est ? est.name : ('Estampa ' + e.code),
        color: 'Preto', size: 'Unico', sku: `${e.code}-Preto-Unico`, code: pieceCode(lote.id, idx), index: idx, total: lote.pecas });
    }
  });
  return out;
};

// ───────── small visual primitives ─────────
const ColorDot = ({ color, size = 10 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: FF_COLOR[color] || '#999',
    border: '1px solid var(--line-soft)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)', flexShrink: 0 }}/>
);

const PlatformChip = ({ id }) => {
  const p = FF().platforms[id]; if (!p) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px',
      background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 999,
      fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
  );
};

const EstampaThumb = ({ code, size = 40 }) => {
  const est = FF().estampas[code];
  const [a, b] = FF_TONE[est?.tone] || FF_TONE.warm;
  return (
    <span style={{ width: size, height: size, borderRadius: 8, flexShrink: 0,
      background: `radial-gradient(circle at 30% 28%, ${a}, ${b})`, display: 'grid', placeItems: 'center',
      color: 'rgba(255,255,255,.92)' }}>
      <Icon name="palette" size={Math.round(size * 0.42)} strokeWidth={1.6}/>
    </span>
  );
};

// "🎨 2039" inline estampa tag
const EstampaTag = ({ code, muted }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: muted ? 'var(--ink-3)' : 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
    <Icon name="palette" size={11} style={{ color: 'var(--brand-catalog)' }}/>{code}
  </span>
);

// Fake scannable barcode (Code-128-ish bars)
const FakeBarcode = ({ seed, height = 22 }) => {
  const r = ffRng(ffHash('bc' + seed));
  const bars = Array.from({ length: 52 }, () => ({ w: 1 + Math.floor(r() * 3), on: r() > 0.4 }));
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 1, height }}>
      {bars.map((b, i) => <div key={i} style={{ width: b.w, background: b.on ? '#111' : 'transparent' }}/>)}
    </div>
  );
};

// Fake QR (with finder patterns)
const FakeQR = ({ seed, size = 104 }) => {
  const N = 25, r = ffRng(ffHash('qr' + seed)), cells = [];
  const inFinder = (x, y) => { const f = (cx, cy) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7; return f(0, 0) || f(N - 7, 0) || f(0, N - 7); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (inFinder(x, y)) continue; if (r() > 0.52) cells.push(<rect key={x + '_' + y} x={x} y={y} width={1} height={1} fill="#111"/>); }
  const finder = (cx, cy) => (
    <g key={cx + '-' + cy}>
      <rect x={cx} y={cy} width={7} height={7} fill="#111"/>
      <rect x={cx + 1} y={cy + 1} width={5} height={5} fill="#fff"/>
      <rect x={cx + 2} y={cy + 2} width={3} height={3} fill="#111"/>
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" style={{ display: 'block' }}>
      <rect x={0} y={0} width={N} height={N} fill="#fff"/>
      {cells}{finder(0, 0)}{finder(N - 7, 0)}{finder(0, N - 7)}
    </svg>
  );
};

// ───────── the printed label (100×50mm preview) ─────────
const EtiquetaCard = ({ piece }) => (
  <div style={{ width: '100%', maxWidth: 480, aspectRatio: '2 / 1', background: '#fff', border: '1px solid var(--line)',
    borderRadius: 10, padding: '13px 15px', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-sm)' }}>
    <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 9, letterSpacing: '.12em', color: '#9a9a92', fontWeight: 700 }}>PEDIDO</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 23, color: '#111', lineHeight: 1.04, letterSpacing: '-.01em' }}>{piece.orderId}</div>
        <div style={{ margin: '5px 0 7px' }}><FakeBarcode seed={piece.orderId} height={18}/></div>
        <div style={{ fontSize: 11, color: '#222', lineHeight: 1.3, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{piece.product}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', background: '#f0ede6', borderRadius: 5, fontSize: 11.5, color: '#222', fontWeight: 500 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: FF_COLOR[piece.color] || '#999', border: '1px solid rgba(0,0,0,.18)' }}/>{piece.color}
          </span>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>{piece.size}</span>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: '#333' }}>
          <Icon name="palette" size={12} style={{ color: '#6b6b63' }}/> <b style={{ fontWeight: 600 }}>{piece.estampa}</b>
          <span style={{ color: '#9a9a92' }}>({piece.size === 'Unico' ? 'Unico' : piece.color})</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <FakeQR seed={piece.code} size={104}/>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#9a9a92', letterSpacing: '.02em' }}>{piece.code}</div>
      </div>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#9a9a92' }}>SKU {piece.sku}</span>
      <span style={{ fontSize: 11.5, color: '#111', fontWeight: 700 }}>Item {piece.index}/{piece.total}</span>
    </div>
  </div>
);

// ───────── Etiqueta print modal ─────────
const EtiquetaModal = ({ open, onClose, pieces = [], onConfirm }) => {
  if (!open) return null;
  const n = pieces.length;
  const first = pieces[0];
  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="tag" size={16}/></span>
          <span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.15 }}>Etiquetas de Separação — 100×50mm</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400, marginTop: 1 }}>{n} etiqueta{n === 1 ? '' : 's'} (1 por peça)</div>
          </span>
        </span>
      }
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={n === 0} onClick={() => { onConfirm && onConfirm(pieces); onClose(); }}>
          <Icon name="printer" size={14}/> Imprimir {n} Etiqueta{n === 1 ? '' : 's'}
        </button>
      </>}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Preview da primeira etiqueta</div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 22, display: 'grid', placeItems: 'center', marginBottom: 16 }}>
        {first ? <EtiquetaCard piece={first}/> : <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 30 }}>Nenhuma peça selecionada.</div>}
      </div>
      <div style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in oklab, var(--accent) 22%, var(--surface))', borderRadius: 10, padding: '14px 16px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--accent-edge)', fontWeight: 600, marginBottom: 7 }}><Icon name="clipboard-list" size={14}/> Como usar:</div>
        <div style={{ marginBottom: 5 }}><b style={{ fontWeight: 600 }}>1)</b> Imprima e cole 1 etiqueta em cada peça durante separação/prensa.</div>
        <div style={{ marginBottom: 7 }}><b style={{ fontWeight: 600 }}>2)</b> No checkout, bipe o QR de cada etiqueta. Quando todos os itens do pedido forem bipados, libere a etiqueta de envio.</div>
        <div style={{ display: 'flex', gap: 7 }}><Icon name="settings" size={13} style={{ marginTop: 2, flexShrink: 0 }}/><span>No Chrome: papel <b style={{ fontWeight: 600 }}>100×50mm</b>, margens <b style={{ fontWeight: 600 }}>Nenhuma</b>, escala <b style={{ fontWeight: 600 }}>100%</b>.</span></div>
      </div>
    </Modal>
  );
};

// ───────── Separação / Checkout tab ─────────
const SeparacaoTab = ({ orders, onCreateLote, openEtiquetas }) => {
  const store = useStock();
  const stockV = store.version();
  const [search, setSearch] = React.useState('');
  const [impF, setImpF] = React.useState('all');
  const [statusF, setStatusF] = React.useState('all');
  const [platF, setPlatF] = React.useState('all');
  const [loteF, setLoteF] = React.useState('sem');
  const [prontoF, setProntoF] = React.useState('all');
  const [estF, setEstF] = React.useState('all');
  const [ordem, setOrdem] = React.useState('id');
  const [showMore, setShowMore] = React.useState(false);
  const [sel, setSel] = React.useState(() => new Set());
  const [exp, setExp] = React.useState(() => new Set());

  const advCount = [impF, platF, estF].filter(v => v !== 'all').length + (ordem !== 'id' ? 1 : 0);

  const estampaOpts = Object.values(FF().estampas);

  const rows = React.useMemo(() => {
    const ready = (o) => window.OrionDemand && window.OrionDemand.orderReady(o);
    let r = orders.filter(o => {
      if (loteF === 'sem' && o.lote) return false;
      if (loteF === 'em' && !o.lote) return false;
      if (prontoF === 'pronto' && !ready(o)) return false;
      if (prontoF === 'aguarda' && ready(o)) return false;
      if (impF !== 'all' && o.importId !== impF) return false;
      if (statusF !== 'all' && o.status !== statusF) return false;
      if (platF !== 'all' && o.platform !== platF) return false;
      if (estF !== 'all' && !o.items.some(it => it.estampa === estF)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit = o.id.toLowerCase().includes(q) || o.items.some(it =>
          it.product.toLowerCase().includes(q) || it.estampa.includes(q) || `${it.estampa}-${it.color}-${it.size}`.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
    const cmp = { id: (a, b) => a.id.localeCompare(b.id), pecas: (a, b) => orderPieces(b) - orderPieces(a),
      status: (a, b) => a.status.localeCompare(b.status) };
    return r.slice().sort(cmp[ordem] || cmp.id);
  }, [orders, loteF, prontoF, impF, statusF, platF, estF, search, ordem, stockV]);

  // keep selection within visible set
  const visIds = rows.map(r => r.id);
  const selVisible = visIds.filter(id => sel.has(id));
  const selOrders = orders.filter(o => sel.has(o.id));
  const selPieces = selOrders.reduce((s, o) => s + orderPieces(o), 0);
  const allSelected = rows.length > 0 && selVisible.length === rows.length;
  const allExpanded = rows.length > 0 && rows.every(r => exp.has(r.id));

  const toggleSel = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleExp = (id) => setExp(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSel(allSelected ? new Set() : new Set(visIds));
  const expandAll = () => setExp(allExpanded ? new Set() : new Set(visIds));
  const selectPending = () => setSel(new Set(rows.filter(r => r.status === 'a_imprimir').map(r => r.id)));

  const Sel = ({ value, onChange, options, w }) => (
    <div style={{ flex: w || '1 1 180px', minWidth: 150 }}>
      <Select value={value} onChange={onChange} options={options} searchable={options.length > 6}/>
    </div>
  );

  const hasSel = sel.size > 0;

  return (
    <div>
      <HelpCard id="separacao" icon="package" tone="var(--brand-sales)" maxW={720} title="Separação — de pedido vinculado a peça com etiqueta">
        <HelpBody>
          Pedidos já vinculados viram uma <b>lista de separação</b>. Para cada peça o Orion gera uma <b>etiqueta</b> com a estampa, cor e tamanho certos — você imprime, separa na prateleira e <b>bipa</b>. Peças conferidas seguem para o <b>checkout</b> e podem virar um lote de expedição.
        </HelpBody>
        <Flow accent="var(--brand-sales)" steps={[
          { icon: 'check-circle-2', label: 'Vinculado', sub: 'pronto p/ separar' },
          { icon: 'tag', label: 'Etiqueta', sub: 'estampa · cor · tam', tone: 'accent' },
          { icon: 'scan-line', label: 'Separar', sub: 'e bipar' },
          { icon: 'package-check', label: 'Checkout', sub: 'pronto p/ expedir', tone: 'ok' },
        ]}/>
      </HelpCard>
      {/* Filtros — linha principal + disclosure */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '3 1 280px', minWidth: 200 }}><SearchInput placeholder="Buscar pedido, título, SKU…" value={search} onChange={setSearch}/></div>
          <Sel value={loteF} onChange={setLoteF} options={[{ value: 'sem', label: 'Sem lote (disponíveis)' }, { value: 'em', label: 'Em lote' }, { value: 'all', label: 'Todos os pedidos' }]}/>
          <Sel value={prontoF} onChange={setProntoF} options={[{ value: 'all', label: 'Toda a separação' }, { value: 'pronto', label: 'Prontos p/ separar' }, { value: 'aguarda', label: 'Aguardando montagem' }]}/>
          <Sel value={statusF} onChange={setStatusF} options={[{ value: 'all', label: 'Todos os status' }, { value: 'a_imprimir', label: 'A imprimir' }, { value: 'impresso', label: 'Impresso' }, { value: 'conferido', label: 'Conferido' }]}/>
          <button className="btn" onClick={() => setShowMore(v => !v)} style={{ flexShrink: 0 }}>
            <Icon name="sliders-horizontal" size={14}/> Mais filtros
            {advCount > 0 && <span style={{ marginLeft: 2, minWidth: 17, height: 17, padding: '0 5px', borderRadius: 999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, display: 'inline-grid', placeItems: 'center' }}>{advCount}</span>}
            <Icon name="chevron-down" size={13} style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: 'var(--ink-3)' }}/>
          </button>
        </div>
        {showMore && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
            <Sel value={impF} onChange={setImpF} options={[{ value: 'all', label: 'Todas as importações' }, ...FF().imports.map(i => ({ value: i.id, label: `Importação ${i.label}`, sub: `${i.count} pedidos` }))]}/>
            <Sel value={platF} onChange={setPlatF} options={[{ value: 'all', label: 'Todas as plataformas' }, ...Object.values(FF().platforms).map(p => ({ value: p.id, label: p.name }))]}/>
            <Sel value={estF} onChange={setEstF} options={[{ value: 'all', label: 'Todas as estampas / SKUs' }, ...estampaOpts.map(e => ({ value: e.code, label: `${e.code} · ${e.name}` }))]}/>
            <Sel value={ordem} onChange={setOrdem} options={[{ value: 'id', label: 'Ordem: nº do pedido' }, { value: 'pecas', label: 'Ordem: mais peças' }, { value: 'status', label: 'Ordem: status' }]}/>
          </div>
        )}
      </div>

      {/* Barra de seleção — esquerda: seleção + contagem · direita: ações */}
      <div className="card" style={{ marginBottom: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        background: hasSel ? 'var(--accent-soft)' : 'var(--surface)', borderColor: hasSel ? 'color-mix(in oklab, var(--accent) 22%, var(--surface))' : 'var(--line)', transition: 'background .15s' }}>
        <button className="btn btn-sm" onClick={selectAll}>{allSelected ? 'Limpar' : 'Selecionar todos'}</button>
        <button className="btn btn-sm" onClick={expandAll}>{allExpanded ? 'Recolher' : 'Expandir todos'}</button>
        <span style={{ width: 1, height: 22, background: 'var(--line)', flexShrink: 0 }}/>
        {hasSel ? (
          <span style={{ fontSize: 13, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
            <b style={{ fontWeight: 700 }}>{sel.size}</b> {sel.size === 1 ? 'selecionado' : 'selecionados'} · <b style={{ fontWeight: 700 }}>{selPieces}</b> {selPieces === 1 ? 'peça' : 'peças'}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
            <b style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{rows.length}</b> {rows.length === 1 ? 'pedido' : 'pedidos'} · <b style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{rows.reduce((s, o) => s + orderPieces(o), 0)}</b> peças
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 4, color: 'var(--accent)' }} onClick={selectPending}>Selecionar pendentes</button>
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-sm" disabled={!hasSel} onClick={() => openEtiquetas(piecesFromOrders(selOrders))}>
            <Icon name="printer" size={14}/> Imprimir etiquetas
          </button>
          <button className="btn btn-primary btn-sm" disabled={!hasSel} onClick={() => onCreateLote([...sel])}>
            <Icon name="layers" size={14}/> Criar Lote{hasSel ? ` (${sel.size})` : ''}
          </button>
        </span>
      </div>

      {/* Lista de pedidos */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <Empty icon="package-check" title="Nenhum pedido disponível"
            desc={loteF === 'sem' ? 'Todos os pedidos deste filtro já estão em um lote. Ajuste os filtros ou veja a aba Lotes.' : 'Tente ajustar os filtros acima.'}/>
        ) : rows.map((o, i) => {
          const isSel = sel.has(o.id), isExp = exp.has(o.id);
          const prods = o.items.length, pcs = orderPieces(o);
          return (
            <div key={o.id} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--line-soft)' : 'none', background: isSel ? 'var(--accent-soft)' : 'transparent', transition: 'background .12s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px' }}>
                <input type="checkbox" checked={isSel} onChange={() => toggleSel(o.id)}
                  style={{ width: 17, height: 17, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}/>
                <button onClick={() => toggleExp(o.id)} title={isExp ? 'Recolher' : 'Expandir itens'}
                  style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--ink-3)', flexShrink: 0, borderRadius: 5 }}>
                  <Icon name="chevron-right" size={15} style={{ transform: isExp ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}/>
                </button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14.5, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>{o.id}</span>
                <PlatformChip id={o.platform}/>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{prods} {prods === 1 ? 'produto' : 'produtos'} · {pcs} {pcs === 1 ? 'peça' : 'peças'}</span>
                {o.lote && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}><Icon name="layers" size={11}/> {o.lote}</span>}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {window.OrionDemand && window.OrionDemand.orderReady(o) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: 'var(--ok)', background: 'var(--ok-bg)', border: '1px solid color-mix(in oklab, var(--ok) 24%, var(--surface))', whiteSpace: 'nowrap' }}>
                      <Icon name="package-check" size={11}/> Pronto p/ separar
                    </span>
                  )}
                  <StatusPill s={o.status}/>
                  <button onClick={() => openEtiquetas(piecesFromOrders([o]))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
                      border: '1px solid color-mix(in oklab, var(--accent) 25%, var(--surface))', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    <Icon name="tag" size={13}/> Etiquetas
                  </button>
                </span>
              </div>
              {isExp && (
                <div style={{ padding: '0 16px 14px 62px', display: 'grid', gap: 8 }}>
                  {o.items.map((it, k) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 8 }}>
                      <EstampaThumb code={it.estampa} size={36}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                          <EstampaTag code={it.estampa}/>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-2)' }}><ColorDot color={it.color}/> {it.color}</span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', padding: '1px 5px', border: '1px solid var(--line-soft)', borderRadius: 3 }}>{it.size}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{it.estampa}-{it.color}-{it.size}</span>
                        </div>
                      </div>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', fontSize: 13, flexShrink: 0 }}>×{it.qty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ───────── Order-lifecycle board: Mapeamento → Produção → Separação → Envio ─────────
const uniqueEstampas = (o) => [...new Set(o.items.map(it => it.estampa))];

// per-order SKU readiness: how many item lines are already in finished stock
const orderSkuStatus = (o) => {
  let ready = 0;
  o.items.forEach(it => {
    const blank = window.OrionDemand && window.OrionDemand.blankFor(it.garment, it.color, it.size);
    const sku = blank && window.StockStore && window.StockStore.skuFor(blank, it.estampa);
    const row = sku && ORION_DATA.stock.find(s => s.sku === sku);
    if (row && row.count >= it.qty) ready++;
  });
  return { ready, total: o.items.length };
};

// which lifecycle column an order belongs to
const orderStage = (o, unmapped) => {
  if (unmapped.has(o.id)) return 'mapeamento';
  if (o.lote) return 'envio';
  if (window.OrionDemand && window.OrionDemand.orderReady(o)) return 'separacao';
  return 'producao';
};

// app "today" (the data world is June 2026) → order age in days from its import
const PED_TODAY = new Date(2026, 5, 9);
const orderAgeDays = (o) => {
  const imp = FF().imports.find(i => i.id === o.importId);
  const m = imp && (imp.label || '').match(/(\d{2})\/(\d{2})/);
  if (!m) return null;
  const d = new Date(2026, +m[2] - 1, +m[1]);
  return Math.max(0, Math.floor((PED_TODAY - d) / 86400000));
};
const orderAgeLabel = (o) => { const d = orderAgeDays(o); if (d == null) return ''; return d === 0 ? 'hoje' : `há ${d}d`; };

const OrderCard = ({ o, stage, selected, onToggleSel, onOpen, onEtiquetas, onVincular }) => {
  const stop = (e) => e.stopPropagation();
  const age = orderAgeLabel(o);
  const old = orderAgeDays(o) >= 5;
  const st = orderSkuStatus(o);
  const pct = st.total ? (st.ready / st.total) * 100 : 0;
  const full = st.ready >= st.total;
  const action = stage === 'mapeamento' ? { label: 'Vincular', icon: 'git-merge', fn: () => onVincular(o) }
               : stage === 'separacao'  ? { label: 'Imprimir etiquetas', icon: 'tag', fn: () => onEtiquetas([o]) }
               : null;
  return (
    <div onClick={() => onOpen(o)}
      style={{ background: 'var(--bg)', border: `1px solid ${selected ? 'var(--accent)' : 'var(--line-soft)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', overflow: 'hidden',
        boxShadow: selected ? '0 0 0 1px var(--accent)' : 'none', transition: 'border-color .12s, box-shadow .12s' }}>
      <div style={{ padding: '9px 10px' }}>
        {/* linha 1: itens cumpridos / total + ID no canto direito */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {stage === 'separacao' && (
            <input type="checkbox" checked={selected} onClick={stop} onChange={() => onToggleSel(o.id)}
              style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}/>
          )}
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
            <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)' }}>
              <b style={{ color: full ? 'var(--ok)' : 'var(--ink)', fontWeight: 600 }}>{st.ready}</b>/{st.total}
            </span> {st.total === 1 ? 'item' : 'itens'}
          </span>
          <span className="mono" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{o.id}</span>
        </div>

        {/* linha 2: barra de progresso (itens cumpridos) */}
        <div style={{ height: 5, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden', marginTop: 7 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: full ? 'var(--ok)' : 'var(--brand-prod)', borderRadius: 999, transition: 'width .25s' }}/>
        </div>

        {/* linha 3: metadados — plataforma · idade */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <PlatformChip id={o.platform}/>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: old ? 'var(--warn)' : 'var(--ink-3)', fontWeight: old ? 600 : 400, whiteSpace: 'nowrap' }}>{age}</span>
        </div>
      </div>

      {/* rodapé: ação full-width integrada */}
      {action && (
        <button className="card-foot-btn" onClick={(e) => { stop(e); action.fn(); }}>
          <Icon name={action.icon} size={13}/> {action.label}
        </button>
      )}
    </div>
  );
};

const LoteCard = ({ l, onOpen }) => {
  const done = l.status !== 'aberto';
  const dateStr = (l.created || '').split('·')[0].trim();
  return (
    <div onClick={() => onOpen(l.id)} style={{ background: 'var(--bg)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)', padding: 12, cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <LoteGlyph status={done ? 'despachado' : 'aberto'} size={32}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink)' }}>{l.num}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500,
              color: done ? 'var(--ok)' : 'var(--ink-2)', background: done ? 'var(--ok-bg)' : 'var(--surface-2)',
              border: `1px solid ${done ? 'color-mix(in oklab, var(--ok) 24%, var(--surface))' : 'var(--line)'}` }}>
              <Icon name={done ? 'check-circle-2' : 'circle-dashed'} size={11}/> {done ? 'Concluído' : 'Aberto'}
            </span>
          </div>
          <div className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.id}</div>
        </div>
        <Icon name="chevron-right" size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap' }}>
        {done ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ok)', fontWeight: 500 }}>
            <Icon name="calendar-check" size={13}/> Concluído em {dateStr}
          </span>
        ) : (
          <>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}><b style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontSize: 14 }}>{l.pedidos}</b> pedidos</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}><b style={{ color: 'var(--ink-2)', fontFamily: 'var(--font-display)', fontSize: 14 }}>{l.pecas}</b> peças</span>
          </>
        )}
      </div>
    </div>
  );
};

const BoardColumn = ({ label, icon, sub, color, count, children, headerExtra }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 12, minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 7, background: `color-mix(in oklab, ${color} 15%, var(--surface))`, color, flexShrink: 0 }}>
          <Icon name={icon} size={14} strokeWidth={1.8}/>
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{count}</span>
      </div>
      {headerExtra}
    </div>
    <div style={{ display: 'grid', gap: 8, minHeight: 40 }}>{children}</div>
  </div>
);

const PedidosBoard = ({ orders, lotes, unmapped, sel, onToggleSel, onConfirmMap, onVincular, onOpenOrder, onEtiquetas, onCreateLote, onOpenLote }) => {
  const byStage = { mapeamento: [], producao: [], separacao: [] };
  orders.forEach(o => { const st = orderStage(o, unmapped); if (st !== 'envio') byStage[st].push(o); });
  const selCount = byStage.separacao.filter(o => sel.has(o.id)).length;
  const sortedLotes = lotes.slice().sort((a, b) => b.num - a.num);

  const colEmpty = (txt) => <div style={{ padding: '22px 12px', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>{txt}</div>;

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 6, margin: '0 -2px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(228px, 1fr))', gap: 12, alignItems: 'start' }}>
      <BoardColumn label="Mapeamento" icon="git-merge" color="var(--brand-sales)" count={byStage.mapeamento.length}>
        {byStage.mapeamento.length ? byStage.mapeamento.map(o => (
          <OrderCard key={o.id} o={o} stage="mapeamento" onOpen={onOpenOrder} onVincular={onVincular}/>
        )) : colEmpty('Tudo vinculado.')}
      </BoardColumn>

      <BoardColumn label="Produção" icon="factory" color="var(--brand-prod)" count={byStage.producao.length}>
        {byStage.producao.length ? byStage.producao.map(o => (
          <OrderCard key={o.id} o={o} stage="producao" onOpen={onOpenOrder}/>
        )) : colEmpty('Nada em produção.')}
      </BoardColumn>

      <BoardColumn label="Separação" icon="package-check" color="var(--ok)" count={byStage.separacao.length}
        headerExtra={selCount > 0 && (
          <button className="btn btn-primary btn-sm" onClick={() => onCreateLote([...sel].filter(id => byStage.separacao.some(o => o.id === id)))}>
            <Icon name="layers" size={12}/> Lote ({selCount})
          </button>
        )}>
        {byStage.separacao.length ? byStage.separacao.map(o => (
          <OrderCard key={o.id} o={o} stage="separacao" selected={sel.has(o.id)} onToggleSel={onToggleSel} onOpen={onOpenOrder} onEtiquetas={onEtiquetas}/>
        )) : colEmpty('Nenhum pedido pronto. Conclua a montagem.')}
      </BoardColumn>

      <BoardColumn label="Envio" icon="truck" color="var(--brand-inv)" count={sortedLotes.length}>
        {sortedLotes.length ? sortedLotes.map(l => <LoteCard key={l.id} l={l} onOpen={onOpenLote}/>) : colEmpty('Nenhum lote ainda.')}
      </BoardColumn>
      </div>
    </div>
  );
};

// ───────── Order detail sheet — jornada de cada item pelo pipeline ─────────
const JOURNEY = [
  { label: 'Mapeado',   icon: 'git-merge' },
  { label: 'Produzido', icon: 'factory' },
  { label: 'Separado',  icon: 'package-check' },
  { label: 'Enviado',   icon: 'truck' },
];
const ItemJourney = ({ done }) => {
  const current = done.indexOf(false);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 11 }}>
      {JOURNEY.map((st, i) => {
        const isDone = done[i];
        const isCurrent = i === current;
        const color = isDone ? 'var(--ok)' : isCurrent ? 'var(--brand-prod)' : 'var(--ink-3)';
        const bg = isDone ? 'var(--ok-bg)' : isCurrent ? 'color-mix(in oklab, var(--brand-prod) 12%, var(--surface))' : 'var(--surface-2)';
        return (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, width: 60 }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: bg, color,
                border: `1px solid color-mix(in oklab, ${color} 28%, var(--surface))` }}>
                <Icon name={isDone ? 'check' : st.icon} size={15} strokeWidth={isDone ? 2.4 : 1.8}/>
              </span>
              <span style={{ fontSize: 10, fontWeight: isDone || isCurrent ? 600 : 400, color: isDone ? 'var(--ok)' : isCurrent ? 'var(--ink)' : 'var(--ink-3)', textAlign: 'center', whiteSpace: 'nowrap' }}>{st.label}</span>
            </div>
            {i < JOURNEY.length - 1 && (
              <div style={{ flex: 1, height: 2, background: isDone ? 'var(--ok)' : 'var(--line)', marginTop: 14, borderRadius: 999 }}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const OrderDetailSheet = ({ order, unmapped, lotes, onClose, onEtiquetas, onConfirmMap }) => {
  if (!order) return null;
  const o = order;
  const isUnmapped = unmapped.has(o.id);
  const lote = o.lote && (lotes || []).find(l => l.id === o.lote);
  const separated = !!o.lote;
  const sent = !!(lote && lote.status === 'despachado');
  return (
    <Sheet open={!!order} onClose={onClose}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{o.id}</span><PlatformChip id={o.platform}/></span>}
      footer={<>
        <button className="btn" onClick={onClose}>Fechar</button>
        {isUnmapped
          ? <button className="btn btn-primary" onClick={() => { onConfirmMap(o.id); onClose(); }}><Icon name="git-merge" size={13}/> Vincular pedido</button>
          : <button className="btn btn-primary" onClick={() => { onEtiquetas([o]); }}><Icon name="tag" size={13}/> Imprimir etiquetas</button>}
      </>}>
      <div style={{ display: 'grid', gap: 10 }}>
        {o.items.map((it, k) => {
          const blank = window.OrionDemand && window.OrionDemand.blankFor(it.garment, it.color, it.size);
          const sku = blank && window.StockStore && window.StockStore.skuFor(blank, it.estampa);
          const row = sku && ORION_DATA.stock.find(s => s.sku === sku);
          const produced = !!(row && row.count >= it.qty);
          const done = [!isUnmapped, produced, separated, sent];
          return (
            <div key={k} style={{ padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <EstampaThumb code={it.estampa} size={38}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 3, flexWrap: 'wrap' }}>
                    <EstampaTag code={it.estampa}/>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-2)' }}><ColorDot color={it.color}/> {it.color} · {it.size}</span>
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>×{it.qty}</span>
              </div>
              <ItemJourney done={done}/>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
};

// ───────── Vincular drawer: escolher manualmente o SKU interno de cada item ─────────
const COLOR_CODE_V = { 'Preto': 'PRT', 'Branco': 'BCO', 'Off-white': 'OFF', 'Cru': 'CRU', 'Areia': 'ARE', 'Verde': 'VRD', 'Vermelho': 'VRM', 'Bege': 'BEG', 'Marrom': 'MAR' };
const skuOf = (code, color, size) => `${code}-${COLOR_CODE_V[color] || 'COR'}-${String(size).toUpperCase()}`;
const itemSkuOptions = (it) => {
  const cat = FF().catalogProducts;
  const match = cat.filter(p => p.estampa === it.estampa);
  const rest = cat.filter(p => p.estampa !== it.estampa);
  const opts = [];
  [...match, ...rest].forEach(p => p.colors.forEach(c => p.sizes.forEach(s => opts.push({ value: skuOf(p.code, c, s), label: `${p.name} · ${c} · ${s}`, sub: skuOf(p.code, c, s) }))));
  return opts;
};
const suggestItemSku = (it) => {
  const cat = FF().catalogProducts;
  const base = GARMENT_TO_BASE[it.garment];
  const p = cat.find(x => x.estampa === it.estampa && GARMENT_TO_BASE[x.garment] === base) || cat.find(x => x.estampa === it.estampa);
  if (!p) return null;
  const color = p.colors.find(c => c.toLowerCase() === String(it.color).toLowerCase()) || p.colors[0];
  const size = p.sizes.find(s => s.toLowerCase() === String(it.size).toLowerCase()) || p.sizes[0];
  return { sku: skuOf(p.code, color, size), label: `${p.name} · ${color} · ${size}` };
};

const VincularSheet = ({ order, onConfirm, onClose }) => {
  const [sel, setSel] = React.useState({});
  React.useEffect(() => { if (order) setSel({}); }, [order && order.id]);
  if (!order) return null;
  const o = order;
  const allSet = o.items.every((_, k) => !!sel[k]);
  const pickedCount = o.items.filter((_, k) => !!sel[k]).length;
  return (
    <Sheet open={!!order} onClose={onClose}
      title={<span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span className="mono" style={{ fontFamily: 'var(--font-mono)' }}>{o.id}</span><PlatformChip id={o.platform}/></span>}
      sub={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Escolha o SKU interno de cada item — {pickedCount}/{o.items.length} vinculados</span>}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!allSet} onClick={() => onConfirm(o.id)}><Icon name="check" size={13}/> Vincular pedido</button>
      </>}>
      <div style={{ display: 'grid', gap: 12 }}>
        {o.items.map((it, k) => {
          const opts = itemSkuOptions(it);
          const sugg = suggestItemSku(it);
          const picked = !!sel[k];
          return (
            <div key={k} style={{ border: `1px solid ${picked ? 'color-mix(in oklab, var(--ok) 30%, var(--surface))' : 'var(--line)'}`, borderRadius: 10, padding: 12, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <EstampaThumb code={it.estampa} size={38}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 3, flexWrap: 'wrap' }}>
                    <EstampaTag code={it.estampa}/>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--ink-2)' }}><ColorDot color={it.color}/> {it.color} · {it.size}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>×{it.qty}</span>
                  </div>
                </div>
                {picked
                  ? <Icon name="check-circle-2" size={18} style={{ color: 'var(--ok)', flexShrink: 0 }}/>
                  : <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid color-mix(in oklab, var(--warn) 24%, var(--surface))', padding: '2px 8px', borderRadius: 999 }}>a vincular</span>}
              </div>
              <div style={{ marginTop: 10 }} className="vinc-select">
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600, marginBottom: 6 }}>SKU interno</div>
                <Select searchable value={sel[k] || ''} placeholder="Escolher SKU…" options={opts} onChange={(v) => setSel(s => ({ ...s, [k]: v }))}/>
                {sugg && sel[k] !== sugg.sku && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
                    <Icon name="sparkles" size={12} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                    <span style={{ minWidth: 0 }}>Sugestão: <b style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{sugg.label}</b></span>
                    <button className="btn btn-sm" style={{ marginLeft: 'auto', color: 'var(--accent)', borderColor: 'color-mix(in oklab, var(--accent) 30%, var(--surface))', background: 'var(--accent-soft)' }} onClick={() => setSel(s => ({ ...s, [k]: sugg.sku }))}>Usar</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
};

// ───────── Pedidos shell (board + shared state) ─────────
function Pedidos({ setRoute }) {
  const store = useStock();
  const [view, setView] = React.useState('quadro');
  const [orders, setOrders] = React.useState(() => JSON.parse(JSON.stringify(FF().orders)));
  const [unmapped, setUnmapped] = React.useState(() => new Set(
    FF().orders.filter(o => o.items.some(it => { const e = FF().estampas[it.estampa]; return e && e.png === 'pendente'; })).map(o => o.id)
  ));
  const [sel, setSel] = React.useState(() => new Set());
  const [openOrder, setOpenOrder] = React.useState(null);
  const [vincOrder, setVincOrder] = React.useState(null);
  const [lotes, setLotes] = React.useState(() => JSON.parse(JSON.stringify(FF().lotes)));
  const [openLoteId, setOpenLoteId] = React.useState(null);
  const [etq, setEtq] = React.useState({ open: false, pieces: [] });
  const [toast, setToast] = React.useState(null);
  const toastT = React.useRef(null);

  const showToast = (msg) => { setToast(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2800); };
  const openEtiquetas = (pieces) => setEtq({ open: true, pieces });
  const confirmPrint = (pieces) => {
    const ids = new Set(pieces.map(p => p.orderId));
    setOrders(os => os.map(o => ids.has(o.id) && o.status === 'a_imprimir' ? { ...o, status: 'impresso' } : o));
    showToast(`${pieces.length} etiqueta${pieces.length === 1 ? '' : 's'} enviada${pieces.length === 1 ? '' : 's'} para impressão`);
  };

  const createLote = (orderIds) => {
    const selO = orders.filter(o => orderIds.includes(o.id));
    if (!selO.length) return;
    const pecas = selO.reduce((s, o) => s + orderPieces(o), 0);
    const byEst = {};
    selO.forEach(o => o.items.forEach(it => {
      byEst[it.estampa] = byEst[it.estampa] || { code: it.estampa, items: 0, toPrint: 0, montado: false, enviado: false };
      byEst[it.estampa].items += it.qty; byEst[it.estampa].toPrint += it.qty;
    }));
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const id = `LOTE-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${Math.floor(1000 + Math.random() * 9000)}`;
    const num = Math.max(0, ...lotes.map(l => l.num)) + 1;
    const lote = { id, num, status: 'aberto', created: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      pedidos: selO.length, pecas, estampas: Object.values(byEst) };
    setLotes(ls => [lote, ...ls]);
    setOrders(os => os.map(o => orderIds.includes(o.id) ? { ...o, lote: id } : o));
    setOpenLoteId(id); setSel(new Set());
    showToast(`${lote.id} criado · ${selO.length} pedido${selO.length === 1 ? '' : 's'}`);
  };

  const confirmMap = (orderId) => {
    setUnmapped(s => { const n = new Set(s); n.delete(orderId); return n; });
    showToast(`Pedido ${orderId} vinculado — segue para produção`);
  };
  const toggleSel = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const etqFromOrders = (arr) => openEtiquetas(piecesFromOrders(arr));

  const removeFromLote = (loteId, orderId) => {
    const o = orders.find(x => x.id === orderId); if (!o) return;
    const pcs = orderPieces(o);
    setOrders(os => os.map(x => x.id === orderId ? { ...x, lote: null } : x));
    setLotes(ls => ls.map(l => {
      if (l.id !== loteId) return l;
      const est = l.estampas.map(e => ({ ...e }));
      o.items.forEach(it => { const f = est.find(e => e.code === it.estampa); if (f) { f.items = Math.max(0, f.items - it.qty); f.toPrint = Math.max(0, f.toPrint - it.qty); } });
      return { ...l, pedidos: Math.max(0, l.pedidos - 1), pecas: Math.max(0, l.pecas - pcs), estampas: est.filter(e => e.items > 0) };
    }));
    showToast(`Pedido ${orderId} devolvido à separação`);
  };

  const current = lotes.find(l => l.id === openLoteId);

  return (
    <div className="page">
      {current ? (
        React.createElement(window.LoteDetail, { lote: current, orders, onBack: () => setOpenLoteId(null), setLotes, openEtiquetas, removeFromLote, showToast })
      ) : (
        <>
          <PageHead sub="orders" title="Pedidos" titleEm="& expedição"
            desc="Do mapeamento ao despacho."
            actions={<Seg value={view} onChange={setView} options={[{ value: 'quadro', label: 'Quadro' }, { value: 'tabela', label: 'Tabela' }]}/>}/>

          {view === 'quadro' && (
            <>
              <HelpCard id="pedidos-board" icon="layout-grid" tone="var(--brand-sales)" maxW={780} title="Pedidos — do mapeamento ao envio">
                <HelpBody>
                  Cada <b>pedido</b> avança por quatro etapas. Em <b>Mapeamento</b> o item do anúncio é vinculado ao SKU interno; em <b>Produção</b> ele espera a montagem dos SKUs; em <b>Separação</b>, já em estoque, recebe etiquetas e é agrupado; no <b>Envio</b> vira um lote despachado.
                </HelpBody>
                <Flow accent="var(--brand-sales)" steps={[
                  { icon: 'git-merge', label: 'Mapeamento', sub: 'item → SKU' },
                  { icon: 'factory', label: 'Produção', sub: 'montagem dos SKUs' },
                  { icon: 'package-check', label: 'Separação', sub: 'etiqueta & lote', tone: 'accent' },
                  { icon: 'truck', label: 'Envio', sub: 'lote despachado', tone: 'ok' },
                ]}/>
              </HelpCard>
              <PedidosBoard orders={orders} lotes={lotes} unmapped={unmapped} sel={sel}
                onToggleSel={toggleSel} onConfirmMap={confirmMap} onVincular={setVincOrder} onOpenOrder={setOpenOrder}
                onEtiquetas={etqFromOrders} onCreateLote={createLote} onOpenLote={setOpenLoteId}/>
            </>
          )}
          {view === 'tabela' && <SeparacaoTab orders={orders} onCreateLote={createLote} openEtiquetas={openEtiquetas}/>}
        </>
      )}

      <OrderDetailSheet order={openOrder} unmapped={unmapped} lotes={lotes} onClose={() => setOpenOrder(null)} onEtiquetas={etqFromOrders} onConfirmMap={confirmMap}/>
      <VincularSheet order={vincOrder} onClose={() => setVincOrder(null)} onConfirm={(id) => { confirmMap(id); setVincOrder(null); }}/>
      <EtiquetaModal open={etq.open} pieces={etq.pieces} onClose={() => setEtq({ open: false, pieces: [] })} onConfirm={confirmPrint}/>

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--ink-inv)',
          padding: '11px 17px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 2000, display: 'flex', alignItems: 'center', gap: 9, maxWidth: '90vw' }}>
          <Icon name="check-circle-2" size={16} style={{ color: '#7ee0a5' }}/> {toast}
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  Pedidos, EtiquetaModal, EtiquetaCard, FakeQR, FakeBarcode, EstampaThumb, EstampaTag,
  PlatformChip, ColorDot, piecesFromOrders, piecesFromLote, orderPieces, FF_TONE, FF_COLOR, pieceCode,
});
