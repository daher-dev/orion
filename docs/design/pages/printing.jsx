// Produção — IMPRESSÃO (espelho do Corte, no caminho do PAPEL) + MONTAGEM (convergência)
//   PAPEL → IMPRESSÃO → IMPRESSO ┐
//                                ├→ MONTAGEM → SKU
//   TECIDO → CORTE → COSTURA → PEÇA LISA ┘
// Reusa o escopo global de babel: PageHead, HelpCard, HelpBody, Flow, Seg, Sheet,
// Select, NumField, StatusPill, SectionTitle, FormGrid, FormCell, Icon, useStock,
// OPERATORS (de production.jsx), fmt, GARMENT_GLYPHS.

// Estampas que consomem bobina de papel/filme (transfer). Silk/serigrafia fica de fora.
const printIsTransfer = (p) => p.technique === 'DTF' || p.technique === 'Sublimação';
const printTransferEstampas = () => ORION_DATA.prints.filter(printIsTransfer);

// metros de filme/papel por peça impressa, por técnica
const PRINT_CONSUMO = { 'DTF': 0.35, 'Sublimação': 0.5 };

const PRINT_TONE = {
  warm:  ['#f4d9b8', '#c2410c'], sand: ['#efe6d3', '#a16207'], moss: ['#d6dfd0', '#3a4a3d'],
  bone:  ['#f4f1ea', '#7a7160'], stone: ['#dfd9cd', '#57534e'],
};
const printSideLabel = (s) => s === 'back' ? 'Costas' : 'Frente';

// Art chip standing in for the estampa
const PrintThumb = ({ tone = 'warm', size = 40 }) => {
  const [a, b] = PRINT_TONE[tone] || PRINT_TONE.warm;
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: 9, flexShrink: 0,
      background: `radial-gradient(circle at 30% 28%, ${a}, ${b})`, display: 'grid', placeItems: 'center',
      color: 'rgba(255,255,255,.92)' }}>
      <Icon name="palette" size={Math.round(size * 0.42)} strokeWidth={1.6}/>
    </span>
  );
};

const InkDot = ({ ink, size = 13 }) => (
  <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: ink || '#999',
    boxShadow: '0 0 0 1px var(--line), inset 0 0 0 1px rgba(255,255,255,.18)', flexShrink: 0 }}/>
);

const PngFlag = ({ ok }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 600, letterSpacing: '.02em',
    color: ok ? 'var(--ok)' : 'var(--warn)' }}>
    <Icon name={ok ? 'image' : 'image-off'} size={10}/> {ok ? 'PNG' : 'sem PNG'}
  </span>
);

const printSectionLabel = (extra) => ({
  fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600,
  marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--line-soft)', marginTop: 18,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...extra,
});

// blank zeroed grid for an estampa: { [varId]: { front:{planned,printed}, back:{...} } }
const newPrintGrade = (print) => {
  const g = {};
  if (!print) return g;
  print.variations.forEach(v => { g[v.id] = {}; print.sides.forEach(side => { g[v.id][side] = { planned: 0, printed: 0 }; }); });
  return g;
};

// distribute legacy planned/printed totals across the printable (png ok) cells
const distributePrintGrade = (print, planned, printed) => {
  const g = newPrintGrade(print);
  if (!print) return g;
  let cells = [];
  print.sides.forEach(side => print.variations.forEach(v => { if (v[side] && v[side].png === 'ok') cells.push({ varId: v.id, side }); }));
  if (!cells.length) print.sides.forEach(side => print.variations.forEach(v => cells.push({ varId: v.id, side })));
  const n = cells.length || 1;
  const spread = (total, key) => {
    const base = Math.floor(total / n), rem = total - base * n;
    cells.forEach((c, i) => { g[c.varId][c.side][key] = base + (i < rem ? 1 : 0); });
  };
  spread(planned, 'planned'); spread(printed, 'printed');
  return g;
};

// ───────────────────────────── Impressão detail ─────────────────────────────
const PrintingDetail = ({ form, setForm, isNew }) => {
  const print = ORION_DATA.prints.find(p => p.id === form.estampa);
  const sides = print ? print.sides : [];
  const variations = print ? print.variations : [];
  const grade = form.grade || {};
  const cell = (varId, side) => (grade[varId] && grade[varId][side]) || { planned: 0, printed: 0 };
  const setCell = (varId, side, key, val) => {
    const g = JSON.parse(JSON.stringify(grade));
    g[varId] = g[varId] || {}; g[varId][side] = g[varId][side] || { planned: 0, printed: 0 };
    g[varId][side][key] = val;
    setForm({ ...form, grade: g });
  };

  const sumAll = (key) => sides.reduce((s, side) => s + variations.reduce((a, v) => a + cell(v.id, side)[key], 0), 0);
  const totalPlanned = sumAll('planned');
  const totalPrinted = sumAll('printed');
  const rate = print ? (PRINT_CONSUMO[print.technique] || 0.4) : 0.4;
  const prevMeters = +(rate * totalPrinted).toFixed(1);

  const handleEstampaChange = (v) => {
    const p = ORION_DATA.prints.find(pp => pp.id === v);
    setForm({ ...form, estampa: v, grade: newPrintGrade(p), roll: '' });
  };

  const suitable = print
    ? ORION_DATA.paperRolls.filter(r => print.technique === 'DTF' ? /dtf/i.test(r.type) : /sublim|transfer/i.test(r.type))
    : ORION_DATA.paperRolls;
  const rollOpts = (suitable.length ? suitable : ORION_DATA.paperRolls);
  const roll = ORION_DATA.paperRolls.find(r => r.id === form.roll);

  const SideGrid = ({ side }) => {
    const sp = variations.reduce((s, v) => s + cell(v.id, side).planned, 0);
    const si = variations.reduce((s, v) => s + cell(v.id, side).printed, 0);
    const cols = isNew ? '1fr 96px' : '1fr 96px 1.2fr';
    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, background: 'color-mix(in oklab, var(--brand-prod) 12%, var(--surface))', color: 'var(--brand-prod)' }}>
            <Icon name={side === 'back' ? 'rotate-ccw' : 'square'} size={12} strokeWidth={1.8}/>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{printSideLabel(side)}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--ink-2)' }}>{isNew ? `${sp} planejados` : `${si} / ${sp}`}</span>
        </div>
        <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: cols, background: 'var(--surface-2)', padding: '8px 14px', fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, borderBottom: '1px solid var(--line-soft)', gap: 12 }}>
            <span>Variação</span>
            <span style={{ textAlign: 'right' }}>Planejado</span>
            {!isNew && <span style={{ textAlign: 'right' }}>Impresso</span>}
          </div>
          {variations.map((v, i) => {
            const d = cell(v.id, side);
            const sd = v[side] || {};
            const pngOk = sd.png === 'ok';
            const pct = d.planned > 0 ? Math.min(100, (d.printed / d.planned) * 100) : 0;
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', padding: '10px 14px', borderBottom: i < variations.length - 1 ? '1px solid var(--line-soft)' : 'none', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <InkDot ink={v.ink}/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                    <PngFlag ok={pngOk}/>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 88 }}><NumField value={d.planned} onChange={(val) => setCell(v.id, side, 'planned', val)} step={1} min={0} decimals={0}/></div>
                </div>
                {!isNew && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button"
                      onClick={() => setCell(v.id, side, 'printed', d.planned)}
                      disabled={d.planned === 0 || d.printed === d.planned || !pngOk}
                      title={!pngOk ? 'Falta o PNG desta variação/lado' : 'Marcar como impresso (igualar ao planejado)'}
                      style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, border: '1px solid var(--line)', background: d.printed === d.planned && d.planned > 0 ? 'var(--brand-prod)' : 'var(--surface)', color: d.printed === d.planned && d.planned > 0 ? '#fff' : 'var(--ink-3)', cursor: d.planned === 0 || d.printed === d.planned || !pngOk ? 'default' : 'pointer', opacity: d.planned === 0 || !pngOk ? 0.4 : 1, padding: 0, flexShrink: 0, transition: 'all .15s' }}>
                      <Icon name="check" size={12} strokeWidth={2.5}/>
                    </button>
                    <div style={{ flex: 1, height: 4, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden', maxWidth: 56 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--brand-prod)' }}/>
                    </div>
                    <div style={{ width: 76 }}><NumField value={d.printed} onChange={(val) => setCell(v.id, side, 'printed', val)} step={1} min={0} decimals={0}/></div>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '9px 14px', background: 'var(--surface-2)', borderTop: '1px solid var(--line-soft)', fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink)', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>Subtotal</span>
            <span className="num" style={{ textAlign: 'right' }}>{sp}</span>
            {!isNew && <span className="num" style={{ textAlign: 'right' }}>{si}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: 18, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        {print ? <PrintThumb tone={print.tone} size={48}/> : <span style={{ width: 48, height: 48, borderRadius: 12, background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', color: 'var(--brand-prod)', display: 'grid', placeItems: 'center' }}><Icon name="printer" size={22}/></span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{print ? print.name : 'Selecione uma estampa'}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {print ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="pill" style={{ fontSize: 10.5 }}>{print.technique}</span>
              {form.roll ? `Bobina ${form.roll}` : 'Sem bobina vinculada'}
              {totalPlanned > 0 ? ` · ${totalPlanned} impressos planejados` : ''}
            </span> : 'Estampa, lados e variações definem a grade'}
          </div>
        </div>
        {!isNew && <StatusPill s={form.status}/>}
      </div>

      {!isNew && (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 10 }}>Progresso</div>
          <div style={{ marginBottom: 18, padding: 14, background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)' }}>{totalPrinted}<span style={{ color: 'var(--ink-3)', fontSize: 16 }}> / {totalPlanned}</span></span>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{totalPlanned > 0 ? Math.round((totalPrinted / totalPlanned) * 100) : 0}% impresso</span>
            </div>
            <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${totalPlanned > 0 ? (totalPrinted / totalPlanned) * 100 : 0}%`, background: 'var(--brand-prod)', borderRadius: 999 }}/>
            </div>
          </div>
        </>
      )}

      <div className="field" style={{ marginTop: 4 }}><label>Estampa a imprimir</label>
        <Select value={form.estampa} onChange={handleEstampaChange}
          options={printTransferEstampas().map(p => ({ value: p.id, label: p.name, sub: `${p.id} · ${p.technique}`, _p: p }))}
          renderOption={(o) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <PrintThumb tone={o._p.tone} size={26}/>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{o.label}</span>
              <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                <span className="pill" style={{ fontSize: 10 }}>{o._p.technique}</span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{o._p.sides.map(printSideLabel).join('+')}</span>
              </span>
            </span>
          )}/>
      </div>

      <div style={printSectionLabel({ justifyContent: 'flex-start', gap: 8 })}>
        <span>Bobina de papel / filme</span>
        {print && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--brand-prod)', background: 'color-mix(in oklab, var(--brand-prod) 14%, var(--surface))', padding: '2px 6px', borderRadius: 4, textTransform: 'none', letterSpacing: 0 }}>{print.technique} · {rate} m/peça</span>}
      </div>
      <div className="field">
        <Select value={form.roll} onChange={(v) => setForm({ ...form, roll: v })}
          options={rollOpts.map(r => ({ value: r.id, label: `${r.id} · ${r.type}`, sub: `${r.width}cm · ${fmt(r.current, 0)}m`, _r: r }))}
          renderOption={(o) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name="scroll" size={14} strokeWidth={1.5}/></span>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{o._r.id}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o._r.type}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{o._r.width} cm · {fmt(o._r.current, 0)} m disponível</span>
              </span>
            </span>
          )}/>
      </div>

      <div style={printSectionLabel()}>
        <span>Impressos por lado e variação</span>
        {totalPlanned > 0 && <span style={{ fontWeight: 500, color: 'var(--ink-2)', textTransform: 'none', letterSpacing: 0, fontSize: 11.5 }}>{isNew ? `${totalPlanned} total` : `${totalPrinted} / ${totalPlanned}`}</span>}
      </div>
      {!print ? (
        <div style={{ padding: '20px 14px', background: 'var(--surface-2)', border: '1px dashed var(--line)', borderRadius: 10, textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
          Selecione uma estampa para montar a grade de lados e variações
        </div>
      ) : sides.map(side => <SideGrid key={side} side={side}/>)}

      {!isNew && print && (
        <>
          <div style={printSectionLabel()}>
            <span>Papel consumido</span>
            <span style={{ fontWeight: 500, color: 'var(--ink-3)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>previsto · consumido · Δ</span>
          </div>
          <div style={{ border: '1px solid var(--line-soft)', borderRadius: 10, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 70px', padding: '8px 14px', background: 'var(--surface-2)', fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, gap: 12 }}>
              <span>Bobina</span><span style={{ textAlign: 'right' }}>Previsto</span><span style={{ textAlign: 'right' }}>Consumido</span><span style={{ textAlign: 'right' }}>Δ</span>
            </div>
            {form.roll ? (() => {
              const cons = form.consumed ?? 0;
              const diff = +(cons - prevMeters).toFixed(1);
              const over = diff > 0.05;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 70px', alignItems: 'center', padding: '12px 14px', gap: 12, borderTop: '1px solid var(--line-soft)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-2)', flexShrink: 0 }}><Icon name="scroll" size={14} strokeWidth={1.5}/></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{form.roll}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roll ? roll.type : 'Bobina de papel'}</div>
                    </div>
                  </div>
                  <div className="num" style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>{fmt(prevMeters, 1)} <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>m</span></div>
                  <NumField value={cons} onChange={(v) => setForm({ ...form, consumed: v })} step={0.5} min={0} decimals={1} suffix="m"/>
                  <div className="num" style={{ fontSize: 12, textAlign: 'right', color: cons === 0 ? 'var(--ink-3)' : over ? 'var(--err)' : diff < -0.05 ? 'var(--ok)' : 'var(--ink-3)' }}>
                    {cons === 0 ? '—' : `${diff > 0 ? '+' : ''}${fmt(diff, 1)}`}
                  </div>
                </div>
              );
            })() : (
              <div style={{ padding: '14px', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', background: 'var(--surface-2)' }}>Selecione uma bobina para registrar o consumo</div>
            )}
          </div>
        </>
      )}

      <div className="field" style={{ marginTop: 18 }}><label>Operador responsável</label>
        <Select value={form.operator} onChange={(v) => setForm({ ...form, operator: v })}
          options={OPERATORS.map(o => ({ value: o, label: o }))}/>
      </div>
    </div>
  );
};

// ───────────────────────────── Impressão (kanban + tabela) ─────────────────────────────
const Printing = () => {
  const store = useStock();
  const [view, setView] = React.useState('kanban');
  const [open, setOpen] = React.useState(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [items, setItems] = React.useState(ORION_DATA.printing);
  const [posted, setPosted] = React.useState(() => new Set(ORION_DATA.printing.filter(p => p.status === 'concluido').map(p => p.id)));
  const [dragId, setDragId] = React.useState(null);
  const [overCol, setOverCol] = React.useState(null);
  const [hoverId, setHoverId] = React.useState(null);
  const moveTo = (id, status) => setItems(arr => arr.map(it => it.id === id ? { ...it, status } : it));

  const emptyForm = { estampa: '', roll: '', grade: {}, operator: '', date: '', status: 'pendente', planned: 0, printed: 0, consumed: 0 };
  const [form, setForm] = React.useState(emptyForm);
  const openNew = () => { setForm(emptyForm); setNewOpen(true); };
  const openExisting = (c) => {
    const p = ORION_DATA.prints.find(pp => pp.id === c.estampa);
    setForm({ ...c, grade: distributePrintGrade(p, c.planned, c.printed) });
    setOpen(c);
  };
  const printOf = (c) => ORION_DATA.prints.find(p => p.id === c.estampa) || {};

  const gradeTotals = (g, print) => {
    let planned = 0, printed = 0; const sidesT = {};
    if (!print) return { planned, printed, sidesT };
    print.sides.forEach(side => {
      let s = 0; print.variations.forEach(v => { const c = (g[v.id] && g[v.id][side]) || {}; planned += c.planned || 0; printed += c.printed || 0; s += c.printed || 0; });
      sidesT[side] = s;
    });
    return { planned, printed, sidesT };
  };

  const saveOrder = () => {
    const print = printOf(form);
    const t = gradeTotals(form.grade || {}, print);
    setItems(arr => arr.map(it => it.id === form.id ? { ...it, estampa: form.estampa, roll: form.roll, operator: form.operator, status: form.status, planned: t.planned, printed: t.printed, consumed: form.consumed } : it));
    setOpen(null);
  };

  const createOrder = () => {
    const print = printOf(form);
    const t = gradeTotals(form.grade || {}, print);
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const num = Math.max(211, ...items.map(i => +String(i.code).replace('IM-', '') || 0)) + 1;
    const order = { id: `IM-${num}`, code: `IM-${num}`, estampa: form.estampa, roll: form.roll, status: 'pendente', planned: t.planned, printed: 0, operator: form.operator || OPERATORS[0], date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, consumed: 0 };
    setItems(arr => [order, ...arr]);
    setNewOpen(false);
  };

  // concluir + lançar no estoque (abate papel, credita impressos)
  const postOrder = () => {
    const print = printOf(form);
    const t = gradeTotals(form.grade || {}, print);
    const meters = (form.consumed && form.consumed > 0) ? form.consumed : +((PRINT_CONSUMO[print.technique] || 0.4) * t.printed).toFixed(1);
    store.completePrintOrder({ code: form.code, estampaId: form.estampa, paperId: form.roll, meters, sides: t.sidesT });
    setItems(arr => arr.map(it => it.id === form.id ? { ...it, status: 'concluido', printed: t.printed, planned: t.planned, consumed: meters } : it));
    setPosted(s => new Set(s).add(form.id));
    setOpen(null);
  };

  const groups = [
    { id: 'pendente', label: 'Pendente' },
    { id: 'imprimindo', label: 'Imprimindo' },
    { id: 'concluido', label: 'Concluído' },
  ];

  // Linhas do card: uma por VARIAÇÃO (somando os lados) — o análogo dos tamanhos
  // no Corte. Usa a grade distribuída a partir dos totais planejado/impresso.
  const printRows = (c) => {
    const p = printOf(c);
    if (!p || !p.variations) return [];
    const g = distributePrintGrade(p, c.planned, c.printed);
    const twoSided = p.sides.length > 1;
    const out = [];
    p.variations.forEach(v => {
      p.sides.forEach(side => {
        const cell = (g[v.id] && g[v.id][side]) || {};
        const planned = cell.planned || 0, printed = cell.printed || 0;
        if (planned <= 0) return;
        out.push({ key: v.id + '-' + side, name: v.name, ink: v.ink, sideLabel: twoSided ? printSideLabel(side) : null, planned, printed });
      });
    });
    return out;
  };
  // Distribui cada ordem nas colunas conforme a grade. Ordens parciais aparecem
  // em DUAS colunas — variações ainda abertas em "Imprimindo" e as já impressas
  // viram um eco em "Concluído".
  const placementsFor = (colId) => {
    const out = [];
    items.forEach(c => {
      const rows = printRows(c);
      const open = rows.filter(r => r.printed < r.planned);
      const done = rows.filter(r => r.planned > 0 && r.printed >= r.planned);
      if (c.status === 'pendente') { if (colId === 'pendente') out.push({ c, rows, role: 'primary' }); }
      else if (c.status === 'concluido') { if (colId === 'concluido') out.push({ c, rows, role: 'primary' }); }
      else { // imprimindo
        if (open.length) {
          if (colId === 'imprimindo') out.push({ c, rows: open, role: 'primary' });
          if (colId === 'concluido' && done.length) out.push({ c, rows: done, role: 'echo' });
        } else if (colId === 'concluido') out.push({ c, rows, role: 'primary' });
      }
    });
    return out;
  };

  return (
    <div className="page">
      <PageHead sub="printing" title="Impressão" titleEm="de estampas"
                desc="Lotes de impressão DTF e sublimação."
                actions={<>
                  <Seg value={view} onChange={setView} options={[{ value: 'kanban', label: 'Kanban' }, { value: 'table', label: 'Tabela' }]}/>
                  <button className="btn btn-primary" onClick={openNew}><Icon name="printer" size={14}/> Nova ordem</button>
                </>}/>
      <HelpCard id="printing" icon="printer" tone="var(--brand-prod)" maxW={720} title="Impressão — o espelho do Corte, no caminho do papel">
        <HelpBody>
          Você planeja uma <b>ordem de impressão</b> escolhendo a <b>estampa</b>, os <b>lados</b> (frente/costas) e as <b>variações</b> de cor; o Orion <b>abate a bobina de papel/filme</b> e gera os <b>impressos</b>. Eles seguem para a <b>Montagem</b>, onde são prensados na peça lisa.
        </HelpBody>
        <Flow accent="var(--brand-prod)" steps={[
          { icon: 'scroll', label: 'Bobina', sub: 'papel / filme' },
          { icon: 'printer', label: 'Impressão', sub: 'abate o saldo', tone: 'accent' },
          { icon: 'stamp', label: 'Impressos', sub: 'por lado · variação' },
          { icon: 'combine', label: 'Montagem', sub: '+ peça lisa', tone: 'ok' },
        ]}/>
      </HelpCard>

      {view === 'kanban' ? (
        <div className="grid g-cols-3">
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
                  {g.id === 'pendente' && <button className="btn btn-sm btn-ghost" onClick={openNew}><Icon name="printer" size={12}/></button>}
                </div>
                <div style={{ display: 'grid', gap: 8, minHeight: 40 }}>
                  {place.map(({ c, rows, role }) => {
                    const p = printOf(c);
                    const printed = rows.reduce((s, r) => s + r.printed, 0);
                    const planned = rows.reduce((s, r) => s + r.planned, 0);
                    const all = printRows(c);
                    const allP = all.reduce((s, r) => s + r.planned, 0);
                    const allPr = all.reduce((s, r) => s + r.printed, 0);
                    const partial = allPr > 0 && allPr < allP;
                    const tear = partial ? (role === 'echo' ? 'top' : 'bottom') : null;
                    const hot = hoverId === c.id;
                    const cardInner = (
                      <div key={c.id + '-' + role} onClick={() => openExisting(c)} draggable={role === 'primary'}
                        onMouseEnter={() => setHoverId(c.id)} onMouseLeave={() => setHoverId(h => h === c.id ? null : h)}
                        onDragStart={role === 'primary' ? (e) => { setDragId(c.id); e.dataTransfer.effectAllowed = 'move'; } : undefined}
                        onDragEnd={() => { setDragId(null); setOverCol(null); }}
                        style={{ background: hot ? 'color-mix(in oklab, var(--brand-prod) 5%, var(--bg))' : 'var(--bg)', border: `1px solid ${hot ? 'var(--brand-prod)' : 'var(--line-soft)'}`, borderRadius: 'var(--radius-sm)', padding: 12, cursor: role === 'primary' ? 'grab' : 'pointer', opacity: dragId === c.id && role === 'primary' ? 0.4 : 1, transform: hot ? 'translateY(-1px)' : 'none', boxShadow: hot ? '0 4px 14px rgba(0,0,0,.07)' : 'none', transition: 'transform .14s, box-shadow .14s, border-color .14s, background .14s', ...(tear ? tornEdgeStyle(tear) : {}) }}>
                        {/* topo: estampa (ativo) + técnica + ID esmaecido */}
                        <CardHead glyph={<Icon name="palette" size={16} strokeWidth={1.6}/>} title={p.name || c.estampa} sub={p.technique} code={c.code}/>
                        {/* ativo: variações + progresso */}
                        <div style={{ display: 'grid', gap: 9, marginTop: 11 }}>
                          {rows.map(r => {
                            const pct = r.planned > 0 ? Math.min(100, (r.printed / r.planned) * 100) : 0;
                            const rdone = r.planned > 0 && r.printed >= r.planned;
                            return (
                              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><InkDot ink={r.ink} size={12}/></span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                                    <span style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                    {r.sideLabel && <span style={{ fontSize: 10.5, color: 'var(--ink-3)', flexShrink: 0 }}>{r.sideLabel}</span>}
                                    <span className="num" style={{ marginLeft: 'auto', fontSize: 12.5, color: rdone ? 'var(--ok)' : 'var(--ink)', fontFamily: 'var(--font-display)', flexShrink: 0 }}>{r.printed}<span style={{ color: 'var(--ink-3)' }}>/{r.planned}</span></span>
                                  </div>
                                  <div style={{ height: 4, background: 'var(--line-soft)', borderRadius: 999, marginTop: 5, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, background: rdone ? 'var(--ok)' : 'var(--brand-prod)', borderRadius: 999 }}/>
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
                          <CardMeta icon="scroll">{c.roll}</CardMeta>
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
          <table className="tbl">
            <thead><tr><th>Código</th><th>Estampa</th><th>Técnica</th><th>Bobina</th><th>Operador</th><th>Status</th><th className="num">Plano</th><th className="num">Impresso</th><th>Data</th></tr></thead>
            <tbody>{items.map(c => { const p = printOf(c); return (
              <tr key={c.id} onClick={() => openExisting(c)}>
                <td className="mono">{c.code}</td>
                <td style={{ color: 'var(--ink)', fontWeight: 500 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><PrintThumb tone={p.tone} size={24}/>{p.name || c.estampa}</div></td>
                <td><span className="pill">{p.technique}</span></td>
                <td className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{c.roll}</td>
                <td>{c.operator}</td><td><StatusPill s={c.status}/></td>
                <td className="num">{c.planned}</td><td className="num">{c.printed}</td><td>{c.date}</td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)}
             title={open ? `Ordem ${open.code}` : ''}
             sub={open ? <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{printOf(open).name}</span> : null}
             footer={<>
               <button className="btn btn-ghost" style={{ color: 'var(--err)', marginRight: 'auto' }}><Icon name="trash-2" size={13}/> Excluir ordem</button>
               <button className="btn" onClick={saveOrder}><Icon name="check" size={13}/> Salvar</button>
               {open && posted.has(open.id)
                 ? <button className="btn" disabled style={{ color: 'var(--ok)' }}><Icon name="check-circle-2" size={13}/> No estoque</button>
                 : <button className="btn btn-primary" onClick={postOrder}><Icon name="stamp" size={13}/> Lançar impressos</button>}
             </>}>
        {open && <PrintingDetail form={form} setForm={setForm} isNew={false}/>}
      </Sheet>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)}
             title="Nova ordem de impressão"
             sub={<span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Planeje um lote contra uma bobina de papel</span>}
             footer={<>
               <button className="btn" onClick={() => setNewOpen(false)}>Cancelar</button>
               <button className="btn btn-primary" disabled={!form.estampa} onClick={createOrder}><Icon name="printer" size={13}/> Criar ordem</button>
             </>}>
        <PrintingDetail form={form} setForm={setForm} isNew={true}/>
      </Sheet>
    </div>
  );
};

// ───────────────────────────── Montagem (convergência, guiada pela demanda) ─────────────────────────────
// Em vez de um pareamento manual, a Montagem é orientada pelos SKUs que os pedidos
// abertos esperam. Para cada SKU o Orion mostra a necessidade, a disponibilidade de
// peça lisa e de impresso, e libera o botão Montar só quando os dois existem.
// uma linha de componente: peça lisa / impresso — quantidade sempre visível;
// disponível vs faltando é distinguido só pelo check/ícone e pela cor.
const CompLine = ({ ok, icon, label, qty }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center', flexShrink: 0,
      background: ok ? 'var(--ok-bg)' : 'var(--warn-bg)', color: ok ? 'var(--ok)' : 'var(--warn)',
      border: `1px solid color-mix(in oklab, ${ok ? 'var(--ok)' : 'var(--warn)'} 22%, var(--surface))` }}>
      <Icon name={ok ? 'check' : icon} size={12} strokeWidth={2}/>
    </span>
    <span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
      <b style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, color: ok ? 'var(--ink)' : 'var(--warn)' }}>{qty}×</b> {label}
    </span>
  </div>
);

// card de um SKU esperado (colunas Aguardando / A montar)
const MontCard = ({ s, mode, onMontar }) => {
  const missLabel = s.state === 'ambos' ? 'estampa + peça lisa' : s.state === 'lisa' ? 'peça lisa' : 'estampa';
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', lineHeight: 1, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{s.net}<span style={{ fontSize: 13, color: 'var(--ink-3)' }}>×</span></span>
          <EstampaThumb code={s.estampa} size={30}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.garment}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{s.color} · {s.size}</div>
          </div>
          <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', flexShrink: 0 }}>{s.estampa}</span>
        </div>

        <div style={{ display: 'grid', gap: 7, marginTop: 11 }}>
          <CompLine ok={s.blankShort <= 0} icon="shirt" label="Peça lisa" qty={s.net}/>
          <CompLine ok={s.printedShort <= 0} icon="stamp" label="Impresso" qty={s.net}/>
        </div>

        {mode !== 'todo' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11, paddingTop: 9, borderTop: '1px solid var(--line-soft)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 500, color: 'var(--warn)', background: 'var(--warn-bg)', border: '1px solid color-mix(in oklab, var(--warn) 24%, var(--surface))', whiteSpace: 'nowrap' }}>
              <Icon name="ban" size={11}/> {missLabel}
            </span>
          </div>
        )}
      </div>
      {mode === 'todo' && (
        <button className="card-foot-btn card-foot-btn--primary" onClick={() => onMontar(s)}>
          <Icon name="combine" size={13}/> Montar {s.buildable}
        </button>
      )}
    </div>
  );
};

// card de montagem concluída (coluna Montado)
const DoneCard = ({ m }) => {
  const code = (m.sku || '').split('-')[1] || '';
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-sm)', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
      <EstampaThumb code={code} size={30}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.sku}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{m.date}</div>
      </div>
      <span className="num" style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ok)', flexShrink: 0 }}>+{m.qty}</span>
    </div>
  );
};

const Montagem = () => {
  const store = useStock();
  const [montOpen, setMontOpen] = React.useState(false);
  const [model, setModel] = React.useState(() => window.OrionDemand.build());
  React.useEffect(() => store.subscribe(() => setModel(window.OrionDemand.build())), []);

  const skus = model.skus.filter(s => s.net > 0);
  const ready = skus.filter(s => s.buildable > 0).sort((a, b) => b.buildable - a.buildable || b.net - a.net);
  const waiting = skus.filter(s => s.buildable === 0).sort((a, b) => b.net - a.net);
  const done = ORION_DATA.movements.filter(m => /Montagem/.test(m.reason) && m.qty > 0).slice(0, 14);

  // monta um SKU lendo os saldos AO VIVO (seguro em loop / cliques repetidos)
  const montar = (s) => {
    const blank = ORION_DATA.blankPieces.find(b => b.id === (s.blank && s.blank.id));
    const printed = ORION_DATA.printed.find(p => p.id === (s.printed && s.printed.id));
    if (!blank || !printed) return;
    const qty = Math.max(0, Math.min(s.net, blank.count, printed.count));
    if (qty <= 0) return;
    const est = ORION_DATA.fulfillment.estampas[s.estampa] || {};
    store.assemble({
      blankId: blank.id, printedId: printed.id, qty,
      productMeta: { sku: store.skuFor(blank, s.estampa), product: s.product, color: s.color, size: s.size, print: `${s.estampa} · ${est.name || ''}` },
      ref: 'Demanda',
    });
  };
  const montarTodos = () => ready.forEach(montar);

  const COLS = [
    { id: 'waiting', label: 'Aguardando', color: 'var(--warn)', items: waiting, mode: 'wait',
      empty: 'Nada parado — todos os componentes chegaram.' },
    { id: 'todo', label: 'A montar', color: 'var(--brand-prod)', items: ready, mode: 'todo',
      empty: 'Nenhum SKU pronto para montar agora.' },
    { id: 'done', label: 'Montado', color: 'var(--ok)', items: done, mode: 'done',
      empty: 'Nenhuma montagem ainda.' },
  ];

  return (
    <div className="page">
      <PageHead sub="montagem" title="Montagem" titleEm="& acabamento"
                desc="Peça lisa + impresso, prensados em produto acabado."
                actions={<>
                  <button className="btn" onClick={() => setMontOpen(true)}><Icon name="combine" size={14}/> Montagem avulsa</button>
                  <button className="btn btn-primary" disabled={ready.length === 0} onClick={montarTodos}><Icon name="combine" size={14}/> Montar prontos ({ready.length})</button>
                </>}/>
      <HelpCard id="montagem" icon="combine" tone="var(--brand-prod)" maxW={760} title="Montagem — onde os dois caminhos se encontram">
        <HelpBody>
          A Montagem sabe quais <b>SKUs</b> os pedidos esperam. Cada um precisa de uma <b>peça lisa</b> (do corte e da costura) e de um <b>impresso</b> (da impressão). Enquanto falta um componente, o SKU fica em <b>Aguardando</b>; quando os dois chegam, vai para <b>A montar</b>; ao prensar, vira produto em estoque e o pedido fica <b>pronto para separação</b>.
        </HelpBody>
        <Flow accent="var(--brand-prod)" steps={[
          { icon: 'shirt', label: 'Peça lisa', sub: 'costura' },
          { icon: 'stamp', label: 'Impresso', sub: 'impressão' },
          { icon: 'combine', label: 'Montagem', sub: 'prensa', tone: 'accent' },
          { icon: 'package-check', label: 'Separação', sub: 'pronto p/ expedir', tone: 'ok' },
        ]}/>
      </HelpCard>

      <div className="grid g-cols-3">
        {COLS.map(col => (
          <div key={col.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, flexShrink: 0 }}/>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{col.label}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{col.items.length}</span>
              </div>
              {col.id === 'todo' && ready.length > 0 && (
                <button className="btn btn-sm btn-ghost" title="Montar todos os prontos" onClick={montarTodos}><Icon name="combine" size={12}/></button>
              )}
            </div>
            <div style={{ display: 'grid', gap: 8, minHeight: 40 }}>
              {col.items.length === 0 ? (
                <div style={{ padding: '22px 12px', textAlign: 'center', fontSize: 12, color: 'var(--ink-3)' }}>{col.empty}</div>
              ) : col.id === 'done'
                ? col.items.map((m, i) => <DoneCard key={i} m={m}/>)
                : col.items.map(s => <MontCard key={s.key} s={s} mode={col.mode} onMontar={montar}/>)}
            </div>
          </div>
        ))}
      </div>

      {React.createElement(window.MontagemModal, { open: montOpen, onClose: () => setMontOpen(false) })}
    </div>
  );
};

Object.assign(window, { Printing, Montagem, PrintThumb });
