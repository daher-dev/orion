// Production pages — Cutting, Sewing, Bancas

const OPERATORS = ['Joana Pires', 'Marcos Lima', 'Beatriz Rocha', 'Carlos Antunes'];

const CuttingDetail = ({ form, setForm, isNew }) => {
  const product = ORION_DATA.products.find(p => p.name === form.product);
  const spec = product && ORION_DATA.specs.find(s => s.id === product.spec);
  const garment = spec && GARMENT_TYPES.find(g => g.id === spec.tipo);
  const availableSizes = product ? product.sizes : [];
  const sizeMap = form.sizes || {};
  const totalPlanned = availableSizes.reduce((sum, sz) => sum + (sizeMap[sz]?.planned || 0), 0);
  const totalActual = availableSizes.reduce((sum, sz) => sum + (sizeMap[sz]?.actual || 0), 0);
  const handleProductChange = (v) => {
    const p = ORION_DATA.products.find(pp => pp.name === v);
    const newSizes = {};
    if (p) p.sizes.forEach(s => { newSizes[s] = { planned: 0, actual: 0 }; });
    setForm({ ...form, product: v, sizes: newSizes });
  };
  const setSizeField = (sz, key, val) => {
    setForm({ ...form, sizes: { ...sizeMap, [sz]: { ...(sizeMap[sz] || { planned: 0, actual: 0 }), [key]: val } } });
  };
  return (
    <div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 48, height: 48, borderRadius: 12, background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', color: 'var(--brand-prod)', display: 'grid', placeItems: 'center' }}>
          {garment ? React.cloneElement(GARMENT_GLYPHS[garment.id], { width: 22, height: 22, strokeWidth: 1.5 }) : <Icon name="scissors" size={22}/>}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{form.product || 'Selecione um produto'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {form.roll ? `Bobina ${form.roll}` : 'Sem bobina vinculada'}
            {totalPlanned > 0 ? ` · ${totalPlanned} peças planejadas` : ''}
          </div>
        </div>
        {!isNew && <StatusPill s={form.status}/>}
      </div>

      {!isNew && (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Progresso</div>
          <div style={{ marginBottom: 18, padding: 14, background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)' }}>{totalActual}<span style={{ color: 'var(--ink-3)', fontSize: 16 }}> / {totalPlanned}</span></span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{totalPlanned > 0 ? Math.round((totalActual/totalPlanned)*100) : 0}% completo</span>
            </div>
            <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalPlanned > 0 ? (totalActual/totalPlanned)*100 : 0}%`, background: 'var(--brand-prod)', borderRadius: 999 }}/>
            </div>
          </div>
        </>
      )}

      <div className="field" style={{ marginTop: 4 }}><label>Produto a cortar</label>
        <Select value={form.product} onChange={handleProductChange}
          options={ORION_DATA.products.map(p => {
            const sp = ORION_DATA.specs.find(s => s.id === p.spec);
            const g = sp && GARMENT_TYPES.find(gg => gg.id === sp.tipo);
            return { value: p.name, label: p.name, sub: p.code, _garment: g };
          })}
          renderOption={(o) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>
                {o._garment ? React.cloneElement(GARMENT_GLYPHS[o._garment.id], { width: 13, height: 13, strokeWidth: 1.5 }) : <Icon name="shirt" size={13}/>}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{o.label}</span>
              <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{o.sub}</span>
            </span>
          )}/>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginTop: 18 }}>Bobina</div>
      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Bobina {spec?.ribanaUsa ? 'corpo' : 'de tecido'}
          {spec && (
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--brand-prod)', background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', padding: '2px 6px', borderRadius: 4, textTransform: 'none', letterSpacing: 0 }}>{spec.fabric} · {spec.gsm}g · {spec.consumo}kg/pç</span>
          )}
        </label>
        <Select value={form.roll} onChange={(v) => setForm({...form, roll: v})}
          options={ORION_DATA.fabric.filter(f => f.kind === 'corpo').map(f => ({ value: f.id, label: `${f.id} · ${f.type}`, sub: `${f.color} · ${f.current}kg`, _fabric: f }))}
          renderOption={(o) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name="grid-3x3" size={14} strokeWidth={1.5}/></span>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{o._fabric.id}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o._fabric.type}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{o._fabric.color} · {o._fabric.gsm}g/m² · {o._fabric.current}kg disponível</span>
              </span>
            </span>
          )}/>
      </div>
      {spec?.ribanaUsa && (
        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Bobina ribana
            <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--brand-prod)', background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', padding: '2px 6px', borderRadius: 4, textTransform: 'none', letterSpacing: 0 }}>{spec.ribanaTipo} · {spec.ribanaPct}%</span>
          </label>
          <Select value={form.rollRibana} onChange={(v) => setForm({...form, rollRibana: v})}
            options={ORION_DATA.fabric.filter(f => f.kind === 'ribana').map(f => ({ value: f.id, label: `${f.id} · ${f.type}`, sub: `${f.color} · ${f.current}kg`, _fabric: f }))}
            renderOption={(o) => (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name="underline" size={14} strokeWidth={1.5}/></span>
                <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{o._fabric.id}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o._fabric.type}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{o._fabric.color} · {o._fabric.gsm}g/m² · {o._fabric.current}kg disponível</span>
                </span>
              </span>
            )}/>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Peças por tamanho</span>
        {totalPlanned > 0 && <span style={{ fontWeight: 500, color: 'var(--ink-2)', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>{isNew ? `${totalPlanned} total` : `${totalActual} / ${totalPlanned}`}</span>}
      </div>
      {availableSizes.length === 0 ? (
        <div style={{ padding: '20px 14px', background: 'var(--surface-2)', border: '1px dashed var(--line)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
          Selecione um produto para definir a grade de tamanhos
        </div>
      ) : (
        <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isNew ? '70px 1fr' : '70px 1fr 1fr', background: 'var(--surface-2)', padding: '8px 14px', fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, borderBottom: '1px solid var(--line-soft)' }}>
            <span>Tam.</span>
            <span style={{ textAlign: 'right' }}>Planejado</span>
            {!isNew && <span style={{ textAlign: 'right' }}>Cortado</span>}
          </div>
          {availableSizes.map((sz, i) => {
            const data = sizeMap[sz] || { planned: 0, actual: 0 };
            const pct = data.planned > 0 ? Math.min(100, (data.actual/data.planned)*100) : 0;
            return (
              <div key={sz} style={{ display: 'grid', gridTemplateColumns: isNew ? '70px 1fr' : '70px 1fr 1fr', alignItems: 'center', padding: '10px 14px', borderBottom: i < availableSizes.length - 1 ? '1px solid var(--line-soft)' : 'none', gap: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{sz}</span>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 100 }}>
                    <NumField value={data.planned} onChange={(v) => setSizeField(sz, 'planned', v)} step={1} min={0} decimals={0}/>
                  </div>
                </div>
                {!isNew && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button"
                      onClick={() => setSizeField(sz, 'actual', data.planned)}
                      disabled={data.planned === 0 || data.actual === data.planned}
                      title="Marcar como cortado (igualar ao planejado)"
                      style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, border: '1px solid var(--line)', background: data.actual === data.planned && data.planned > 0 ? 'var(--brand-prod)' : 'var(--surface)', color: data.actual === data.planned && data.planned > 0 ? '#fff' : 'var(--ink-3)', cursor: data.planned === 0 || data.actual === data.planned ? 'default' : 'pointer', opacity: data.planned === 0 ? 0.4 : 1, padding: 0, flexShrink: 0, transition: 'all .15s' }}>
                      <Icon name="check" size={12} strokeWidth={2.5}/>
                    </button>
                    <div style={{ flex: 1, height: 4, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden', maxWidth: 70 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-prod)' }}/>
                    </div>
                    <div style={{ width: 100 }}>
                      <NumField value={data.actual} onChange={(v) => setSizeField(sz, 'actual', v)} step={1} min={0} decimals={0}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: 'grid', gridTemplateColumns: isNew ? '70px 1fr' : '70px 1fr 1fr', padding: '10px 14px', background: 'var(--surface-2)', borderTop: '1px solid var(--line-soft)', fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Total</span>
            <span className="num" style={{ textAlign: 'right' }}>{totalPlanned}</span>
            {!isNew && <span className="num" style={{ textAlign: 'right' }}>{totalActual}</span>}
          </div>
        </div>
      )}

      {!isNew && (() => {
        const prevCorpo = spec ? +(spec.consumo * totalActual).toFixed(2) : 0;
        const prevRibana = spec?.ribanaUsa ? +(prevCorpo * (spec.ribanaPct / 100)).toFixed(2) : 0;
        const consCorpo = form.consumed ?? 0;
        const consRibana = form.consumedRibana ?? 0;
        const rollCorpo = ORION_DATA.fabric.find(f => f.id === form.roll);
        const rollRibana = ORION_DATA.fabric.find(f => f.id === form.rollRibana);
        const Row = ({ icon, label, sub, prev, cons, onChange, available }) => {
          const diff = +(cons - prev).toFixed(2);
          const overspend = diff > 0.01;
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 70px', alignItems: 'center', padding: '12px 14px', gap: 12, borderTop: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name={icon} size={14} strokeWidth={1.5}/></span>
                <div style={{ minWidth: 0 }}>
                  <div className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{label}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
                </div>
              </div>
              <div className="num" style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>{prev.toFixed(2)} <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>kg</span></div>
              <NumField value={cons} onChange={onChange} step={0.1} min={0} decimals={2} suffix="kg"/>
              <div className="num" style={{ fontSize: 12, textAlign: 'right', color: cons === 0 ? 'var(--ink-3)' : overspend ? 'var(--err)' : diff < -0.01 ? 'var(--ok)' : 'var(--ink-3)' }}>
                {cons === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(2)}`}
              </div>
            </div>
          );
        };
        return (
          <>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Peso consumido</span>
              <span style={{ fontWeight: 500, color: 'var(--ink-3)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>previsto · consumido · Δ</span>
            </div>
            <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 70px', padding: '8px 14px', background: 'var(--surface-2)', fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, gap: 12 }}>
                <span>Bobina</span>
                <span style={{ textAlign: 'right' }}>Previsto</span>
                <span style={{ textAlign: 'right' }}>Consumido</span>
                <span style={{ textAlign: 'right' }}>Δ</span>
              </div>
              {form.roll ? (
                <Row icon="grid-3x3"
                  label={form.roll}
                  sub={rollCorpo ? `${rollCorpo.type} · ${rollCorpo.color}` : 'Bobina corpo'}
                  prev={prevCorpo} cons={consCorpo}
                  onChange={(v) => setForm({ ...form, consumed: v })}/>
              ) : (
                <div style={{ padding: '14px', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', background: 'var(--surface-2)' }}>Selecione uma bobina para registrar o peso</div>
              )}
              {spec?.ribanaUsa && form.rollRibana && (
                <Row icon="underline"
                  label={form.rollRibana}
                  sub={rollRibana ? `${rollRibana.type} · ${rollRibana.color}` : 'Bobina ribana'}
                  prev={prevRibana} cons={consRibana}
                  onChange={(v) => setForm({ ...form, consumedRibana: v })}/>
              )}
            </div>
          </>
        );
      })()}

      <div className="field" style={{ marginTop: 18 }}><label>Operador responsável</label>
        <Select value={form.operator} onChange={(v) => setForm({...form, operator: v})}
          options={OPERATORS.map(o => ({ value: o, label: o }))}/>
      </div>
    </div>
  );
};

const Cutting = () => {
  const [view, setView] = React.useState('kanban');
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [items, setItems] = React.useState(ORION_DATA.cutting);
  const [dragId, setDragId] = React.useState(null);
  const [overCol, setOverCol] = React.useState(null);
  const [hoverId, setHoverId] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [sort, setSort] = React.useState({ key: 'code', dir: 'desc' });
  const [expanded, setExpanded] = React.useState(() => new Set());
  const toggleExpand = (id) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const moveTo = (id, status) => setItems(arr => arr.map(it => it.id === id ? { ...it, status } : it));
  const emptyForm = { product: '', roll: '', rollRibana: '', sizes: {}, operator: '', date: '', status: 'pendente', consumed: 0, consumedRibana: 0 };
  const [form, setForm] = React.useState(emptyForm);
  const openNew = () => { setForm(emptyForm); setNewOpen(true); };
  const openExisting = (c) => {
    const sizes = {};
    if (c.grade) {
      c.grade.forEach(g => { sizes[g.size] = { planned: g.planned, actual: g.actual }; });
    } else {
      // Distribui planned/actual legados igualmente entre os tamanhos do produto
      const p = ORION_DATA.products.find(pp => pp.name === c.product);
      if (p) {
        const n = p.sizes.length;
        const basePl = Math.floor(c.planned / n), baseAc = Math.floor(c.actual / n);
        const remPl = c.planned - basePl * n, remAc = c.actual - baseAc * n;
        p.sizes.forEach((s, i) => { sizes[s] = { planned: basePl + (i < remPl ? 1 : 0), actual: baseAc + (i < remAc ? 1 : 0) }; });
      }
    }
    setForm({ ...c, sizes });
    setOpen(c);
  };
  const groups = [
    { id: 'pendente', label: 'Pendente' },
    { id: 'cortando', label: 'Cortando' },
    { id: 'concluido', label: 'Concluído' },
  ];

  const cutGlyph = (productName, px = 14) => {
    const p = ORION_DATA.products.find(pp => pp.name === productName);
    const spec = p && ORION_DATA.specs.find(s => s.id === p.spec);
    const g = spec && GARMENT_TYPES.find(gg => gg.id === spec.tipo);
    return g && GARMENT_GLYPHS[g.id] ? React.cloneElement(GARMENT_GLYPHS[g.id], { width: px, height: px, strokeWidth: 1.5 }) : <Icon name="shirt" size={px}/>;
  };
  // distribui cada ordem nas colunas conforme a grade. Ordens parciais aparecem
  // em DUAS colunas — tamanhos ainda abertos em "Cortando" e os já cortados
  // viram um eco em "Concluído".
  const placementsFor = (colId) => {
    const out = [];
    items.forEach(c => {
      const lines = c.grade || [];
      const open = lines.filter(l => (l.actual || 0) < l.planned);
      const done = lines.filter(l => l.planned > 0 && (l.actual || 0) >= l.planned);
      if (c.status === 'pendente') { if (colId === 'pendente') out.push({ c, lines, role: 'primary' }); }
      else if (c.status === 'concluido') { if (colId === 'concluido') out.push({ c, lines, role: 'primary' }); }
      else { // cortando
        if (open.length) {
          if (colId === 'cortando') out.push({ c, lines: open, role: 'primary' });
          if (colId === 'concluido' && done.length) out.push({ c, lines: done, role: 'echo' });
        } else if (colId === 'concluido') out.push({ c, lines, role: 'primary' });
      }
    });
    return out;
  };

  // ── tabela: filtro + ordenação + subrows por tamanho ──
  const sortVal = (c, key) => {
    if (key === 'planned') return c.planned || 0;
    if (key === 'actual') return c.actual || 0;
    if (key === 'product') return (c.product || '').toLowerCase();
    if (key === 'operator') return (c.operator || '').toLowerCase();
    if (key === 'date') { const [d, m] = (c.date || '').split('/').map(Number); return (m || 0) * 100 + (d || 0); }
    return c.code;
  };
  const visibleRows = items
    .filter(c => statusFilter === 'all' ? true : c.status === statusFilter)
    .filter(c => { const q = query.trim().toLowerCase(); return !q || c.code.toLowerCase().includes(q) || (c.product || '').toLowerCase().includes(q); })
    .slice().sort((a, b) => { const va = sortVal(a, sort.key), vb = sortVal(b, sort.key); const cmp = va < vb ? -1 : va > vb ? 1 : 0; return sort.dir === 'asc' ? cmp : -cmp; });
  const setSortKey = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  const SortTh = ({ k, label, num }) => (
    <th className={num ? 'num' : ''} onClick={() => setSortKey(k)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: num ? 'flex-end' : 'flex-start' }}>{label}<Icon name={sort.key === k ? (sort.dir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} size={12} style={{ color: sort.key === k ? 'var(--ink-2)' : 'var(--ink-3)', opacity: sort.key === k ? 1 : 0.45 }}/></span>
    </th>
  );
  return (
    <div className="page">
      <PageHead sub="cutting" title="Corte" titleEm="& planejamento"
                desc="Lotes de corte abatidos das bobinas de tecido."
                actions={<>
                  <Seg value={view} onChange={setView} options={[{value:'kanban',label:'Kanban'},{value:'table',label:'Tabela'}]}/>
                  <button className="btn btn-primary" onClick={openNew}><Icon name="scissors" size={14}/> Nova ordem</button>
                </>}/>
      <HelpCard id="cutting" icon="scissors" tone="var(--brand-prod)" maxW={720} title="Corte — planeje lotes contra suas bobinas">
        <HelpBody>
          Você planeja uma <b>ordem de corte</b> escolhendo a ficha, os tamanhos e as quantidades; o Orion calcula o <b>consumo de tecido</b> e <b>abate da bobina</b>. As peças cortadas seguem para a costura nas bancas.
        </HelpBody>
        <Flow accent="var(--brand-prod)" steps={[
          { icon: 'layers', label: 'Bobina', sub: 'tecido em estoque' },
          { icon: 'scissors', label: 'Corte', sub: 'abate o saldo', tone: 'accent' },
          { icon: 'shirt', label: 'Cortadas', sub: 'por tamanho' },
          { icon: 'send', label: 'Costura', sub: 'nas bancas', tone: 'ok' },
        ]}/>
      </HelpCard>
      {view === 'kanban' ? (
        <div className={`grid g-cols-${groups.length}`}>
          {groups.map(g => {
            const place = placementsFor(g.id);
            const isOver = overCol === g.id;
            return (
              <div key={g.id}
                onDragOver={(e) => { e.preventDefault(); setOverCol(g.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
                onDrop={(e) => { e.preventDefault(); if (dragId) moveTo(dragId, g.id); setDragId(null); setOverCol(null); }}
                style={{ background: isOver ? 'color-mix(in oklab, var(--brand-prod) 6%, var(--surface))' : 'var(--surface)', border: `1px ${isOver ? 'dashed' : 'solid'} ${isOver ? 'var(--brand-prod)' : 'var(--line)'}`, borderRadius: 'var(--radius-lg)', padding: 12, transition: 'background .15s, border-color .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusPill s={g.id}/>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{place.length}</span>
                  </div>
                  {g.id === 'pendente' && (
                    <button className="btn btn-sm btn-ghost" onClick={openNew}><Icon name="scissors" size={12}/></button>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 8, minHeight: 40 }}>
                  {place.map(({ c, lines, role }) => {
                    const planned = lines.reduce((s, l) => s + (l.planned || 0), 0);
                    const actual = lines.reduce((s, l) => s + (l.actual || 0), 0);
                    const allP = (c.grade || []).reduce((s, l) => s + (l.planned || 0), 0);
                    const allA = (c.grade || []).reduce((s, l) => s + (l.actual || 0), 0);
                    const partial = allA > 0 && allA < allP;
                    const tear = partial ? (role === 'echo' ? 'top' : 'bottom') : null;
                    const hot = hoverId === c.id;
                    const cardInner = (
                      <div key={c.id + '-' + role} onClick={() => openExisting(c)} draggable={role === 'primary'}
                        onMouseEnter={() => setHoverId(c.id)} onMouseLeave={() => setHoverId(h => h === c.id ? null : h)}
                        onDragStart={role === 'primary' ? (e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                        onDragEnd={() => { setDragId(null); setOverCol(null); }}
                        style={{ background: hot ? 'color-mix(in oklab, var(--brand-prod) 5%, var(--bg))' : 'var(--bg)', border: `1px solid ${hot ? 'var(--brand-prod)' : 'var(--line-soft)'}`, borderRadius: 'var(--radius-sm)', padding: 12, cursor: role === 'primary' ? 'grab' : 'pointer', opacity: dragId === c.id && role === 'primary' ? 0.4 : 1, transform: hot ? 'translateY(-1px)' : 'none', boxShadow: hot ? '0 4px 14px rgba(0,0,0,.07)' : 'none', transition: 'transform .14s, box-shadow .14s, border-color .14s, background .14s', ...(tear ? tornEdgeStyle(tear) : {}) }}>
                        {/* topo: produto (ativo) + ID esmaecido */}
                        <CardHead glyph={cutGlyph(c.product, 15)} title={c.product} sub={c.color} code={c.code}/>
                        {/* ativo: tamanhos + progresso */}
                        <div style={{ display: 'grid', gap: 9, marginTop: 11 }}>
                          {lines.map(l => {
                            const pct = l.planned > 0 ? Math.min(100, ((l.actual || 0) / l.planned) * 100) : 0;
                            const ldone = l.planned > 0 && (l.actual || 0) >= l.planned;
                            return (
                              <div key={l.size} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <span className="mono" style={{ minWidth: 30, height: 24, padding: '0 6px', borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', flexShrink: 0 }}>{l.size}</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <span className="num" style={{ fontSize: 12.5, color: ldone ? 'var(--ok)' : 'var(--ink)', fontFamily: 'var(--font-display)' }}>{l.actual || 0}<span style={{ color: 'var(--ink-3)' }}>/{l.planned}</span></span>
                                  </div>
                                  <div style={{ height: 4, background: 'var(--line-soft)', borderRadius: 999, marginTop: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: ldone ? 'var(--ok)' : 'var(--brand-prod)', borderRadius: 999 }}/>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* rodapé: metadados */}
                        <div style={CARD_FOOTER}>
                          <CardMeta glyph={<Av name={c.operator} color="#10b981" size={16}/>} tone="var(--ink-2)">{c.operator}</CardMeta>
                          <CardMeta icon="calendar">{c.date}</CardMeta>
                          <CardMeta glyph={<FabricThumb tone="warm" size={14}/>}>{c.roll}</CardMeta>
                        </div>
                      </div>
                    );
                    return tear ? <div key={c.id + '-' + role} style={tornWrapStyle()}>{cardInner}<TornStroke edge={tear} color={hot ? 'var(--brand-prod)' : 'var(--line-soft)'} id={'ts-' + c.id + '-' + role}/></div> : cardInner;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <TableToolbar>
            <SearchInput placeholder="Buscar ordem ou produto…" value={query} onChange={setQuery}/>
            <Seg value={statusFilter} onChange={setStatusFilter} options={[
              { value: 'all', label: 'Todas' },
              { value: 'pendente', label: 'Pendente' },
              { value: 'cortando', label: 'Cortando' },
              { value: 'concluido', label: 'Concluído' },
            ]}/>
          </TableToolbar>
          <table className="tbl">
            <thead><tr>
              <th style={{ width: 30 }}/>
              <SortTh k="code" label="Código"/>
              <SortTh k="product" label="Produto"/>
              <th>Bobina</th>
              <SortTh k="operator" label="Operador"/>
              <th>Status</th>
              <SortTh k="planned" label="Plano" num/>
              <SortTh k="actual" label="Real" num/>
              <SortTh k="date" label="Data"/>
            </tr></thead>
            <tbody>
              {visibleRows.map(c => {
                const isExp = expanded.has(c.id);
                return (
                  <React.Fragment key={c.id}>
                    <tr onClick={() => openExisting(c)}>
                      <td onClick={(e) => { e.stopPropagation(); toggleExpand(c.id); }} style={{ cursor: 'pointer', textAlign: 'center', color: isExp ? 'var(--brand-prod)' : 'var(--ink-3)' }}><Icon name={isExp ? 'chevron-down' : 'chevron-right'} size={14}/></td>
                      <td className="mono">{c.code}</td>
                      <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.product}</td>
                      <td className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.roll}</td>
                      <td>{c.operator}</td>
                      <td><StatusPill s={c.status}/></td>
                      <td className="num">{c.planned}</td>
                      <td className="num">{c.actual}</td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.date}</td>
                    </tr>
                    {isExp && (c.grade || []).map(l => {
                      const pct = l.planned > 0 ? Math.min(100, ((l.actual || 0) / l.planned) * 100) : 0;
                      const ldone = l.planned > 0 && (l.actual || 0) >= l.planned;
                      return (
                        <tr key={c.id + '-' + l.size} style={{ background: 'var(--surface-2)' }}>
                          <td/>
                          <td colSpan={4}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <span className="mono" style={{ minWidth: 28, height: 22, padding: '0 6px', borderRadius: 5, background: 'var(--surface)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{l.size}</span>
                              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Tamanho {l.size}</span>
                            </div>
                          </td>
                          <td/>
                          <td className="num" style={{ color: 'var(--ink-3)' }}>{l.planned}</td>
                          <td className="num" style={{ color: ldone ? 'var(--ok)' : 'var(--ink)', fontWeight: 500 }}>{l.actual || 0}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, maxWidth: 90, height: 5, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: ldone ? 'var(--ok)' : 'var(--brand-prod)', borderRadius: 999 }}/></div>
                              <span className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{Math.round(pct)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {visibleRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--ink-3)', fontSize: 13 }}>Nenhuma ordem encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? `Ordem ${open.code}` : ''}
             sub={open ? <span style={{fontSize:12,color:'var(--ink-3)'}}>{open.product}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir ordem</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn btn-primary" onClick={() => setOpen(null)}><Icon name="check" size={13}/> Salvar alterações</button>
             </>}>
        {open && <CuttingDetail form={form} setForm={setForm} isNew={false}/>}
      </Sheet>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)}
             title="Nova ordem de corte"
             sub={<span style={{fontSize:12,color:'var(--ink-3)'}}>Planeje um novo lote contra uma bobina</span>}
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => setNewOpen(false)}><Icon name="scissors" size={13}/> Criar ordem</button>
             </>}>
        <CuttingDetail form={form} setForm={setForm} isNew={true}/>
      </Sheet>
    </div>
  );
};

const blankGlyph = (g, px = 16) => (window.GARMENT_GLYPHS && window.GARMENT_GLYPHS[g])
  ? React.cloneElement(window.GARMENT_GLYPHS[g], { width: px, height: px, strokeWidth: 1.4 })
  : <Icon name="shirt" size={px}/>;

// Agrupa linhas de peças por TIPO (base + cor); cada grupo lista seus tamanhos.
const groupByType = (lines) => {
  const m = new Map();
  (lines || []).forEach(l => {
    const b = ORION_DATA.blankPieces.find(x => x.id === l.id) || {};
    const key = `${b.base || l.id}|${b.color || ''}`;
    if (!m.has(key)) m.set(key, { key, base: b.base || l.id, color: b.color || '', garment: b.garment, rows: [] });
    m.get(key).rows.push({ l, b });
  });
  return [...m.values()];
};

// Marca uma ordem/remessa que está dividida entre duas colunas (entrega parcial).
// Mesmo desenho nos dois lados do split — o ícone de elo reforça que são o mesmo lote.
const PartialChip = () => (
  <span className="pill warn" style={{ fontSize: 9.5, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
    <Icon name="link" size={9} strokeWidth={2.2}/> parcial
  </span>
);

// Borda "rasgada" (paper-cut) para uma ordem PARCIAL dividida em duas colunas: dentes
// em V no RODAPÉ da metade ativa (coluna do meio) e no TOPO do eco (coluna concluída).
// As duas metades se encaixam visualmente como um mesmo card rasgado ao meio — substitui
// o PartialChip no Corte e na Impressão. edge: 'bottom' | 'top'.
//
// As laterais retas mantêm a BORDA real de 1px do card (igual aos demais). O dente em V não
// pode usar a borda (a mask recortaria a linha reta em fragmentos), então o traço dos dentes
// é um SVG vetorial de 1px (TornStroke) posicionado exatamente sobre o corte, no WRAPPER sem
// mask — mesma espessura e cor da borda lateral, trocando para o brand no hover.
const TEAR_W = 17, TEAR_A = 9; // largura e profundidade de cada dente
// Estilo do CARD mascarado: mantém as bordas retas, remove só a borda do lado cortado.
const tornEdgeStyle = (edge) => {
  const bottom = edge === 'bottom';
  const body = `linear-gradient(#000 0 0) ${bottom ? 'top' : 'bottom'}/100% calc(100% - ${TEAR_A}px) no-repeat`;
  // dentes alinhados À ESQUERDA (left) para casar a fase com o pattern do TornStroke.
  const teeth = bottom
    ? `conic-gradient(from 315deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) left bottom/${TEAR_W}px ${TEAR_A}px repeat-x`
    : `conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) left top/${TEAR_W}px ${TEAR_A}px repeat-x`;
  const mask = `${body}, ${teeth}`;
  const base = { WebkitMask: mask, mask };
  return bottom
    ? { ...base, paddingBottom: 12 + TEAR_A, borderBottom: 'none' }
    : { ...base, paddingTop: 12 + TEAR_A, borderTop: 'none' };
};
const tornWrapStyle = () => ({ position: 'relative', alignSelf: 'start' });
// Traço vetorial de 1px que percorre os dentes em V, alinhado ao corte da mask.
const TornStroke = ({ edge, color, id }) => {
  const bottom = edge === 'bottom';
  const d = bottom ? `M0 0 L${TEAR_W / 2} ${TEAR_A} L${TEAR_W} 0` : `M0 ${TEAR_A} L${TEAR_W / 2} 0 L${TEAR_W} ${TEAR_A}`;
  return (
    <svg width="100%" height={TEAR_A} preserveAspectRatio="none" aria-hidden="true"
         style={{ position: 'absolute', left: 0, [bottom ? 'bottom' : 'top']: 0, display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={TEAR_W} height={TEAR_A}>
          <path d={d} fill="none" stroke={color} strokeWidth="1" shapeRendering="geometricPrecision"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height={TEAR_A} fill={`url(#${id})`}/>
    </svg>
  );
};

// Glifo do tipo de peça a partir do nome do produto (produto → ficha → tipo).
const productGlyph = (productName, px = 14) => {
  const p = ORION_DATA.products.find(pp => pp.name === productName);
  const spec = p && ORION_DATA.specs.find(s => s.id === p.spec);
  const g = spec && window.GARMENT_TYPES && window.GARMENT_TYPES.find(gg => gg.id === spec.tipo);
  return g && window.GARMENT_GLYPHS && window.GARMENT_GLYPHS[g.id]
    ? React.cloneElement(window.GARMENT_GLYPHS[g.id], { width: px, height: px, strokeWidth: 1.5 })
    : <Icon name="shirt" size={px}/>;
};

// Rodapé padrão dos cards de kanban: faixa de metadados que quebra em linha.
const CARD_FOOTER = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 9px', marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--line-soft)' };
const CardMeta = ({ icon, glyph, tone, weight, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: tone || 'var(--ink-3)', fontWeight: weight || 400, minWidth: 0, maxWidth: '100%' }}>
    {glyph || (icon && <Icon name={icon} size={11}/>)}
    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
  </span>
);
// Cabeçalho padrão: identidade do ativo à esquerda, ID esmaecido à direita.
const CardHead = ({ glyph, title, sub, code }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
    {glyph && <span style={{ color: 'var(--ink-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{glyph}</span>}
    {(title || sub) && (
      <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 6, overflow: 'hidden' }}>
        {title && <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>}
        {sub && <span style={{ fontSize: 11.5, color: 'var(--ink-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
    )}
    {code && <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', marginLeft: 'auto', flexShrink: 0 }}>{code}</span>}
  </div>
);

const sewSectionLabel = (extra) => ({
  fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600,
  marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginTop: 18,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...extra,
});

// blank zeroed lines for a NEW remessa: one row per blank-piece type in the catalog
const newSewingLines = () => ORION_DATA.blankPieces.map(b => ({ id: b.id, planned: 0, received: 0, credited: 0 }));

// ───────────────────────────── Costura detail ─────────────────────────────
const SewingDetail = ({ form, setForm, isNew }) => {
  const banca = ORION_DATA.bancas.find(b => b.name === form.banca);
  const lines = (form.lines || []).filter(l => isNew || l.planned > 0);
  const totalPlanned = lines.reduce((s, l) => s + (l.planned || 0), 0);
  const totalReceived = lines.reduce((s, l) => s + (l.received || 0), 0);
  const defects = form.defects || 0;
  const defectRate = totalReceived > 0 ? (defects / totalReceived) * 100 : 0;
  const setLine = (id, key, val) => setForm({ ...form, lines: (form.lines || []).map(l => l.id === id ? { ...l, [key]: val } : l) });
  const cols = isNew ? '1fr 96px' : '1fr 96px 1.3fr';
  // Agrupa as linhas por TIPO de peça (base + cor); cada grupo lista seus tamanhos.
  const grouped = (() => {
    const m = new Map();
    lines.forEach(l => {
      const b = ORION_DATA.blankPieces.find(x => x.id === l.id) || {};
      const key = `${b.base || l.id}|${b.color || ''}`;
      if (!m.has(key)) m.set(key, { base: b.base || l.id, color: b.color || '', garment: b.garment, rows: [] });
      m.get(key).rows.push({ l, b });
    });
    return [...m.values()];
  })();

  return (
    <div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 48, height: 48, borderRadius: 12, background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', color: 'var(--brand-prod)', display: 'grid', placeItems: 'center' }}>
          <Icon name="factory" size={22}/>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{form.banca || 'Selecione uma banca'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {banca ? banca.contact : 'Enviada à banca terceirizada'}
            {totalPlanned > 0 ? ` · ${totalPlanned} peças enviadas` : ''}
          </div>
        </div>
        {!isNew && <StatusPill s={form.status}/>}
      </div>

      {!isNew && (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Progresso</div>
          <div style={{ marginBottom: 18, padding: 14, background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)' }}>{totalReceived}<span style={{ color: 'var(--ink-3)', fontSize: 16 }}> / {totalPlanned}</span></span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{totalPlanned > 0 ? Math.round((totalReceived / totalPlanned) * 100) : 0}% recebido</span>
            </div>
            <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalPlanned > 0 ? (totalReceived / totalPlanned) * 100 : 0}%`, background: 'var(--brand-prod)', borderRadius: 999 }}/>
            </div>
          </div>
        </>
      )}

      <div className="field" style={{ marginTop: 4 }}><label>Banca de costura</label>
        <Select value={form.banca} onChange={(v) => setForm({ ...form, banca: v })}
          options={ORION_DATA.bancas.map(b => ({ value: b.name, label: b.name, sub: b.capacity, _b: b }))}
          renderOption={(o) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--line-soft)', display: 'grid', placeItems: 'center', color: 'var(--brand-prod)', flexShrink: 0 }}><Icon name="factory" size={13}/></span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{o.label}</span>
              <span style={{ fontSize: 10.5, color: o._b.ontime >= 90 ? 'var(--ok)' : o._b.ontime >= 80 ? 'var(--warn)' : 'var(--err)' }}>{o._b.ontime}% no prazo</span>
            </span>
          )}/>
      </div>
      {isNew && (
        <div className="field"><label>Data prevista de retorno</label>
          <input value={form.expected || ''} onChange={(e) => setForm({ ...form, expected: e.target.value })} placeholder="DD/MM"/>
        </div>
      )}

      <div style={sewSectionLabel()}>
        <span>Peças por tipo</span>
        {totalPlanned > 0 && <span style={{ fontWeight: 500, color: 'var(--ink-2)', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>{isNew ? `${totalPlanned} a enviar` : `${totalReceived} / ${totalPlanned}`}</span>}
      </div>
      {isNew && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10, marginTop: -4 }}>Informe quantas peças cortadas de cada tipo seguem nesta remessa. Só as linhas com quantidade entram.</div>
      )}
      {lines.length === 0 ? (
        <div style={{ padding: '20px 14px', background: 'var(--surface-2)', border: '1px dashed var(--line)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
          Nenhuma peça nesta remessa.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--surface-2)', padding: '8px 14px', fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, borderBottom: '1px solid var(--line-soft)', gap: 12 }}>
            <span>Tipo · tamanho</span>
            <span style={{ textAlign: 'right' }}>Enviado</span>
            {!isNew && <span style={{ textAlign: 'right' }}>Recebido</span>}
          </div>
          {grouped.map(grp => {
            const gp = grp.rows.reduce((s, r) => s + (r.l.planned || 0), 0);
            const gr = grp.rows.reduce((s, r) => s + (r.l.received || 0), 0);
            return (
              <React.Fragment key={grp.base + '|' + grp.color}>
                {/* cabeçalho do tipo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line-soft)' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>{blankGlyph(grp.garment, 15)}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, color: 'var(--ink)' }}>{grp.base}</span>
                  {grp.color && <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{grp.color}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>{isNew ? gp : `${gr} / ${gp}`}</span>
                </div>
                {grp.rows.map(({ l, b }) => {
                  const pct = l.planned > 0 ? Math.min(100, ((l.received || 0) / l.planned) * 100) : 0;
                  const done = l.planned > 0 && l.received === l.planned;
                  return (
                    <div key={l.id} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', padding: '10px 14px 10px 24px', borderBottom: '1px solid var(--line-soft)', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <span className="mono" style={{ minWidth: 32, height: 24, padding: '0 7px', borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', flexShrink: 0 }}>{b.size || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: 88 }}><NumField value={l.planned} onChange={(v) => setLine(l.id, 'planned', v)} step={1} min={0} decimals={0}/></div>
                      </div>
                      {!isNew && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <button type="button"
                            onClick={() => setLine(l.id, 'received', l.planned)}
                            disabled={l.planned === 0 || done}
                            title="Marcar como recebido (igualar ao enviado)"
                            style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, border: '1px solid var(--line)', background: done ? 'var(--brand-prod)' : 'var(--surface)', color: done ? '#fff' : 'var(--ink-3)', cursor: l.planned === 0 || done ? 'default' : 'pointer', opacity: l.planned === 0 ? 0.4 : 1, padding: 0, flexShrink: 0, transition: 'all .15s' }}>
                            <Icon name="check" size={12} strokeWidth={2.5}/>
                          </button>
                          <div style={{ flex: 1, height: 4, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden', maxWidth: 56 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-prod)' }}/>
                          </div>
                          <div style={{ width: 76 }}><NumField value={l.received || 0} onChange={(v) => setLine(l.id, 'received', v)} step={1} min={0} decimals={0}/></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
          <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 14px', background: 'var(--surface-2)', fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Total</span>
            <span className="num" style={{ textAlign: 'right' }}>{totalPlanned}</span>
            {!isNew && <span className="num" style={{ textAlign: 'right' }}>{totalReceived}</span>}
          </div>
        </div>
      )}

      {!isNew && (
        <>
          <div style={sewSectionLabel()}>
            <span>Qualidade</span>
            <span style={{ fontWeight: 500, color: 'var(--ink-3)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>defeitos sobre recebido</span>
          </div>
          <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: defects > 0 ? 'var(--err)' : 'var(--ink-2)', flexShrink: 0 }}><Icon name="alert-triangle" size={14} strokeWidth={1.6}/></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink)' }}>Peças com defeito</div>
              <div style={{ fontSize: 11, color: defectRate > 5 ? 'var(--err)' : 'var(--ink-3)', marginTop: 2 }}>{defectRate.toFixed(1)}% das {totalReceived} recebidas</div>
            </div>
            <div style={{ width: 96 }}><NumField value={defects} onChange={(v) => setForm({ ...form, defects: v })} step={1} min={0} decimals={0}/></div>
          </div>
        </>
      )}
    </div>
  );
};

// ───────────────────────────── Costura (kanban + tabela) ─────────────────────────────
const Sewing = () => {
  const store = useStock();
  const [view, setView] = React.useState('kanban');
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [items, setItems] = React.useState(ORION_DATA.sewing);
  const [dragId, setDragId] = React.useState(null);
  const [overCol, setOverCol] = React.useState(null);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [sort, setSort] = React.useState({ key: 'code', dir: 'desc' });
  const [expanded, setExpanded] = React.useState(() => new Set());
  const [hoverId, setHoverId] = React.useState(null);
  const toggleExpand = (id) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const moveTo = (id, status) => setItems(arr => arr.map(it => it.id === id ? { ...it, status } : it));

  const lineSum = (it, key) => (it.lines || []).reduce((s, l) => s + (l[key] || 0), 0);
  const fullyPosted = (it) => (it.lines || []).length > 0 && (it.lines || []).every(l => (l.credited || 0) >= l.planned);

  const emptyForm = { banca: '', expected: '', lines: newSewingLines(), defects: 0, status: 'costurando' };
  const [form, setForm] = React.useState(emptyForm);
  const openNew = () => { setForm({ ...emptyForm, lines: newSewingLines() }); setNewOpen(true); };
  const openExisting = (it) => {
    setForm({ ...it, lines: (it.lines || []).map(l => ({ ...l })) });
    setOpen(it);
  };

  const saveOrder = () => {
    setItems(arr => arr.map(it => it.id === form.id ? { ...it, banca: form.banca, status: form.status, defects: form.defects, lines: form.lines } : it));
    setOpen(null);
  };

  // Receber: credita no estoque só o delta de cada linha; suporta entrega PARCIAL.
  const postReceive = () => {
    const deltas = (form.lines || []).map(l => ({ id: l.id, delta: (l.received || 0) - (l.credited || 0) })).filter(d => d.delta);
    store.receiveSewing(form.id, deltas);
    const newLines = (form.lines || []).map(l => ({ ...l, credited: l.received || 0 }));
    const planned = newLines.reduce((s, l) => s + (l.planned || 0), 0);
    const received = newLines.reduce((s, l) => s + (l.received || 0), 0);
    const status = planned > 0 && received >= planned ? 'recebido' : (received > 0 ? 'costurando' : form.status);
    setItems(arr => arr.map(it => it.id === form.id ? { ...it, lines: newLines, status, defects: form.defects, banca: form.banca } : it));
    setOpen(null);
  };

  const createOrder = () => {
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const num = Math.max(126, ...items.map(i => +String(i.code).replace('SW-', '') || 0)) + 1;
    const lines = (form.lines || []).filter(l => l.planned > 0).map(l => ({ id: l.id, planned: l.planned, received: 0, credited: 0 }));
    const order = { id: `SW-${num}`, code: `SW-${num}`, banca: form.banca, status: 'costurando', sent: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, expected: form.expected || '—', date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, defects: 0, lines };
    setItems(arr => [order, ...arr]);
    setNewOpen(false);
  };

  const groups = [
    { id: 'disponivel', label: 'Disponível' },
    { id: 'costurando', label: 'Costurando' },
    { id: 'recebido', label: 'Recebido' },
  ];

  // Peças cortadas e concluídas no Corte, ainda sem remessa — prontas para
  // entrar numa nova remessa de costura. Alimenta a coluna "Disponível".
  // Mid-stock de peças cortadas e concluídas no Corte, AGREGADAS por tipo de
  // produto (várias ordens do mesmo tipo se somam). Sem ordem nem responsável —
  // é estoque disponível para entrar numa nova remessa.
  const availableCuts = (() => {
    const m = new Map();
    ORION_DATA.cutting.filter(c => c.status === 'concluido').forEach(c => {
      const key = `${c.product}|${c.color || ''}`;
      if (!m.has(key)) m.set(key, { product: c.product, color: c.color || '', sizes: {} });
      const g = m.get(key);
      (c.grade || []).forEach(l => { if ((l.actual || 0) > 0) g.sizes[l.size] = (g.sizes[l.size] || 0) + l.actual; });
    });
    return [...m.values()].map(g => ({
      id: 'cut-' + `${g.product}-${g.color}`.toLowerCase().replace(/[^a-z0-9]/g, ''),
      product: g.product,
      color: g.color,
      grade: Object.keys(g.sizes).map(size => ({ size, actual: g.sizes[size] })),
    }));
  })();

  // ── tabela: filtro + ordenação ──
  const dateKey = (s) => { if (!s || s === '\u2014') return 9999; const [d, m] = s.split('/').map(Number); return (m || 0) * 100 + (d || 0); };
  const sortVal = (c, key) => {
    if (key === 'enviado') return lineSum(c, 'planned');
    if (key === 'recebido') return lineSum(c, 'received');
    if (key === 'defeitos') return c.defects || 0;
    if (key === 'prevista') return dateKey(c.expected);
    if (key === 'enviada') return dateKey(c.sent);
    if (key === 'banca') return c.banca.toLowerCase();
    return c.code;
  };
  const visibleRows = items
    .filter(c => statusFilter === 'all' ? true : c.status === statusFilter)
    .filter(c => { const q = query.trim().toLowerCase(); return !q || c.code.toLowerCase().includes(q) || c.banca.toLowerCase().includes(q); })
    .slice().sort((a, b) => { const va = sortVal(a, sort.key), vb = sortVal(b, sort.key); const cmp = va < vb ? -1 : va > vb ? 1 : 0; return sort.dir === 'asc' ? cmp : -cmp; });
  const setSortKey = (key) => setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  // ── kanban: distribui cada remessa nas colunas conforme suas peças.
  // Uma remessa parcial aparece em DUAS colunas — as peças ainda em produção
  // ficam em "Costurando" e as já concluídas viram um eco em "Recebido".
  const placementsFor = (colId) => {
    const out = [];
    items.forEach(c => {
      const lines = c.lines || [];
      const open = lines.filter(l => (l.received || 0) < l.planned);
      const done = lines.filter(l => l.planned > 0 && (l.received || 0) >= l.planned);
      if (c.status === 'recebido') { if (colId === 'recebido') out.push({ c, lines, role: 'primary' }); }
      else { // costurando — em produção na banca
        if (open.length) {
          if (colId === 'costurando') out.push({ c, lines: open, role: 'primary' });
          if (colId === 'recebido' && done.length) out.push({ c, lines: done, role: 'echo' });
        } else if (colId === 'recebido') out.push({ c, lines, role: 'primary' });
      }
    });
    return out;
  };
  const SortTh = ({ k, label, num }) => (
    <th className={num ? 'num' : ''} onClick={() => setSortKey(k)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, justifyContent: num ? 'flex-end' : 'flex-start' }}>
        {label}
        <Icon name={sort.key === k ? (sort.dir === 'asc' ? 'chevron-up' : 'chevron-down') : 'chevrons-up-down'} size={12} style={{ color: sort.key === k ? 'var(--ink-2)' : 'var(--ink-3)', opacity: sort.key === k ? 1 : 0.45 }}/>
      </span>
    </th>
  );

  return (
    <div className="page">
      <PageHead sub="sewing" title="Costura" titleEm="em bancas"
                desc="Remessas enviadas às bancas e seu retorno."
                actions={<>
                  <Seg value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban' }, { value: 'table', label: 'Tabela' }]}/>
                  <button className="btn btn-primary" onClick={openNew}><Icon name="send" size={14}/> Nova remessa</button>
                </>}/>
      <HelpCard id="sewing" icon="send" tone="var(--brand-prod)" maxW={720} title="Costura — remessas que vão e voltam das bancas">
        <HelpBody>
          Peças cortadas viram uma <b>remessa</b> enviada a uma <b>banca</b> terceirizada. Você acompanha o que <b>saiu</b> e marca o que <b>voltou</b> costurado — pode receber em <b>parcelas</b>, e cada retorno credita as <b>peças lisas</b> no estoque.
        </HelpBody>
        <Flow accent="var(--brand-prod)" steps={[
          { icon: 'scissors', label: 'Cortadas', sub: 'prontas p/ enviar' },
          { icon: 'send', label: 'Remessa', sub: 'à banca', tone: 'accent' },
          { icon: 'factory', label: 'Costura', sub: 'na banca' },
          { icon: 'package-check', label: 'Peças lisas', sub: 'entram no estoque', tone: 'ok' },
        ]}/>
      </HelpCard>

      {view === 'kanban' ? (
        <div className={`grid g-cols-${groups.length}`}>
          {groups.map(g => {
            const place = placementsFor(g.id);
            const isOver = overCol === g.id;
            return (
              <div key={g.id}
                onDragOver={(e) => { if (g.id === 'disponivel') return; e.preventDefault(); setOverCol(g.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(null); }}
                onDrop={(e) => { e.preventDefault(); if (dragId && g.id !== 'disponivel') moveTo(dragId, g.id); setDragId(null); setOverCol(null); }}
                style={{ background: isOver ? 'color-mix(in oklab, var(--brand-prod) 6%, var(--surface))' : 'var(--surface)', border: `1px ${isOver ? 'dashed' : 'solid'} ${isOver ? 'var(--brand-prod)' : 'var(--line)'}`, borderRadius: 'var(--radius-lg)', padding: 12, transition: 'background .15s, border-color .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusPill s={g.id}/>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{g.id === 'disponivel' ? availableCuts.length : place.length}</span>
                  </div>
                  {g.id === 'disponivel' && <button className="btn btn-sm btn-ghost" onClick={openNew}><Icon name="send" size={12}/></button>}                </div>
                <div style={{ display: 'grid', gap: 8, minHeight: 40 }}>
                  {g.id === 'disponivel' && availableCuts.map(cut => {
                    const tot = (cut.grade || []).reduce((s, l) => s + (l.actual || 0), 0);
                    const hot = hoverId === cut.id;
                    return (
                      <div key={cut.id} onClick={openNew}
                        onMouseEnter={() => setHoverId(cut.id)} onMouseLeave={() => setHoverId(h => h === cut.id ? null : h)}
                        style={{ background: hot ? 'color-mix(in oklab, var(--brand-prod) 5%, var(--bg))' : 'var(--bg)', border: `1px solid ${hot ? 'var(--brand-prod)' : 'var(--line-soft)'}`, borderRadius: 'var(--radius-sm)', overflow: 'hidden', cursor: 'pointer', transform: hot ? 'translateY(-1px)' : 'none', boxShadow: hot ? '0 4px 14px rgba(0,0,0,.07)' : 'none', transition: 'transform .14s, box-shadow .14s, border-color .14s, background .14s' }}>
                        <div style={{ padding: 12 }}>
                          {/* topo: produto + cor (ativo), sem ordem nem ID */}
                          <CardHead glyph={productGlyph(cut.product, 15)} title={cut.product} sub={cut.color}/>
                          {/* ativo: caixinhas tamanho · quantidade (sempre completas) */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 11 }}>
                            {(cut.grade || []).filter(l => (l.actual || 0) > 0).map(l => (
                              <div key={l.size} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 40, border: '1px solid var(--line-soft)', borderRadius: 7, overflow: 'hidden', background: 'var(--surface)' }}>
                                <span className="mono" style={{ width: '100%', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', background: 'var(--surface-2)', padding: '2px 0', borderBottom: '1px solid var(--line-soft)' }}>{l.size}</span>
                                <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink)', padding: '4px 10px' }}>{l.actual}</span>
                              </div>
                            ))}
                          </div>
                          {/* rodapé: total de peças prontas */}
                          <div style={{ marginTop: 11, display: 'flex', alignItems: 'center' }}>
                            <CardMeta icon="package" tone="var(--ink-2)">{tot} peças prontas</CardMeta>
                          </div>
                        </div>
                        <button className="card-foot-btn card-foot-btn--primary" onClick={(e) => { e.stopPropagation(); openNew(); }}>
                          <Icon name="send" size={13}/> Nova remessa
                        </button>
                      </div>
                    );
                  })}
                  {place.map(({ c, lines, role }) => {
                    const planned = lines.reduce((s, l) => s + (l.planned || 0), 0);
                    const received = lines.reduce((s, l) => s + (l.received || 0), 0);
                    const allR = lineSum(c, 'received'), allP = lineSum(c, 'planned');
                    const partial = allR > 0 && allR < allP;
                    const tear = partial ? (role === 'echo' ? 'top' : 'bottom') : null;
                    const lateNow = c.late && c.status !== 'recebido';
                    const hot = hoverId === c.id;
                    const cardInner = (
                      <div key={c.id + '-' + role} onClick={() => openExisting(c)} draggable={role === 'primary'}
                        onMouseEnter={() => setHoverId(c.id)} onMouseLeave={() => setHoverId(h => h === c.id ? null : h)}
                        onDragStart={role === 'primary' ? (e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                        onDragEnd={() => { setDragId(null); setOverCol(null); }}
                        style={{ background: hot ? 'color-mix(in oklab, var(--brand-prod) 5%, var(--bg))' : 'var(--bg)', border: `1px solid ${hot ? 'var(--brand-prod)' : 'var(--line-soft)'}`, borderRadius: 'var(--radius-sm)', padding: 12, cursor: role === 'primary' ? 'grab' : 'pointer', opacity: dragId === c.id && role === 'primary' ? 0.4 : 1, transform: hot ? 'translateY(-1px)' : 'none', boxShadow: hot ? '0 4px 14px rgba(0,0,0,.07)' : 'none', transition: 'transform .14s, box-shadow .14s, border-color .14s, background .14s', ...(tear ? tornEdgeStyle(tear) : {}) }}>
                        {/* topo: ID esmaecido (o ativo são as peças abaixo) */}
                        <CardHead code={c.code}/>
                        {/* ativo: peças agrupadas por tipo, com tamanhos aninhados */}
                        <div style={{ display: 'grid', gap: 11, marginTop: 9 }}>
                          {groupByType(lines).map(grp => (
                            <div key={grp.key}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
                                <span style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>{blankGlyph(grp.garment, 13)}</span>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{grp.base}</span>
                                {grp.color && <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>{grp.color}</span>}
                              </div>
                              <div style={{ display: 'grid', gap: 7, paddingLeft: 4 }}>
                                {grp.rows.map(({ l, b }) => {
                                  const pct = l.planned > 0 ? Math.min(100, ((l.received || 0) / l.planned) * 100) : 0;
                                  const ldone = l.planned > 0 && (l.received || 0) >= l.planned;
                                  return (
                                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                      <span className="mono" style={{ minWidth: 28, height: 22, padding: '0 6px', borderRadius: 5, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', flexShrink: 0 }}>{b.size || '—'}</span>
                                      <div style={{ flex: 1, height: 4, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${pct}%`, background: ldone ? 'var(--ok)' : 'var(--brand-prod)', borderRadius: 999 }}/>
                                      </div>
                                      <span className="num" style={{ fontSize: 12, color: ldone ? 'var(--ok)' : 'var(--ink)', fontFamily: 'var(--font-display)', flexShrink: 0 }}>{l.received || 0}<span style={{ color: 'var(--ink-3)' }}>/{l.planned}</span></span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* rodapé: metadados */}
                        <div style={CARD_FOOTER}>
                          <CardMeta icon="factory" tone="var(--ink-2)">{c.banca}</CardMeta>
                          <CardMeta icon="calendar" tone={lateNow ? 'var(--err)' : undefined} weight={lateNow ? 500 : 400}>{lateNow ? 'atrasada' : `prev. ${c.expected}`}</CardMeta>
                          {role === 'primary' && c.defects > 0 && <CardMeta icon="unlink" tone="var(--err)">{c.defects}</CardMeta>}
                        </div>
                      </div>
                    );
                    return tear ? <div key={c.id + '-' + role} style={tornWrapStyle()}>{cardInner}<TornStroke edge={tear} color={hot ? 'var(--brand-prod)' : 'var(--line-soft)'} id={'ts-sew-' + c.id + '-' + role}/></div> : cardInner;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <TableToolbar>
            <SearchInput placeholder="Buscar remessa ou banca…" value={query} onChange={setQuery}/>
            <Seg value={statusFilter} onChange={setStatusFilter} options={[
              { value: 'all', label: 'Todas' },
              { value: 'costurando', label: 'Costurando' },
              { value: 'recebido', label: 'Recebido' },
            ]}/>
          </TableToolbar>
          <table className="tbl">
            <thead><tr>
              <th style={{ width: 30 }}/>
              <SortTh k="code" label="Remessa"/>
              <SortTh k="banca" label="Banca"/>
              <th>Status</th>
              <SortTh k="enviado" label="Enviado" num/>
              <SortTh k="recebido" label="Recebido" num/>
              <SortTh k="defeitos" label="Defeitos" num/>
              <SortTh k="enviada" label="Enviada"/>
              <SortTh k="prevista" label="Prevista"/>
            </tr></thead>
            <tbody>
              {visibleRows.map(c => {
                const planned = lineSum(c, 'planned');
                const received = lineSum(c, 'received');
                const isExp = expanded.has(c.id);
                const lateNow = c.late && c.status !== 'recebido';
                return (
                  <React.Fragment key={c.id}>
                    <tr onClick={() => openExisting(c)}>
                      <td onClick={(e) => { e.stopPropagation(); toggleExpand(c.id); }} style={{ cursor: 'pointer', textAlign: 'center', color: isExp ? 'var(--brand-prod)' : 'var(--ink-3)' }}>
                        <Icon name={isExp ? 'chevron-down' : 'chevron-right'} size={14}/>
                      </td>
                      <td className="mono">{c.code}</td>
                      <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.banca}</td>
                      <td><StatusPill s={c.status}/></td>
                      <td className="num">{planned}</td>
                      <td className="num">{received}</td>
                      <td className="num" style={{ color: c.defects > 0 ? 'var(--err)' : 'var(--ink-3)' }}>
                        {c.defects ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="unlink" size={11}/>{c.defects}</span> : 0}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{c.sent}</td>
                      <td style={{ fontSize: 12, color: lateNow ? 'var(--err)' : 'var(--ink-3)', fontWeight: lateNow ? 500 : 400 }}>{c.expected}</td>
                    </tr>
                    {isExp && (c.lines || []).map(l => {
                      const b = ORION_DATA.blankPieces.find(x => x.id === l.id) || {};
                      const pct = l.planned > 0 ? Math.min(100, ((l.received || 0) / l.planned) * 100) : 0;
                      const ldone = l.planned > 0 && (l.received || 0) >= l.planned;
                      return (
                        <tr key={c.id + '-' + l.id} style={{ background: 'var(--surface-2)' }}>
                          <td/>
                          <td colSpan={3}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', flexShrink: 0 }}>{blankGlyph(b.garment, 13)}</span>
                              <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>{b.base || l.id}</span>
                              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{b.color ? `${b.color} · ${b.size}` : ''}</span>
                            </div>
                          </td>
                          <td className="num" style={{ color: 'var(--ink-3)' }}>{l.planned}</td>
                          <td className="num" style={{ color: ldone ? 'var(--ok)' : 'var(--ink)', fontWeight: 500 }}>{l.received || 0}</td>
                          <td colSpan={3}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, maxWidth: 160, height: 5, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: ldone ? 'var(--ok)' : 'var(--brand-prod)', borderRadius: 999 }}/>
                              </div>
                              <span className="num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{Math.round(pct)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {visibleRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--ink-3)', fontSize: 13 }}>Nenhuma remessa encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? `Remessa ${open.code}` : ''}
             sub={open ? <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{open.banca}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir remessa</button>
               <button className="btn" onClick={saveOrder}><Icon name="check" size={13}/> Salvar</button>
               <button className="btn btn-primary" onClick={postReceive}><Icon name="package-check" size={13}/> Receber peças</button>
             </>}>
        {open && <SewingDetail form={form} setForm={setForm} isNew={false}/>}
      </Sheet>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)}
             title="Nova remessa de costura"
             sub={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Envie peças cortadas a uma banca</span>}
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" disabled={!form.banca || !(form.lines || []).some(l => l.planned > 0)} onClick={createOrder}><Icon name="send" size={13}/> Criar remessa</button>
             </>}>
        <SewingDetail form={form} setForm={setForm} isNew={true}/>
      </Sheet>
    </div>
  );
};

const WhatsappIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.654-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.04 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.999-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.889-9.884a9.82 9.82 0 0 1 6.991 2.898 9.825 9.825 0 0 1 2.892 6.994c-.003 5.45-4.437 9.885-9.889 9.885zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.49-8.413z"/>
  </svg>
);

const Contractors = () => {
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', responsavel: '', phone: '', city: '', specialty: 'malha' });
  return (
    <div className="page">
      <PageHead sub="contractors" title="Bancas" titleEm="parceiras"
                desc="Diretório de bancas de costura e suas métricas."
                actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><Icon name="factory" size={14}/> Nova banca</button>}/>
      <HelpCard id="contractors" icon="factory" tone="var(--brand-prod)" title="Bancas — seu time de costura terceirizado">
        <HelpBody>
          Um diretório das <b>bancas</b> parceiras com contato, <b>capacidade</b> e <b>métricas</b> de prazo e qualidade. É daqui que você escolhe para onde enviar cada remessa de costura.
        </HelpBody>
        <Flow accent="var(--brand-prod)" steps={[
          { icon: 'factory', label: 'Banca', sub: 'cadastrada', tone: 'accent' },
          { icon: 'send', label: 'Remessas', sub: 'recebe de corte' },
          { icon: 'gauge', label: 'Métricas', sub: 'prazo & qualidade', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="grid g-cols-2">
        {ORION_DATA.bancas.map(b => (
          <div key={b.id} className="card card-pad" onClick={() => setOpen(b)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'color-mix(in oklab, var(--brand-prod) 12%, var(--surface))', color: 'var(--brand-prod)', display: 'grid', placeItems: 'center' }}>
                <Icon name="factory" size={22}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{b.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{b.contact}</div>
              </div>
              <Icon name="chevron-right" size={16} style={{ color: 'var(--ink-3)' }}/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)' }}>{b.active}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>Ativas</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: b.ontime >= 90 ? 'var(--ok)' : b.ontime >= 80 ? 'var(--warn)' : 'var(--err)' }}>{b.ontime}%</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>No prazo</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? open.name : ''}
             sub={open ? <span className="mono" style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--ink-3)'}}>{open.id}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir banca</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn" style={{ color: '#25D366' }}><WhatsappIcon size={13}/> WhatsApp</button>
               <button className="btn btn-primary"><Icon name="pencil" size={13}/> Editar banca</button>
             </>}>
        {open && <BancaDetail b={open}/>}
      </Sheet>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)}
             title="Nova banca"
             sub={<span style={{fontSize:12,color:'var(--ink-3)'}}>Cadastre um novo parceiro de costura</span>}
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" onClick={() => setNewOpen(false)}><Icon name="check" size={13}/> Cadastrar banca</button>
             </>}>
        <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 56, height: 56, borderRadius: 14, background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', color: 'var(--brand-prod)', display: 'grid', placeItems: 'center' }}>
            <Icon name="factory" size={26}/>
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{form.name || 'Nome da banca'}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{form.responsavel || 'Responsável'} {form.phone && `· ${form.phone}`}</div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)' }}>Identificação</div>
        <div className="field"><label>Nome da banca</label>
          <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Banca Dona Lúcia"/>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field"><label>Responsável</label>
            <input value={form.responsavel} onChange={e => setForm({...form, responsavel: e.target.value})} placeholder="Ex: Lúcia Pereira"/>
          </div>
          <div className="field"><label>Cidade</label>
            <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Ex: São Paulo, SP"/>
          </div>
        </div>
        <div className="field"><label>WhatsApp</label>
          <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(11) 91234-5678"/>
        </div>

        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginTop: 18 }}>Especialidade</div>
        <div className="field"><label>Tipo de produto</label>
          <Select value={form.specialty} onChange={(v) => setForm({...form, specialty: v})}
            options={[
              { value: 'malha', label: 'Malha (camisetas, croppeds, blusas)' },
              { value: 'moletom', label: 'Moletom (felpa, mescla)' },
              { value: 'jeans', label: 'Jeans / sarja' },
              { value: 'plano', label: 'Tecido plano (camisas, vestidos)' },
              { value: 'outros', label: 'Outros / múltiplos' },
            ]}/>
        </div>
      </Sheet>
    </div>
  );
};

const BancaDetail = ({ b }) => {
  const remessas = ORION_DATA.sewing.filter(s => s.banca === b.name);
  const piecesOf = (r) => (r.lines || []).reduce((s, l) => s + (l.received || l.planned || 0), 0);
  const totalPecas = remessas.reduce((sum, r) => sum + piecesOf(r), 0);
  const totalDef = remessas.reduce((sum, r) => sum + (r.defects || 0), 0);
  const phone = (b.contact.match(/\(\d{2}\)\s*\d{4,5}-\d{4}/) || [''])[0];
  const responsavel = b.contact.split('·')[0].trim();
  return (
    <div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 56, height: 56, borderRadius: 14, background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', color: 'var(--brand-prod)', display: 'grid', placeItems: 'center' }}>
          <Icon name="factory" size={26}/>
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{b.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="user" size={11}/> {responsavel}</span>
            {phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="phone" size={11}/> {phone}</span>}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Métricas</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: 'var(--line-soft)', border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)' }}>{b.active}</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>Remessas ativas</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: b.ontime >= 90 ? 'var(--ok)' : b.ontime >= 80 ? 'var(--warn)' : 'var(--err)' }}>{b.ontime}%</div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>Entrega no prazo</div>
        </div>
      </div>

      <FormGrid>
        <FormCell icon="package" label="Peças produzidas">{totalPecas}</FormCell>
        <FormCell icon="alert-triangle" label="Defeitos totais">{totalDef} ({totalPecas > 0 ? ((totalDef/totalPecas)*100).toFixed(1) : 0}%)</FormCell>
      </FormGrid>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Histórico de remessas</div>
        {remessas.length ? remessas.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)', minWidth: 70 }}>{r.id}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Enviada {r.sent} · prevista {r.expected}</div>
            </div>
            <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 50, textAlign: 'right' }}>{piecesOf(r)} pç</span>
            <StatusPill s={r.status}/>
          </div>
        )) : <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nenhuma remessa registrada.</div>}
      </div>
    </div>
  );
};

Object.assign(window, { Cutting, Sewing, Contractors });
