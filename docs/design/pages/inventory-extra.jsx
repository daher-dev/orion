// Inventory pages — Peças lisas (semiacabado), Bobinas de papel (insumo), Estampados (componente)
// Reuses helpers from ui.jsx + inventory.jsx + catalog.jsx (shared global scope):
//   PageHead, HelpCard, HelpBody, Flow, Seg, SearchInput, TableToolbar, Sheet,
//   SectionTitle, Select, NumField, SortHeader, COLOR_NAMES_INV, GARMENT_GLYPHS.

// Tone → accent hex for printed-transfer thumbnails
const InvToneHex = { warm: '#c2410c', moss: '#3a4a3d', sand: '#a16207', bone: '#7a7160', stone: '#57534e' };

// Small striped art-chip standing in for a printed transfer
const TransferChip = ({ tone = 'warm', size = 30 }) => {
  const c = InvToneHex[tone] || InvToneHex.warm;
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: 7, flexShrink: 0,
      background: `repeating-linear-gradient(135deg, ${c}1f 0 3px, ${c}3d 3px 6px)`,
      border: `1px solid ${c}40`, display: 'grid', placeItems: 'center', color: c,
    }}>
      <Icon name="image" size={Math.round(size * 0.42)} strokeWidth={1.6}/>
    </span>
  );
};

const colorDotInv = (name) => (
  <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: COLOR_NAMES_INV[name] || 'var(--ink-3)', boxShadow: '0 0 0 1px var(--line), inset 0 0 0 1px rgba(255,255,255,.15)', flexShrink: 0 }}/>
);

// Garment-side glyph: a panel with a chest-print mark (frente) or a spine seam (costas)
const SideGlyph = ({ side, size = 14, color = 'var(--ink-3)' }) => {
  const back = side === 'costas';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M8.5 3.5 L5 5.5 L5 20.5 L19 20.5 L19 5.5 L15.5 3.5"/>
      <path d="M8.5 3.5 Q12 6.5 15.5 3.5"/>
      {back
        ? <line x1="12" y1="8" x2="12" y2="18"/>
        : <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill={color} stroke="none"/>}
    </svg>
  );
};

const garmentMark = (garment, px = 16) => (
  GARMENT_GLYPHS[garment]
    ? React.cloneElement(GARMENT_GLYPHS[garment], { width: px, height: px, strokeWidth: 1.4 })
    : <Icon name="shopping-bag" size={Math.round(px * 0.85)}/>
);

// ───────────────────────── Generic counted-unit movement sheet ─────────────────────────
const UnitMoveSheet = ({ open, onClose, item, hero, moveTypes, unit = 'un', moves = [], onApply }) => {
  const [qty, setQty] = React.useState(1);
  const [type, setType] = React.useState(moveTypes[0].id);
  React.useEffect(() => { if (open) { setQty(1); setType(moveTypes[0].id); } }, [open, item]);

  const move = moveTypes.find(m => m.id === type) || moveTypes[0];
  const delta = move.dir === '+' ? qty : -qty;
  const projected = item ? item.count + delta : 0;

  return (
    <Sheet open={open} onClose={onClose} title="Lançar movimentação" footer={null}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ flex: 1 }}>
          {item && hero}

          <div style={{ marginBottom: 22 }}>
            <SectionTitle>Tipo de movimentação</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {moveTypes.map(m => {
                const active = type === m.id;
                const tone = m.dir === '+' ? 'var(--ok)' : 'var(--err)';
                return (
                  <button key={m.id} type="button" onClick={() => setType(m.id)}
                    style={{
                      textAlign: 'left',
                      border: active ? `1.5px solid ${tone}` : '1px solid var(--line)',
                      background: active ? `color-mix(in oklab, ${tone} 8%, var(--surface))` : 'var(--surface)',
                      borderRadius: 10, padding: '12px 14px',
                      display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: `color-mix(in oklab, ${tone} 14%, var(--surface))`, color: tone, display: 'grid', placeItems: 'center' }}>
                      <Icon name={m.icon} size={16}/>
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: active ? 600 : 500 }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <SectionTitle>Quantidade</SectionTitle>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 240 }}>
              <button type="button" className="btn" onClick={() => setQty(Math.max(1, qty - 1))} style={{ padding: '10px 14px' }}><Icon name="minus" size={14}/></button>
              <input type="text" inputMode="numeric" value={qty} onChange={e => setQty(Math.max(1, +e.target.value.replace(/\D/g,'') || 0))}
                     style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 22, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}/>
              <button type="button" className="btn" onClick={() => setQty(qty + 1)} style={{ padding: '10px 14px' }}><Icon name="plus" size={14}/></button>
            </div>
          </div>

          {item && (
            <div style={{ marginBottom: 22 }}>
              <SectionTitle>Pré-visualização</SectionTitle>
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 16,
                display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Atual</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', lineHeight: 1.1 }}>{item.count}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink-3)' }}>{move.dir}</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>{move.dir === '+' ? 'Entrada' : 'Saída'}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: move.dir === '+' ? 'var(--ok)' : 'var(--err)', lineHeight: 1.1 }}>{qty}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink-3)' }}>=</span>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Final</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: projected < 0 ? 'var(--err)' : projected < (item.min || 10) ? 'var(--warn)' : 'var(--ink)', lineHeight: 1.1 }}>{projected}</div>
                </div>
              </div>
              {projected < 0 && <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="alert-triangle" size={11}/> Estoque ficaria negativo.</div>}
            </div>
          )}

          {item && moves.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
              <SectionTitle>Últimas movimentações</SectionTitle>
              {moves.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < moves.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 999, background: m.qty > 0 ? 'color-mix(in oklab, var(--ok) 14%, var(--surface))' : 'color-mix(in oklab, var(--err) 14%, var(--surface))', color: m.qty > 0 ? 'var(--ok)' : 'var(--err)', display: 'grid', placeItems: 'center' }}>
                    <Icon name={m.qty > 0 ? 'arrow-down' : 'arrow-up'} size={13}/>
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>{m.reason}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.date}</div>
                  </div>
                  <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: m.qty > 0 ? 'var(--ok)' : 'var(--err)' }}>{m.qty > 0 ? '+' : ''}{m.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 0, marginLeft: -22, marginRight: -22, marginTop: 14, padding: '14px 22px', borderTop: '1px solid var(--line-soft)', background: 'var(--bg)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { if (item && onApply) onApply(item, move.dir === '+' ? qty : -qty, `${move.dir === '+' ? 'Entrada' : 'Saída'} · ${move.label}`); onClose(); }} disabled={qty <= 0 || !item}><Icon name="check" size={13}/> Confirmar</button>
        </div>
      </div>
    </Sheet>
  );
};

// Movements ledger table (shared by counted stocks)
const UnitLedger = ({ movements, labelOf }) => {
  const [sort, setSort] = React.useState({ col: 'date', dir: 'desc' });
  const rows = React.useMemo(() => {
    const r = movements.slice();
    const dir = sort.dir === 'asc' ? 1 : -1;
    r.sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
    return r;
  }, [movements, sort, window.StockStore.version()]);
  return (
    <table className="tbl">
      <thead><tr>
        <SortHeader id="date" sort={sort} setSort={setSort}>Data</SortHeader>
        <th>Item</th>
        <SortHeader id="reason" sort={sort} setSort={setSort}>Motivo</SortHeader>
        <SortHeader id="qty" sort={sort} setSort={setSort} num>Qtd</SortHeader>
      </tr></thead>
      <tbody>
        {rows.map((m, i) => (
          <tr key={i}>
            <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.date}</td>
            <td>{labelOf(m.id)}</td>
            <td>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name={m.qty > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} size={13} style={{ color: m.qty > 0 ? 'var(--ok)' : 'var(--err)' }}/>
                {m.reason}
              </span>
            </td>
            <td className="num" style={{ color: m.qty > 0 ? 'var(--ok)' : 'var(--err)', fontWeight: 500 }}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ───────────────────────── PEÇAS LISAS (semiacabado / WIP) ─────────────────────────
const BLANK_MOVES = [
  { id: 'in-ajuste',  dir: '+', icon: 'plus-circle',    label: 'Ajuste (+)', desc: 'Correção de inventário' },
  { id: 'out-ajuste', dir: '-', icon: 'minus-circle',   label: 'Ajuste (−)', desc: 'Correção de inventário' },
  { id: 'out-avaria', dir: '-', icon: 'alert-triangle', label: 'Avaria',     desc: 'Peça danificada' },
];

const BlankPieces = () => {
  const store = useStock();
  const [tab, setTab] = React.useState('current');
  const [q, setQ] = React.useState('');
  const [lowOnly, setLowOnly] = React.useState(false);
  const [sort, setSort] = React.useState({ col: 'count', dir: 'desc' });
  const [moveItem, setMoveItem] = React.useState(null);
  const [moveOpen, setMoveOpen] = React.useState(false);

  const total = ORION_DATA.blankPieces.reduce((s, r) => s + r.count, 0);

  const rows = React.useMemo(() => {
    let r = ORION_DATA.blankPieces.slice();
    if (q) r = r.filter(x => `${x.base} ${x.color} ${x.size}`.toLowerCase().includes(q.toLowerCase()));
    if (lowOnly) r = r.filter(x => x.count < (x.min || 0));
    const dir = sort.dir === 'asc' ? 1 : -1;
    r.sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
    return r;
  }, [q, lowOnly, sort, store.version()]);

  const labelOf = (id) => {
    const x = ORION_DATA.blankPieces.find(b => b.id === id);
    return x ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--ink)', fontWeight: 500 }}>{colorDotInv(x.color)}{x.base} · {x.color} · {x.size}</span> : id;
  };

  const openMove = (item) => { setMoveItem(item); setMoveOpen(true); };

  const hero = moveItem && (
    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>{garmentMark(moveItem.garment, 30)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{moveItem.base} <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>· peça lisa</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>{colorDotInv(moveItem.color)}{moveItem.color}</span>
          <span className="pill" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '.04em', minWidth: 28, justifyContent: 'center' }}>{moveItem.size}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: moveItem.count < (moveItem.min || 0) ? 'var(--warn)' : 'var(--ink)', lineHeight: 1 }}>{moveItem.count}</div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>em estoque</div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <PageHead sub="blanks" title="Peças" titleEm="lisas"
                desc="Peças costuradas, aguardando estampa."
                actions={<button className="btn btn-primary" onClick={() => openMove(null)}><Icon name="package-check" size={14}/> Receber remessa</button>}/>
      <HelpCard id="blanks" icon="shirt" tone="var(--brand-inv)" title="Peças lisas — semiacabado, entre a costura e a estampa">
        <HelpBody>
          Quando uma <b>remessa</b> volta da banca, as peças entram aqui como <b>peças lisas</b> (sem estampa). Não são produto ainda — viram <b>produto acabado</b> na <b>Montagem</b>, quando recebem a estampa.
        </HelpBody>
        <Flow accent="var(--brand-inv)" steps={[
          { icon: 'package-check', label: 'Remessa recebida', sub: 'volta da costura' },
          { icon: 'shirt', label: 'Peça lisa', sub: 'aguarda estampa', tone: 'accent' },
          { icon: 'combine', label: 'Montagem', sub: '+ estampa → produto', tone: 'ok' },
        ]}/>
      </HelpCard>

      <InventoryKpis items={[
        { label: 'Total em peças lisas', value: total, unit: 'peças' },
        { label: 'Abaixo do mínimo', value: ORION_DATA.blankPieces.filter(x => x.count < (x.min || 0)).length, tone: ORION_DATA.blankPieces.filter(x => x.count < (x.min || 0)).length ? 'var(--warn)' : 'var(--ink)', hint: 'SKUs base a repor' },
      ]}/>

      <div className="card">
        <TableToolbar>
          <Seg value={tab} onChange={setTab} options={[{ value: 'current', label: 'Posição atual' }, { value: 'movements', label: 'Movimentações' }]}/>
          <SearchInput placeholder="Buscar peça lisa…" value={q} onChange={e => setQ(e.target.value)}/>
          {tab === 'current' && (
            <div style={{ marginLeft: 'auto' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
                <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)}/> Apenas baixos
              </label>
            </div>
          )}
        </TableToolbar>
        {tab === 'current' ? (
          <table className="tbl">
            <thead><tr>
              <th style={{ width: 36 }}/>
              <SortHeader id="base" sort={sort} setSort={setSort}>Peça base</SortHeader>
              <SortHeader id="color" sort={sort} setSort={setSort}>Cor</SortHeader>
              <SortHeader id="size" sort={sort} setSort={setSort}>Tam.</SortHeader>
              <SortHeader id="min" sort={sort} setSort={setSort} num>Mínimo</SortHeader>
              <SortHeader id="count" sort={sort} setSort={setSort} num>Em estoque</SortHeader>
              <th style={{ width: 36 }}/>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const low = r.count < (r.min || 0);
                return (
                  <tr key={r.id} onClick={() => openMove(r)}>
                    <td><span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>{garmentMark(r.garment, 16)}</span></td>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.base}</td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{colorDotInv(r.color)}<span style={{ color: 'var(--ink-2)' }}>{r.color}</span></span></td>
                    <td><span className="pill" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '.04em', minWidth: 28, justifyContent: 'center' }}>{r.size}</span></td>
                    <td className="num" style={{ color: 'var(--ink-3)' }}>{r.min}</td>
                    <td className="num" style={{ color: low ? 'var(--warn)' : 'var(--ink)', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>{low && <Icon name="alert-triangle" size={12} style={{ color: 'var(--warn)' }}/>}{r.count}</span>
                    </td>
                    <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <UnitLedger movements={ORION_DATA.blankMovements} labelOf={labelOf}/>
        )}
      </div>

      <UnitMoveSheet open={moveOpen} onClose={() => setMoveOpen(false)} item={moveItem} hero={hero} moveTypes={BLANK_MOVES} unit="peças"
                     onApply={(it, delta, reason) => store.adjustBlank(it.id, delta, reason, `${it.base} · ${it.color} · ${it.size}`)}
                     moves={moveItem ? ORION_DATA.blankMovements.filter(m => m.id === moveItem.id) : []}/>
    </div>
  );
};

// ───────────────────────── BOBINAS DE PAPEL / FILME (insumo, bulk) ─────────────────────────
const PaperRolls = () => {
  const store = useStock();
  const [open, setOpen] = React.useState(null);
  const [tab, setTab] = React.useState('current');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState({ col: 'current', dir: 'desc' });
  const [consume, setConsume] = React.useState(5);
  const [form, setForm] = React.useState({ type: 'Filme DTF', width: 60, meters: 100, supplier: '' });

  const paperLabelOf = (id) => {
    const x = ORION_DATA.paperRolls.find(p => p.id === id);
    return x ? (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 24, height: 24, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name="scroll" size={13}/></span>
        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{x.type}</span>
        <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{x.id}</span>
      </span>
    ) : id;
  };

  const totalM = ORION_DATA.paperRolls.reduce((s, r) => s + r.current, 0);
  const toReorder = ORION_DATA.paperRolls.filter(r => (r.current / r.initial) < 0.25).length;

  const rows = React.useMemo(() => {
    let r = ORION_DATA.paperRolls.filter(x => !q || `${x.id} ${x.type} ${x.supplier}`.toLowerCase().includes(q.toLowerCase()));
    const dir = sort.dir === 'asc' ? 1 : -1;
    r.sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
    return r;
  }, [q, sort, store.version()]);

  return (
    <div className="page">
      <PageHead sub="paper" title="Bobinas" titleEm="de papel"
                desc="Filme DTF e papel de sublimação, por saldo."
                actions={<button className="btn btn-primary" onClick={() => setOpen({ _new: true })}><Icon name="scroll" size={14}/> Receber bobina</button>}/>
      <HelpCard id="paper" icon="scroll" tone="var(--brand-inv)" title="Bobinas de papel — o insumo da estamparia">
        <HelpBody>
          Espelho das bobinas de tecido, mas para a <b>impressão</b>. Cada bobina entra com sua <b>metragem</b>; a cada <b>lote impresso</b> o saldo é <b>abatido</b> — gerando os <b>impressos</b> prontos para prensar.
        </HelpBody>
        <Flow accent="var(--brand-inv)" steps={[
          { icon: 'scroll', label: 'Bobina recebida', sub: 'metragem', tone: 'accent' },
          { icon: 'printer', label: 'Impressão', sub: 'abate o saldo' },
          { icon: 'stamp', label: 'Impressos', sub: 'prontos p/ prensar', tone: 'ok' },
        ]}/>
      </HelpCard>

      <InventoryKpis items={[
        { label: 'Saldo total', value: fmt(totalM, 0), unit: 'm' },
        { label: 'Bobinas a repor', value: toReorder, tone: toReorder ? 'var(--warn)' : 'var(--ink)', hint: 'abaixo de 25% do saldo' },
      ]}/>

      <div className="card">
        <TableToolbar>
          <Seg value={tab} onChange={setTab} options={[
            { value: 'current', label: 'Posição atual' },
            { value: 'movements', label: 'Movimentações' },
          ]}/>
          <SearchInput placeholder="Buscar por tipo, fornecedor…" value={q} onChange={e => setQ(e.target.value)}/>
        </TableToolbar>
        {tab === 'current' ? (
        <table className="tbl">
          <thead><tr>
            <SortHeader id="type" sort={sort} setSort={setSort}>Tipo</SortHeader>
            <SortHeader id="width" sort={sort} setSort={setSort} num>Largura</SortHeader>
            <SortHeader id="supplier" sort={sort} setSort={setSort}>Fornecedor</SortHeader>
            <SortHeader id="received" sort={sort} setSort={setSort}>Recebida</SortHeader>
            <th style={{ width: 200 }}>Saldo</th>
            <SortHeader id="current" sort={sort} setSort={setSort} num>Restante</SortHeader>
            <th style={{ width: 36 }}/>
          </tr></thead>
          <tbody>
            {rows.map(r => {
              const pct = (r.current / r.initial) * 100;
              const danger = pct < 25, warn = !danger && pct < 50;
              return (
                <tr key={r.id} onClick={() => setOpen(r)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name="scroll" size={15} strokeWidth={1.5}/></span>
                      <div>
                        <div style={{ color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.type}</div>
                        <div className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.3 }}>{r.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num">{r.width} cm</td>
                  <td>{r.supplier}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.received}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                        <div className={danger ? 'bar-danger-pulse' : warn ? 'bar-warn-pulse' : ''} style={{ width: `${pct}%`, height: '100%', background: danger ? 'var(--err)' : warn ? 'var(--warn)' : 'var(--brand-inv)', borderRadius: 999 }}/>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 36 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="num" style={{ color: danger ? 'var(--err)' : 'var(--ink)', fontWeight: 500 }}>{fmt(r.current, 0)} m</td>
                  <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        ) : (
          <RollLedger movements={ORION_DATA.paperMovements} labelOf={paperLabelOf} unit="m"/>
        )}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open && !open._new ? open.type : 'Receber bobina'}
             sub={open && !open._new ? <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{open.id}</span> : null}
             footer={open && !open._new ? <>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir bobina</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn" onClick={() => { store.adjustPaper(open.id, -consume, 'Saída · Consumo manual'); setOpen(null); }}><Icon name="printer" size={13}/> Lançar consumo</button>
             </> : <>
               <button className="btn" onClick={() => setOpen(null)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => {
                 const seq = String(301 + ORION_DATA.paperRolls.length).padStart(3, '0');
                 const d = new Date(), pad = n => String(n).padStart(2, '0');
                 store.addPaperRoll({ id: `BP-${seq}`, type: form.type, width: form.width, initial: form.meters, current: form.meters, supplier: form.supplier || '—', received: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` });
                 setForm({ type: 'Filme DTF', width: 60, meters: 100, supplier: '' });
                 setOpen(null);
               }}><Icon name="check" size={13}/> Registrar entrada</button>
             </>}>
        {open && !open._new && <PaperRollDetail r={open} consume={consume} setConsume={setConsume}/>}
        {open && open._new && <NewPaperRollForm form={form} setForm={setForm}/>}
      </Sheet>
    </div>
  );
};

const PaperRollDetail = ({ r, consume, setConsume }) => {
  const pct = (r.current / r.initial) * 100;
  const used = r.initial - r.current;
  const low = pct < 25;
  const runs = ORION_DATA.paperMovements.filter(m => m.id === r.id && m.qty < 0);
  return (
    <div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 120, opacity: .18, background: 'repeating-linear-gradient(45deg, var(--ink) 0 1px, transparent 1px 5px)' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 8, background: 'var(--surface)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name="scroll" size={22} strokeWidth={1.5}/></span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>{r.type}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r.width} cm de largura</div>
          </div>
        </div>
        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Restante</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: low ? 'var(--err)' : 'var(--ink)' }}>{fmt(r.current, 0)}<span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 3 }}>/ {fmt(r.initial, 0)} m</span></span>
        </div>
        <div style={{ height: 10, background: 'var(--surface)', borderRadius: 999, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.05)' }}>
          <div className={low ? 'bar-danger-pulse' : ''} style={{ width: `${pct}%`, height: '100%', background: low ? 'var(--err)' : 'var(--brand-inv)', borderRadius: 999, transition: 'width .3s' }}/>
        </div>
        {low && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="alert-triangle" size={11}/> Estoque baixo — considere repor.</div>}
      </div>
      <FormGrid>
        <FormCell icon="truck" label="Fornecedor">{r.supplier}</FormCell>
        <FormCell icon="calendar" label="Recebida em">{r.received}</FormCell>
        <FormCell icon="printer" label="Consumido">{fmt(used, 0)} m</FormCell>
        <FormCell icon="ruler" label="Largura">{r.width} cm</FormCell>
      </FormGrid>
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18 }}>
        <SectionTitle>Lançar consumo</SectionTitle>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 220 }}>
          <button type="button" className="btn" onClick={() => setConsume(Math.max(1, consume - 1))} style={{ padding: '10px 14px' }}><Icon name="minus" size={14}/></button>
          <div style={{ flex: 1, position: 'relative' }}>
            <input type="text" inputMode="numeric" value={consume} onChange={e => setConsume(Math.max(1, +e.target.value.replace(/\D/g, '') || 0))}
                   style={{ width: '100%', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 20, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}/>
          </div>
          <button type="button" className="btn" onClick={() => setConsume(consume + 1)} style={{ padding: '10px 14px' }}><Icon name="plus" size={14}/></button>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>m</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>Saldo após consumo: <b style={{ color: r.current - consume < r.initial * 0.25 ? 'var(--err)' : 'var(--ink)' }}>{fmt(Math.max(0, r.current - consume), 0)} m</b> · use o botão “Lançar consumo” abaixo.</div>
      </div>
      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Impressões que consumiram esta bobina</div>
        {runs.length ? runs.map((m, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <span style={{ width: 26, height: 26, borderRadius: 999, background: 'color-mix(in oklab, var(--err) 14%, var(--surface))', color: 'var(--err)', display: 'grid', placeItems: 'center' }}><Icon name="printer" size={13}/></span>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: 'var(--ink)' }}>{m.reason.replace('Saída · ', '')}</div><div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{m.date}</div></div>
            <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--err)' }}>{m.qty} m</span>
          </div>
        )) : <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nenhuma impressão registrada contra esta bobina ainda.</div>}
      </div>
    </div>
  );
};

const PAPER_TYPES = ['Filme DTF', 'Papel sublimático', 'Papel transfer'];
const NewPaperRollForm = ({ form, setForm }) => {
  const set = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Tipo de bobina</SectionTitle>
        <div className="field"><label>Material</label><Select value={form.type} onChange={v => set('type', v)} options={PAPER_TYPES}/></div>
      </div>
      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Detalhes</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>Largura</label><NumField value={form.width} onChange={v => set('width', v)} step={5} min={0} suffix="cm"/></div>
          <div className="field"><label>Metragem</label><NumField value={form.meters} onChange={v => set('meters', v)} step={10} min={0} suffix="m"/></div>
        </div>
        <div className="field"><label>Fornecedor</label><input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Ex: DTF Brasil"/></div>
      </div>
    </div>
  );
};

// ───────────────────────── ESTAMPADOS (componente, transfers prontos) ─────────────────────────
const PRINTED_MOVES = [
  { id: 'in-ajuste',    dir: '+', icon: 'plus-circle',    label: 'Ajuste (+)', desc: 'Correção de inventário' },
  { id: 'out-ajuste',   dir: '-', icon: 'minus-circle',   label: 'Ajuste (−)', desc: 'Correção de inventário' },
  { id: 'out-refugo',   dir: '-', icon: 'alert-triangle', label: 'Refugo',     desc: 'Falha de impressão' },
];

const sideLabel = (s) => s === 'costas' ? 'Costas' : 'Frente';

const Printed = () => {
  const store = useStock();
  const [tab, setTab] = React.useState('current');
  const [q, setQ] = React.useState('');
  const [lowOnly, setLowOnly] = React.useState(false);
  const [sort, setSort] = React.useState({ col: 'count', dir: 'desc' });
  const [moveItem, setMoveItem] = React.useState(null);
  const [moveOpen, setMoveOpen] = React.useState(false);

  const total = ORION_DATA.printed.reduce((s, r) => s + r.count, 0);

  const rows = React.useMemo(() => {
    let r = ORION_DATA.printed.slice();
    if (q) r = r.filter(x => `${x.code} ${x.name} ${x.technique}`.toLowerCase().includes(q.toLowerCase()));
    if (lowOnly) r = r.filter(x => x.count < (x.min || 0));
    const dir = sort.dir === 'asc' ? 1 : -1;
    r.sort((a, b) => {
      const av = a[sort.col], bv = b[sort.col];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
    return r;
  }, [q, lowOnly, sort, store.version()]);

  const labelOf = (id) => {
    const x = ORION_DATA.printed.find(p => p.id === id);
    return x ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{x.code}</span><span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{sideLabel(x.side)}</span></span> : id;
  };

  const openMove = (item) => { setMoveItem(item); setMoveOpen(true); };

  const hero = moveItem && (
    <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
      <TransferChip tone={moveItem.tone} size={56}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{moveItem.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{moveItem.code}</span>
          <span className="pill">{moveItem.technique}</span>
          <span className="pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><SideGlyph side={moveItem.side} size={13}/>{sideLabel(moveItem.side)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: moveItem.count < (moveItem.min || 0) ? 'var(--warn)' : 'var(--ink)', lineHeight: 1 }}>{moveItem.count}</div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4 }}>prontos</div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <PageHead sub="printed" title="Impressos" titleEm="prontos"
                desc="Transfers impressos, aguardando a prensa."
                actions={<button className="btn btn-primary" onClick={() => openMove(null)}><Icon name="printer" size={14}/> Registrar impressão</button>}/>
      <HelpCard id="printed" icon="stamp" tone="var(--brand-inv)" title="Impressos — componente impresso, antes da prensa">
        <HelpBody>
          Cada <b>impressão de lote</b> consome <b>bobina de papel</b> e produz <b>impressos</b> prontos. Eles ficam em estoque por <b>estampa</b> e <b>lado</b> até a <b>Montagem</b>, quando são prensados na peça lisa.
        </HelpBody>
        <Flow accent="var(--brand-inv)" steps={[
          { icon: 'printer', label: 'Impressão', sub: 'consome bobina' },
          { icon: 'stamp', label: 'Impresso', sub: 'por estampa · lado', tone: 'accent' },
          { icon: 'combine', label: 'Montagem', sub: 'prensa na peça', tone: 'ok' },
        ]}/>
      </HelpCard>

      <InventoryKpis items={[
        { label: 'Impressos prontos', value: total, unit: 'un' },
        { label: 'Itens em alerta', value: ORION_DATA.printed.filter(x => x.count < (x.min || 0)).length, tone: ORION_DATA.printed.filter(x => x.count < (x.min || 0)).length ? 'var(--warn)' : 'var(--ink)', hint: 'esgotados ou abaixo do mínimo' },
      ]}/>

      <div className="card">
        <TableToolbar>
          <Seg value={tab} onChange={setTab} options={[{ value: 'current', label: 'Posição atual' }, { value: 'movements', label: 'Movimentações' }]}/>
          <SearchInput placeholder="Buscar estampa…" value={q} onChange={e => setQ(e.target.value)}/>
          {tab === 'current' && (
            <div style={{ marginLeft: 'auto' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
                <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)}/> Apenas baixos
              </label>
            </div>
          )}
        </TableToolbar>
        {tab === 'current' ? (
          <table className="tbl">
            <thead><tr>
              <th style={{ width: 36 }}/>
              <SortHeader id="code" sort={sort} setSort={setSort}>Estampa</SortHeader>
              <SortHeader id="technique" sort={sort} setSort={setSort}>Técnica</SortHeader>
              <SortHeader id="side" sort={sort} setSort={setSort}>Lado</SortHeader>
              <SortHeader id="min" sort={sort} setSort={setSort} num>Mínimo</SortHeader>
              <SortHeader id="count" sort={sort} setSort={setSort} num>Prontos</SortHeader>
              <th style={{ width: 36 }}/>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const out = r.count === 0;
                const low = !out && r.count < (r.min || 0);
                return (
                  <tr key={r.id} onClick={() => openMove(r)}>
                    <td><TransferChip tone={r.tone} size={28}/></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{r.name}</span>
                        <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{r.code}</span>
                      </div>
                    </td>
                    <td><span className="pill">{r.technique}</span></td>
                    <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}><SideGlyph side={r.side} size={15}/>{sideLabel(r.side)}</span></td>
                    <td className="num" style={{ color: 'var(--ink-3)' }}>{r.min}</td>
                    <td className="num" style={{ color: out ? 'var(--err)' : low ? 'var(--warn)' : 'var(--ink)', fontWeight: 600 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>{(out || low) && <Icon name="alert-triangle" size={12} style={{ color: out ? 'var(--err)' : 'var(--warn)' }}/>}{r.count}</span>
                    </td>
                    <td><Icon name="chevron-right" size={14} style={{ color: 'var(--ink-3)' }}/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <UnitLedger movements={ORION_DATA.printedMovements} labelOf={labelOf}/>
        )}
      </div>

      <UnitMoveSheet open={moveOpen} onClose={() => setMoveOpen(false)} item={moveItem} hero={hero} moveTypes={PRINTED_MOVES} unit="un"
                     onApply={(it, delta, reason) => store.adjustPrinted(it.id, delta, reason, `${it.code} · ${sideLabel(it.side)}`)}
                     moves={moveItem ? ORION_DATA.printedMovements.filter(m => m.id === moveItem.id) : []}/>
    </div>
  );
};

// ───────────────────────── MONTAGEM (peça lisa + impresso → produto) ─────────────────────────
// The convergence: debits a blank piece + a printed transfer, credits a finished product
// (creating the SKU if it doesn't exist yet).
const MontagemModal = ({ open, onClose }) => {
  const store = useStock();
  const blanks = ORION_DATA.blankPieces.filter(b => b.count > 0);
  const prints = ORION_DATA.printed.filter(p => p.count > 0);
  const [blankId, setBlankId] = React.useState(blanks[0]?.id || '');
  const [printedId, setPrintedId] = React.useState(prints[0]?.id || '');
  const [qty, setQty] = React.useState(1);

  React.useEffect(() => { if (open) { setBlankId(blanks[0]?.id || ''); setPrintedId(prints[0]?.id || ''); setQty(1); } }, [open]);

  const blank = ORION_DATA.blankPieces.find(b => b.id === blankId);
  const printed = ORION_DATA.printed.find(p => p.id === printedId);
  const maxQty = Math.min(blank ? blank.count : 0, printed ? printed.count : 0);
  const meta = (blank && printed) ? {
    sku: store.skuFor(blank, printed.code),
    product: `${blank.base} ${printed.name.split('—')[0].trim()}`,
    color: blank.color, size: blank.size, print: printed.name,
  } : null;
  const existing = meta ? ORION_DATA.stock.find(s => s.sku === meta.sku) : null;
  const over = qty > maxQty;

  const blankOpts = blanks.map(b => ({ value: b.id, label: `${b.base} · ${b.color} · ${b.size}`, sub: `${b.count} em estoque` }));
  const printedOpts = prints.map(p => ({ value: p.id, label: `${p.code} ${p.name} · ${sideLabel(p.side)}`, sub: `${p.count} prontos` }));

  return (
    <Sheet open={open} onClose={onClose} title="Montagem" sub={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>peça lisa + impresso → produto</span>}
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!meta || qty < 1 || over} onClick={() => { store.assemble({ blankId, printedId, qty, productMeta: meta, ref: '' }); onClose(); }}>
          <Icon name="combine" size={13}/> Montar {qty} {qty === 1 ? 'produto' : 'produtos'}
        </button>
      </>}>
      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Peça lisa</SectionTitle>
        <Select searchable value={blankId} onChange={setBlankId} options={blankOpts}/>
      </div>
      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Impresso (estampa)</SectionTitle>
        <Select searchable value={printedId} onChange={setPrintedId} options={printedOpts}/>
      </div>
      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Quantidade</SectionTitle>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 240 }}>
          <button type="button" className="btn" onClick={() => setQty(Math.max(1, qty - 1))} style={{ padding: '10px 14px' }}><Icon name="minus" size={14}/></button>
          <input type="text" inputMode="numeric" value={qty} onChange={e => setQty(Math.max(1, +e.target.value.replace(/\D/g, '') || 0))}
                 style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 22, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }}/>
          <button type="button" className="btn" onClick={() => setQty(Math.min(maxQty || 1, qty + 1))} style={{ padding: '10px 14px' }}><Icon name="plus" size={14}/></button>
        </div>
        <div style={{ fontSize: 11, color: over ? 'var(--err)' : 'var(--ink-3)', marginTop: 6 }}>{over ? `Máximo possível: ${maxQty} (limitado pelo menor estoque).` : `Até ${maxQty} possíveis com o estoque atual.`}</div>
      </div>

      {meta && (
        <div style={{ marginBottom: 8 }}>
          <SectionTitle>Resultado da montagem</SectionTitle>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line-soft)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface)', display: 'inline-grid', placeItems: 'center', color: 'var(--ink-2)' }}>{garmentMark(blank.garment, 22)}</span>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 6 }}>{blank.base}</div>
              <div style={{ fontSize: 10.5, color: 'var(--err)' }}>−{qty} lisa</div>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-3)' }}>+</span>
            <div style={{ textAlign: 'center' }}>
              <TransferChip tone={printed.tone} size={40}/>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 6 }}>{printed.code}</div>
              <div style={{ fontSize: 10.5, color: 'var(--err)' }}>−{qty} impresso</div>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-3)' }}>=</span>
            <div style={{ textAlign: 'center' }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: 'color-mix(in oklab, var(--ok) 14%, var(--surface))', color: 'var(--ok)', display: 'inline-grid', placeItems: 'center' }}><Icon name="package" size={20}/></span>
              <div style={{ fontSize: 11, color: 'var(--ink)', marginTop: 6, fontWeight: 500 }}>+{qty} produto</div>
              <div style={{ fontSize: 10.5, color: existing ? 'var(--ink-3)' : 'var(--ok)' }}>{existing ? `${existing.count} → ${existing.count + qty}` : 'novo SKU'}</div>
            </div>
          </div>
          <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{meta.sku}</span>
            <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{meta.product}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>{colorDotInv(meta.color)}{meta.color} · {meta.size}</span>
          </div>
        </div>
      )}
    </Sheet>
  );
};

Object.assign(window, { BlankPieces, PaperRolls, Printed, MontagemModal });
