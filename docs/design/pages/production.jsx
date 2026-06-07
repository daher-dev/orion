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
  const moveTo = (id, status) => setItems(arr => arr.map(it => it.id === id ? { ...it, status } : it));
  const emptyForm = { product: '', roll: '', rollRibana: '', sizes: {}, operator: '', date: '', status: 'pendente', consumed: 0, consumedRibana: 0 };
  const [form, setForm] = React.useState(emptyForm);
  const openNew = () => { setForm(emptyForm); setNewOpen(true); };
  const openExisting = (c) => {
    // Distribute legacy planned/actual evenly across product sizes
    const p = ORION_DATA.products.find(pp => pp.name === c.product);
    const sizes = {};
    if (p) {
      const n = p.sizes.length;
      const basePl = Math.floor(c.planned / n);
      const baseAc = Math.floor(c.actual / n);
      const remPl = c.planned - basePl * n;
      const remAc = c.actual - baseAc * n;
      p.sizes.forEach((s, i) => {
        sizes[s] = { planned: basePl + (i < remPl ? 1 : 0), actual: baseAc + (i < remAc ? 1 : 0) };
      });
    }
    setForm({ ...c, sizes });
    setOpen(c);
  };
  const groups = [
    { id: 'pendente', label: 'Pendente' },
    { id: 'cortando', label: 'Cortando' },
    { id: 'concluido', label: 'Concluído' },
  ];
  return (
    <div className="page">
      <PageHead sub="cutting" title="Corte" titleEm="& planejamento"
                desc="Planeje e registre lotes de corte contra suas bobinas de tecido."
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
        <div className="grid g-cols-3">
          {groups.map(g => {
            const colItems = items.filter(c => c.status === g.id);
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
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{colItems.length}</span>
                  </div>
                  {g.id === 'pendente' && (
                    <button className="btn btn-sm btn-ghost" onClick={openNew}><Icon name="scissors" size={12}/></button>
                  )}
                </div>
                <div style={{ display: 'grid', gap: 8, minHeight: 40 }}>
                  {colItems.map(c => (
                    <div key={c.id} onClick={() => openExisting(c)}
                      draggable
                      onDragStart={(e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      style={{ background: 'var(--bg)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)', padding: 12, cursor: 'grab', opacity: dragId === c.id ? 0.4 : 1, transition: 'opacity .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{c.code}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.date}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink)', marginTop: 4 }}>{c.product}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)' }}>
                        <FabricThumb tone="warm" size={20}/>
                        <span>{c.roll}</span>
                        <span style={{ marginLeft: 'auto' }}>{c.actual}/{c.planned} peças</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--line-soft)', borderRadius: 999, marginTop: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(c.actual/c.planned)*100}%`, background: 'var(--brand-prod)', borderRadius: 999 }}/>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                        <Av name={c.operator} color="#10b981"/>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{c.operator}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>Código</th><th>Produto</th><th>Bobina</th><th>Operador</th><th>Status</th><th className="num">Plano</th><th className="num">Real</th><th>Data</th></tr></thead>
            <tbody>{items.map(c => (
              <tr key={c.id} onClick={() => openExisting(c)}>
                <td className="mono">{c.code}</td><td style={{color:'var(--ink)',fontWeight:500}}>{c.product}</td>
                <td className="mono" style={{fontFamily:'var(--font-mono)',fontSize:12}}>{c.roll}</td>
                <td>{c.operator}</td><td><StatusPill s={c.status}/></td>
                <td className="num">{c.planned}</td><td className="num">{c.actual}</td><td>{c.date}</td>
              </tr>
            ))}</tbody>
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

const Sewing = () => {
  const [open, setOpen] = React.useState(null);
  return (
    <div className="page">
      <PageHead sub="sewing" title="Costura" titleEm="em bancas"
                desc="Acompanhe remessas enviadas e recebidas das bancas terceirizadas."
                actions={<button className="btn btn-primary"><Icon name="send" size={14}/> Nova remessa</button>}/>
      <HelpCard id="sewing" icon="send" tone="var(--brand-prod)" maxW={720} title="Costura — remessas que vão e voltam das bancas">
        <HelpBody>
          Peças cortadas viram uma <b>remessa</b> enviada a uma <b>banca</b> terceirizada. Aqui você acompanha o que <b>saiu</b>, o que <b>voltou</b> costurado e o saldo em produção — ao retornar, entra no estoque.
        </HelpBody>
        <Flow accent="var(--brand-prod)" steps={[
          { icon: 'scissors', label: 'Cortadas', sub: 'prontas p/ enviar' },
          { icon: 'send', label: 'Remessa', sub: 'à banca', tone: 'accent' },
          { icon: 'factory', label: 'Costura', sub: 'na banca' },
          { icon: 'package-check', label: 'Retorno', sub: 'entra no estoque', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="card">
        <TableToolbar>
          <SearchInput placeholder="Buscar remessa…"/>
          <Seg value="all" onChange={()=>{}} options={[
            {value:'all',label:'Todas'},{value:'sent',label:'Enviadas'},{value:'received',label:'Recebidas'},{value:'late',label:'Atrasadas'}
          ]}/>
        </TableToolbar>
        <table className="tbl">
          <thead><tr><th>Remessa</th><th>Banca</th><th>Status</th><th className="num">Peças</th><th className="num">Defeitos</th><th>Enviada</th><th>Prevista</th><th style={{width:36}}/></tr></thead>
          <tbody>
            {ORION_DATA.sewing.map(s => (
              <tr key={s.id} onClick={() => setOpen(s)}>
                <td className="mono">{s.id}</td>
                <td style={{color:'var(--ink)',fontWeight:500}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:24,height:24,borderRadius:6,background:'var(--surface-2)',display:'grid',placeItems:'center',color:'var(--brand-prod)'}}>
                      <Icon name="factory" size={13}/>
                    </span>
                    {s.banca}
                  </div>
                </td>
                <td><StatusPill s={s.status}/></td>
                <td className="num">{s.pieces}</td>
                <td className="num" style={{color: s.defects > 0 ? 'var(--err)' : 'var(--ink-3)'}}>{s.defects}</td>
                <td style={{fontSize:12,color:'var(--ink-3)'}}>{s.sent}</td>
                <td style={{fontSize:12,color: s.status === 'atrasado' ? 'var(--err)' : 'var(--ink-3)', fontWeight: s.status === 'atrasado' ? 500 : 400}}>{s.expected}</td>
                <td><Icon name="chevron-right" size={14} style={{color:'var(--ink-3)'}}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? `Remessa ${open.id}` : ''}
             sub={open ? <span style={{fontSize:12,color:'var(--ink-3)'}}>{open.banca}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir remessa</button>
               <button className="btn" onClick={() => setOpen(null)}>Fechar</button>
               <button className="btn"><Icon name="printer" size={13}/> Etiqueta</button>
               <button className="btn btn-primary"><Icon name="package-check" size={13}/> Receber remessa</button>
             </>}>
        {open && <SewingDetail s={open}/>}
      </Sheet>
    </div>
  );
};

const SewingDetail = ({ s }) => {
  const banca = ORION_DATA.bancas.find(b => b.name === s.banca);
  const defectRate = s.pieces > 0 ? (s.defects / s.pieces) * 100 : 0;
  return (
    <div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ width: 48, height: 48, borderRadius: 12, background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', color: 'var(--brand-prod)', display: 'grid', placeItems: 'center' }}>
          <Icon name="factory" size={22}/>
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{s.banca}</div>
          {banca && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{banca.contact}</div>}
        </div>
        <StatusPill s={s.status}/>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Linha do tempo</div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 22, position: 'relative' }}>
        {[
          { id: 'enviado', label: 'Enviado', icon: 'send', date: s.sent },
          { id: 'producao', label: 'Em produção', icon: 'scissors', date: '—' },
          { id: 'parcial', label: 'Recebimento parcial', icon: 'package', date: s.status === 'parcial' || s.status === 'recebido' ? 'em curso' : '—' },
          { id: 'recebido', label: 'Recebido', icon: 'check-circle', date: s.expected },
        ].map((step, i, arr) => {
          const order = ['enviado','enviado','parcial','recebido'];
          const current = arr.findIndex(x => x.id === s.status);
          const reached = i <= (current === -1 ? 0 : current);
          return (
            <div key={step.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {i < arr.length - 1 && <div style={{ position: 'absolute', top: 14, left: '50%', right: '-50%', height: 2, background: reached ? 'var(--accent)' : 'var(--line-soft)', zIndex: 0 }}/>}
              <span style={{ width: 30, height: 30, borderRadius: 999, background: reached ? 'var(--accent)' : 'var(--surface)', border: reached ? 'none' : '1.5px solid var(--line)', color: reached ? '#fff' : 'var(--ink-3)', display: 'grid', placeItems: 'center', position: 'relative', zIndex: 1 }}>
                <Icon name={step.icon} size={13}/>
              </span>
              <div style={{ fontSize: 10.5, color: reached ? 'var(--ink)' : 'var(--ink-3)', fontWeight: reached ? 500 : 400, marginTop: 6, textAlign: 'center' }}>{step.label}</div>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{step.date}</div>
            </div>
          );
        })}
      </div>

      <FormGrid>
        <FormCell icon="package" label="Peças">{s.pieces}</FormCell>
        <FormCell icon="alert-triangle" label="Defeitos">{s.defects} ({defectRate.toFixed(1)}%)</FormCell>
        <FormCell icon="calendar" label="Enviada">{s.sent}</FormCell>
        <FormCell icon="clock" label="Prevista">{s.expected}</FormCell>
      </FormGrid>

      <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, marginTop: 18 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Itens da remessa</div>
        <div style={{ border: '1px solid var(--line-soft)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { sku: 'CRP-OVS-PRT-M', product: 'Cropped Oversized · Preto · M', qty: Math.round(s.pieces * 0.4) },
            { sku: 'CRP-OVS-MAR-G', product: 'Cropped Oversized · Marrom · G', qty: Math.round(s.pieces * 0.35) },
            { sku: 'CRP-OVS-ARE-P', product: 'Cropped Oversized · Areia · P', qty: s.pieces - Math.round(s.pieces * 0.4) - Math.round(s.pieces * 0.35) },
          ].map((it, i, arr) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--line-soft)' : 'none', fontSize: 13 }}>
              <div>
                <div style={{ color: 'var(--ink)' }}>{it.product}</div>
                <div className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{it.sku}</div>
              </div>
              <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>{it.qty}</span>
            </div>
          ))}
        </div>
      </div>
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
  const totalPecas = remessas.reduce((sum, r) => sum + r.pieces, 0);
  const totalDef = remessas.reduce((sum, r) => sum + r.defects, 0);
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
            <span className="num" style={{ fontSize: 12, color: 'var(--ink-2)', minWidth: 50, textAlign: 'right' }}>{r.pieces} pç</span>
            <StatusPill s={r.status}/>
          </div>
        )) : <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nenhuma remessa registrada.</div>}
      </div>
    </div>
  );
};

Object.assign(window, { Cutting, Sewing, Contractors });
