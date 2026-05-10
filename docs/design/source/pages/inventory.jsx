// Inventory pages — Fabric, Stock

const CorpoGlyph = ({ size = 16, strokeWidth = 1.4 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>
    <path d="M3.5 9 H20.5 M3.5 15 H20.5 M9 3.5 V20.5 M15 3.5 V20.5"/>
  </svg>
);

const COLOR_NAMES_INV = {
  'Preto': '#1f1f1f', 'Marrom': '#7a4b2a', 'Areia': '#c9b9a3', 'Off-white': '#efe6d3',
  'Bege': '#cfb98e', 'Verde-musgo': '#7a8a76', 'Verde': '#3a4a3d', 'Caramelo': '#6b4a2e',
  'Off white': '#f4f1ea', 'Branco': '#f4f1ea', 'Vermelho': '#b03a2e', 'Cru': '#efe6d3',
};

const Fabric = () => {
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('all');

  const rows = ORION_DATA.fabric.filter(f => {
    if (filter !== 'all' && f.kind !== filter) return false;
    if (q) {
      const hay = `${f.id} ${f.type} ${f.supplier} ${f.color || ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="page">
      <PageHead sub="fabric" title="Bobinas" titleEm="de tecido"
                desc="Cada bobina recebida e o quanto resta. Saldo é abatido a cada corte."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="plus" size={14}/> Receber bobina</button>}/>
      <div className="card">
        <TableToolbar>
          <SearchInput placeholder="Buscar por tipo, fornecedor…" value={q} onChange={e => setQ(e.target.value)}/>
          <Seg value={filter} onChange={setFilter} options={[
            {value:'all',label:'Todas'},{value:'corpo',label:'Corpo'},{value:'ribana',label:'Ribana'}
          ]}/>
        </TableToolbar>
        <table className="tbl">
          <thead><tr><th>Tipo</th><th>Cor</th><th className="num">GSM</th><th>Fornecedor</th><th>Recebida</th><th style={{width:200}}>Saldo</th><th className="num">Restante</th><th style={{width:36}}/></tr></thead>
          <tbody>
            {rows.map(f => {
              const pct = (f.current / f.initial) * 100;
              const danger = pct < 25;
              const warn = !danger && pct < 50;
              const colorHex = COLOR_NAMES_INV[f.color] || 'var(--ink-3)';
              return (
                <tr key={f.id} onClick={() => setOpen(f)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}>
                        {f.kind === 'ribana' ? <Icon name="underline" size={15} strokeWidth={1.5}/> : <Icon name="grid-3x3" size={15} strokeWidth={1.5}/>}
                      </span>
                      <div>
                        <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{f.type}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{f.kind}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: colorHex, boxShadow: '0 0 0 1px var(--line), inset 0 0 0 1px rgba(255,255,255,.15)', flexShrink: 0 }}/>
                      <span style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>{f.color || '—'}</span>
                    </span>
                  </td>
                  <td className="num">{f.gsm}</td>
                  <td>{f.supplier}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{f.received}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
                        <div className={danger ? 'bar-danger-pulse' : warn ? 'bar-warn-pulse' : ''}
                             style={{ width: `${pct}%`, height: '100%', background: danger ? 'var(--err)' : warn ? 'var(--warn)' : 'var(--brand-inv)', borderRadius: 999 }}/>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 36 }}>{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="num" style={{ color: danger ? 'var(--err)' : 'var(--ink)', fontWeight: 500 }}>
                    {fmt(f.current, 1)} kg
                  </td>
                  <td><Icon name="chevron-right" size={14} style={{color:'var(--ink-3)'}}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? open.type : ''}
             sub={open ? <span className="mono" style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink-3)'}}>{open.id}</span> : null}
             footer={<>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn"><Icon name="scissors" size={13}/> Lançar consumo</button>
               <button className="btn btn-primary"><Icon name="pencil" size={13}/> Editar bobina</button>
             </>}>
        {open && <FabricDetail f={open}/>}
      </Sheet>

      <NewFabricSheet open={newOpen} onClose={() => setNewOpen(false)}/>
    </div>
  );
};

const FabricDetail = ({ f }) => {
  const pct = (f.current / f.initial) * 100;
  const used = f.initial - f.current;
  const low = pct < 25;
  // Mock cuts that consumed this roll
  const cuts = ORION_DATA.cutting.filter(c => c.roll === f.id);
  return (
    <div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 120, opacity: .22,
          background: `repeating-linear-gradient(45deg, var(--ink) 0 1px, transparent 1px ${Math.max(3, f.gsm / 30)}px)` }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, borderRadius: 8, background: 'var(--surface)', color: 'var(--ink-2)', flexShrink: 0 }}>
            {f.kind === 'ribana' ? <Icon name="underline" size={22} strokeWidth={1.5}/> : <Icon name="grid-3x3" size={22} strokeWidth={1.5}/>}
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>{f.type}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'capitalize', marginTop: 2, display:'inline-flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              {f.kind === 'ribana' && <Icon name="underline" size={11}/>}
              <span>{f.kind} · {f.gsm}g/m²</span>
              {f.color && <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: COLOR_NAMES_INV[f.color] || 'var(--ink-3)', boxShadow: '0 0 0 1px var(--line)' }}/>
                {f.color}
              </span>}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Restante</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: low ? 'var(--err)' : 'var(--ink)' }}>{fmt(f.current, 1)}<span style={{fontSize:12,color:'var(--ink-3)',marginLeft:3}}>/ {fmt(f.initial,1)} kg</span></span>
        </div>
          <div style={{ height: 10, background: 'var(--surface)', borderRadius: 999, overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.05)' }}>
            <div className={low ? 'bar-danger-pulse' : ''} style={{ width: `${pct}%`, height: '100%', background: low ? 'var(--err)' : 'var(--brand-inv)', borderRadius: 999, transition: 'width .3s' }}/>
          </div>
        {low && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="alert-triangle" size={11}/> Estoque baixo — considere repor.</div>}
      </div>

      <FormGrid>
        <FormCell icon="truck" label="Fornecedor">{f.supplier}</FormCell>
        <FormCell icon="calendar" label="Recebida em">{f.received}</FormCell>
        <FormCell icon="scissors" label="Consumido">{fmt(used, 1)} kg</FormCell>
        <FormCell icon="layers" label="Gramatura">{f.gsm} g/m²</FormCell>
      </FormGrid>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Cortes que consumiram esta bobina</div>
        {cuts.length ? cuts.map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)', minWidth: 70 }}>{c.code}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{c.product}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.date} · {c.operator}</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--ink-3)', minWidth: 70, textAlign: 'right' }}>{c.actual}/{c.planned} pç</span>
            <StatusPill s={c.status}/>
          </div>
        )) : <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nenhum corte registrado contra esta bobina ainda.</div>}
      </div>
    </div>
  );
};

const NewFabricSheet = ({ open, onClose }) => {
  const [tipo, setTipo] = React.useState(FABRIC_TYPES[0]);
  const [kind, setKind] = React.useState('corpo');
  const [gsm, setGsm] = React.useState(180);
  const [peso, setPeso] = React.useState(20.0);
  const [supplier, setSupplier] = React.useState('');
  const [color, setColor] = React.useState('Off-white');
  return (
    <Sheet open={open} onClose={onClose}
      title="Receber bobina"
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onClose}><Icon name="check" size={13}/> Registrar entrada</button>
      </>}>
      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Tipo</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            { id: 'corpo', label: 'Corpo', icon: 'shirt' },
            { id: 'ribana', label: 'Ribana', icon: 'rows-3' },
          ].map(k => {
            const active = kind === k.id;
            return (
              <button key={k.id} type="button" onClick={() => setKind(k.id)}
                style={{
                  border: active ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                  background: active ? 'var(--accent-soft)' : 'var(--surface)',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  borderRadius: 8, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: active ? 500 : 400,
                }}>
                <Icon name={k.icon} size={14}/> {k.label}
              </button>
            );
          })}
        </div>
        <div className="field">
          <label>Tipo de tecido</label>
          <Select searchable value={tipo} onChange={setTipo} options={FABRIC_TYPES}/>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <SectionTitle>Detalhes da bobina</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>Gramatura</label>
            <NumField value={gsm} onChange={setGsm} step={5} min={0} suffix="g/m²"/>
          </div>
          <div className="field">
            <label>Peso</label>
            <NumField value={peso} onChange={setPeso} step={0.1} min={0} suffix="kg"/>
          </div>
        </div>
        <div className="field">
          <label>Cor</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.keys(COLOR_NAMES_INV).filter(c => !['Off white','Cru'].includes(c)).map(c => {
              const active = color === c;
              return (
                <button key={c} type="button" onClick={() => setColor(c)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                    background: active ? 'var(--accent-soft)' : 'var(--surface)',
                    borderRadius: 999, padding: '5px 10px 5px 6px', cursor: 'pointer',
                    fontSize: 12, color: 'var(--ink-2)', fontFamily: 'inherit',
                  }}>
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: COLOR_NAMES_INV[c], boxShadow: '0 0 0 1px var(--line), inset 0 0 0 1px rgba(255,255,255,.15)' }}/>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label>Fornecedor</label>
          <input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Ex: Malharia Estrela"/>
        </div>
      </div>
    </Sheet>
  );
};

const MOVE_TYPES = [
  { id: 'entrada-banca',   dir: '+', icon: 'package-check',  label: 'Recebimento',  desc: 'Peças vindas da costura' },
  { id: 'entrada-devol',   dir: '+', icon: 'undo-2',         label: 'Devolução',     desc: 'Retorno de cliente' },
  { id: 'entrada-ajuste',  dir: '+', icon: 'plus-circle',    label: 'Ajuste (+)',   desc: 'Correção de inventário' },
  { id: 'saida-pedido',    dir: '-', icon: 'shopping-bag',   label: 'Pedido',       desc: 'Despacho para cliente' },
  { id: 'saida-avaria',    dir: '-', icon: 'alert-triangle', label: 'Avaria',       desc: 'Peça danificada' },
  { id: 'saida-brinde',    dir: '-', icon: 'gift',           label: 'Brinde',       desc: 'Saída sem venda' },
];

const SortHeader = ({ id, sort, setSort, num, children }) => {
  const active = sort.col === id;
  const next = active && sort.dir === 'asc' ? 'desc' : 'asc';
  return (
    <th className={num ? 'num' : ''} onClick={() => setSort({ col: id, dir: next })}
        style={{ cursor: 'pointer', userSelect: 'none' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: active ? 'var(--ink)' : undefined }}>
        {children}
        <Icon name={!active ? 'chevrons-up-down' : sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'}
              size={11} style={{ color: active ? 'var(--accent)' : 'var(--ink-3)' }}/>
      </span>
    </th>
  );
};

const Stock = () => {
  const [tab, setTab] = React.useState('current');
  const [open, setOpen] = React.useState(null);
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [sort, setSort] = React.useState({ col: 'sku', dir: 'asc' });
  const [movSort, setMovSort] = React.useState({ col: 'date', dir: 'desc' });
  const [lowOnly, setLowOnly] = React.useState(false);
  const [q, setQ] = React.useState('');

  const stockRows = React.useMemo(() => {
    let rows = ORION_DATA.stock.slice();
    if (q) rows = rows.filter(r => r.sku.toLowerCase().includes(q.toLowerCase()) || r.product.toLowerCase().includes(q.toLowerCase()));
    if (lowOnly) rows = rows.filter(r => r.count < 25);
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let av = a[sort.col], bv = b[sort.col];
      if (sort.col === 'print') { av = a.print || ''; bv = b.print || ''; }
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
    return rows;
  }, [sort, lowOnly, q]);

  const movRows = React.useMemo(() => {
    const rows = ORION_DATA.movements.slice();
    const dir = movSort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[movSort.col], bv = b[movSort.col];
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return ((av ?? 0) - (bv ?? 0)) * dir;
    });
    return rows;
  }, [movSort]);

  return (
    <div className="page">
      <PageHead sub="stock" title="Estoque" titleEm="de peças prontas"
                desc="Inventário de produtos acabados por SKU."
                actions={<>
                  <button className="btn btn-primary" onClick={() => setAdjustOpen(true)}><Icon name="arrow-down-up" size={14}/> Lançar movimentação</button>
                </>}/>
      <div className="card">
        <TableToolbar>
          <Seg value={tab} onChange={setTab} options={[
            {value:'current', label:'Posição atual'},
            {value:'movements', label:'Movimentações'},
          ]}/>
          <SearchInput placeholder="Buscar SKU…" value={q} onChange={e => setQ(e.target.value)}/>
          <div style={{ marginLeft: 'auto' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)}/> Apenas baixos
            </label>
          </div>
        </TableToolbar>
        {tab === 'current' ? (
          <table className="tbl">
            <thead><tr>
              <th style={{width:36}}/>
              <SortHeader id="sku" sort={sort} setSort={setSort}>SKU</SortHeader>
              <SortHeader id="product" sort={sort} setSort={setSort}>Produto</SortHeader>
              <SortHeader id="color" sort={sort} setSort={setSort}>Cor</SortHeader>
              <SortHeader id="size" sort={sort} setSort={setSort}>Tam.</SortHeader>
              <SortHeader id="print" sort={sort} setSort={setSort}>Estampa</SortHeader>
              <SortHeader id="count" sort={sort} setSort={setSort} num>Qtd</SortHeader>
              <th style={{width:36}}/>
            </tr></thead>
            <tbody>
              {stockRows.map(s => {
                const prod = ORION_DATA.products.find(p => p.name === s.product);
                const spec = prod && ORION_DATA.specs.find(sp => sp.id === prod.spec);
                const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
                const colorHex = COLOR_NAMES_INV[s.color] || 'var(--ink-3)';
                return (
                <tr key={s.sku} onClick={() => setOpen(s)}>
                  <td>
                    <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                      {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 16, height: 16, strokeWidth: 1.4 }) : <Icon name="file-text" size={13}/>}
                    </span>
                  </td>
                  <td className="mono">{s.sku}</td>
                  <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{s.product}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: colorHex, boxShadow: '0 0 0 1px var(--line), inset 0 0 0 1px rgba(255,255,255,.15)', flexShrink: 0 }}/>
                      <span style={{ color: 'var(--ink-2)' }}>{s.color}</span>
                    </span>
                  </td>
                  <td><span className="pill" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '.04em', minWidth: 28, justifyContent: 'center' }}>{s.size}</span></td>
                  <td>{s.print ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}><Icon name="palette" size={11} style={{color:'var(--ink-3)'}}/>{s.print}</span> : <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>—</span>}</td>
                  <td className="num" style={{ color: s.count < 10 ? 'var(--err)' : 'var(--ink)', fontWeight: 500 }}>{s.count}</td>
                  <td><Icon name="chevron-right" size={14} style={{color:'var(--ink-3)'}}/></td>
                </tr>
              );})}
            </tbody>
          </table>
        ) : (
          <table className="tbl">
            <thead><tr>
              <SortHeader id="date" sort={movSort} setSort={setMovSort}>Data</SortHeader>
              <SortHeader id="sku" sort={movSort} setSort={setMovSort}>SKU</SortHeader>
              <SortHeader id="reason" sort={movSort} setSort={setMovSort}>Motivo</SortHeader>
              <SortHeader id="qty" sort={movSort} setSort={setMovSort} num>Qtd</SortHeader>
            </tr></thead>
            <tbody>
              {movRows.map((m, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.date}</td>
                  <td className="mono">{m.sku}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Icon name={m.qty > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} size={13} style={{color: m.qty > 0 ? 'var(--ok)' : 'var(--err)'}}/>
                      {m.reason}
                    </span>
                  </td>
                  <td className="num" style={{ color: m.qty > 0 ? 'var(--ok)' : 'var(--err)', fontWeight: 500 }}>{m.qty > 0 ? '+' : ''}{m.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={!!open || adjustOpen} onClose={() => { setOpen(null); setAdjustOpen(false); }}
             title="Lançar movimentação"
             footer={null}>
        <AdjustStockBody initialSku={open?.sku} onClose={() => { setOpen(null); setAdjustOpen(false); }}/>
      </Sheet>
    </div>
  );
};

const AdjustStockBody = ({ initialSku, onClose }) => {
  const [sku, setSku] = React.useState(initialSku || ORION_DATA.stock[0]?.sku || '');
  const [qty, setQty] = React.useState(1);
  const [type, setType] = React.useState('entrada-banca');

  React.useEffect(() => { if (initialSku) setSku(initialSku); }, [initialSku]);

  const sel = ORION_DATA.stock.find(s => s.sku === sku);
  const move = MOVE_TYPES.find(m => m.id === type);
  const delta = move.dir === '+' ? qty : -qty;
  const projected = sel ? sel.count + delta : 0;

  const skuOpts = ORION_DATA.stock.map(s => ({
    value: s.sku,
    label: `${s.product} · ${s.color} · ${s.size}${s.print ? ' · ' + s.print : ''}`,
    sub: `${s.sku} · ${s.count} em estoque`,
  }));

  // Resolve product/spec/garment for hero glyph
  const prod = sel && ORION_DATA.products.find(p => p.name === sel.product);
  const spec = prod && ORION_DATA.specs.find(sp => sp.id === prod.spec);
  const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
  const status = sel ? (sel.count < 10 ? 'ruptura' : sel.count < 25 ? 'baixo' : 'ok') : 'ok';
  const statusColor = { ruptura: 'var(--err)', baixo: 'var(--warn)', ok: 'var(--ok)' }[status];

  const movs = sel ? ORION_DATA.movements.filter(m => m.sku === sel.sku) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1 }}>
        {/* Hero — current state of selected SKU */}
        {sel && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)' }}>
              {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 30, height: 30, strokeWidth: 1.4 })
                       : <Icon name="boxes" size={26}/>}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{sel.product}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: COLOR_NAMES_INV[sel.color] || 'var(--ink-3)', boxShadow: '0 0 0 1px var(--line), inset 0 0 0 1px rgba(255,255,255,.15)' }}/>
                  {sel.color}
                </span>
                <span className="pill" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, letterSpacing: '.04em', minWidth: 28, justifyContent: 'center' }}>{sel.size}</span>
                {sel.print && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--ink-2)' }}><Icon name="palette" size={11} style={{color:'var(--ink-3)'}}/>{sel.print}</span>}
                <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{sel.sku}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: statusColor, lineHeight: 1 }}>{sel.count}</div>
              <span className={`pill ${status === 'ruptura' ? 'err' : status === 'baixo' ? 'warn' : 'ok'}`} style={{ marginTop: 6 }}>{status}</span>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 22 }}>
          <SectionTitle>SKU</SectionTitle>
          <Select searchable value={sku} onChange={setSku} options={skuOpts}/>
        </div>

        <div style={{ marginBottom: 22 }}>
          <SectionTitle>Tipo de movimentação</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {MOVE_TYPES.map(m => {
              const active = type === m.id;
              const tone = m.dir === '+' ? 'var(--ok)' : 'var(--err)';
              return (
                <button key={m.id} type="button" onClick={() => setType(m.id)}
                  style={{
                    textAlign: 'left',
                    border: active ? `1.5px solid ${tone}` : '1px solid var(--line)',
                    background: active ? `color-mix(in oklab, ${tone} 8%, var(--surface))` : 'var(--surface)',
                    borderRadius: 10, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `color-mix(in oklab, ${tone} 14%, var(--surface))`,
                    color: tone, display: 'grid', placeItems: 'center',
                  }}>
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

        {sel && (
          <div style={{ marginBottom: 22 }}>
            <SectionTitle>Pré-visualização</SectionTitle>
            <div style={{
              background: 'var(--surface-2)', border: '1px solid var(--line-soft)',
              borderRadius: 12, padding: 16,
              display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', alignItems: 'center', gap: 8,
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Atual</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', lineHeight: 1.1 }}>{sel.count}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink-3)' }}>{move.dir}</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>{move.dir === '+' ? 'Entrada' : 'Saída'}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: move.dir === '+' ? 'var(--ok)' : 'var(--err)', lineHeight: 1.1 }}>{qty}</div>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink-3)' }}>=</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Final</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: projected < 0 ? 'var(--err)' : projected < 10 ? 'var(--warn)' : 'var(--ink)', lineHeight: 1.1 }}>{projected}</div>
              </div>
            </div>
            {projected < 0 && <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--err)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="alert-triangle" size={11}/> Estoque ficaria negativo.</div>}
            {projected >= 0 && projected < 10 && <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="alert-triangle" size={11}/> Após esta saída o SKU ficará em ruptura.</div>}
          </div>
        )}

        {sel && movs.length > 0 && (
          <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14 }}>
            <SectionTitle>Últimas movimentações</SectionTitle>
            {movs.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < movs.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
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

      <div style={{
        position: 'sticky', bottom: 0, marginLeft: -22, marginRight: -22, marginTop: 14,
        padding: '14px 22px', borderTop: '1px solid var(--line-soft)',
        background: 'var(--bg)', display: 'flex', justifyContent: 'flex-end', gap: 8,
      }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onClose} disabled={qty <= 0 || !sel}>
          <Icon name="check" size={13}/> Confirmar
        </button>
      </div>
    </div>
  );
};

Object.assign(window, { Fabric, Stock });
