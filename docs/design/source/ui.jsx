// Shared UI primitives + helpers for Orion

const fmt = (n, d=2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtBRL = (n) => "R$ " + fmt(n);
const fmtInt = (n) => n.toLocaleString('pt-BR');
window.fmt = fmt; window.fmtBRL = fmtBRL; window.fmtInt = fmtInt;

// Sub-product registry — color + identity per top-level section
const SUBS = {
  dashboard: { name: "Início",       short: "I", icon: "layout-dashboard", color: "var(--accent)" },
  orders:    { name: "Vendas",       short: "V", icon: "shopping-bag",   color: "var(--brand-sales)",   group: "vendas" },
  clients:   { name: "Clientes",     short: "V", icon: "users",          color: "var(--brand-sales)",   group: "vendas" },
  ads:       { name: "Anúncios",     short: "V", icon: "megaphone",      color: "var(--brand-sales)",   group: "vendas" },
  products:  { name: "Produtos",     short: "C", icon: "shirt",          color: "var(--brand-catalog)", group: "catalogo" },
  specs:     { name: "Fichas",       short: "C", icon: "file-text",      color: "var(--brand-catalog)", group: "catalogo" },
  prints:    { name: "Estampas",     short: "C", icon: "palette",        color: "var(--brand-catalog)", group: "catalogo" },
  cutting:   { name: "Corte",        short: "P", icon: "scissors",       color: "var(--brand-prod)",    group: "producao" },
  sewing:    { name: "Costura",      short: "P", icon: "send",           color: "var(--brand-prod)",    group: "producao" },
  contractors:{name: "Bancas",       short: "P", icon: "factory",        color: "var(--brand-prod)",    group: "producao" },
  fabric:    { name: "Tecidos",      short: "E", icon: "layers",         color: "var(--brand-inv)",     group: "estoque" },
  stock:     { name: "Estoque",      short: "E", icon: "boxes",          color: "var(--brand-inv)",     group: "estoque" },
  reports:   { name: "Relatórios",   short: "R", icon: "bar-chart-3",    color: "var(--brand-reports)" },
  settings:  { name: "Ajustes",      short: "A", icon: "settings",       color: "var(--brand-settings)" },
};
window.SUBS = SUBS;

// Sub-product identity badge
const SubBadge = ({ id, size = 'md' }) => {
  const s = SUBS[id]; if (!s) return null;
  return (
    <span className="sub-badge" style={{ '--sub-color': s.color }}>
      <span className="sub-badge-mark"><Icon name={s.icon} size={11} strokeWidth={2.2}/></span>
      {s.name}
    </span>
  );
};

// Channel chip (sales channels)
const ChannelChip = ({ id }) => {
  const ch = ORION_DATA.channels[id]; if (!ch) return null;
  return (
    <span className="ch-chip">
      <span className="ch-chip-dot" style={{ background: ch.color, color: ch.fg || 'white' }}>{ch.short}</span>
      {ch.name}
    </span>
  );
};

// Status pill (order/cutting/sewing)
const STATUS_MAP = {
  pendente:  { kind: 'warn', label: 'Pendente',  icon: 'clock' },
  pago:      { kind: 'info', label: 'Pago',      icon: 'circle-dollar-sign' },
  enviado:   { kind: 'info', label: 'Enviado',   icon: 'truck' },
  entregue:  { kind: 'ok',   label: 'Entregue',  icon: 'package-check' },
  cortando:  { kind: 'info', label: 'Cortando',  icon: 'scissors' },
  concluido: { kind: 'ok',   label: 'Concluído', icon: 'check-circle-2' },
  recebido:  { kind: 'ok',   label: 'Recebido',  icon: 'package-check' },
  parcial:   { kind: 'warn', label: 'Parcial',   icon: 'circle-dashed' },
  atrasado:  { kind: 'err',  label: 'Atrasado',  icon: 'alert-triangle' },
  ativo:     { kind: 'ok',   label: 'Ativo',     icon: 'circle-dot' },
  pausado:   { kind: 'muted',label: 'Pausado',   icon: 'pause' },
  convidado: { kind: 'warn', label: 'Convidado', icon: 'mail' },
};
const StatusPill = ({ s }) => {
  const m = STATUS_MAP[s] || { kind: '', label: s, icon: 'circle' };
  return <span className={`pill ${m.kind}`}><Icon name={m.icon} size={11} strokeWidth={2.2}/>{m.label}</span>;
};

// Card shell
const Card = ({ title, sub, action, children, pad = true, style }) => (
  <div className="card" style={style}>
    {(title || action) && (
      <div className="card-head">
        <div>
          {title && <div className="card-title">{title}</div>}
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {action}
      </div>
    )}
    <div style={pad ? { padding: '14px 18px 18px' } : null}>{children}</div>
  </div>
);

// Avatar
const Av = ({ name, color = '#1f1b15', size }) => {
  const ini = name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase();
  const style = { background: color };
  if (size) { style.width = size; style.height = size; style.fontSize = Math.round(size * 0.36); style.borderRadius = Math.round(size * 0.22); }
  return <span className="av" style={style}>{ini}</span>;
};

// Mini sparkline (SVG)
const Spark = ({ data, color = 'currentColor', height = 36 }) => {
  if (!data || !data.length) return null;
  const w = 120, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} opacity="0.08" />
    </svg>
  );
};

// Modal
const Modal = ({ open, onClose, title, children, footer, size }) => {
  if (!open) return null;
  return (
    <div className="modal-veil" onClick={onClose}>
      <div className={"modal" + (size === 'lg' ? ' modal-lg' : '')} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="card-title" style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{title}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
};

// Side sheet
const Sheet = ({ open, onClose, title, sub, children, footer }) => {
  if (!open) return null;
  return (
    <>
      <div className="sheet-veil" onClick={onClose}/>
      <div className="sheet">
        <div className="sheet-head">
          <div>
            <div className="card-title" style={{ fontFamily: 'var(--font-display)', fontSize: 18 }}>{title}</div>
            {sub && <div className="card-sub" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="x" size={14}/></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
};

// Page header
const PageHead = ({ sub, title, titleEm, desc, actions }) => {
  const s = SUBS[sub] || {};
  return (
    <div className="page-head" style={{ '--sub-color': s.color }}>
      <div className="page-head-l">
        <div className="page-eyebrow">
          <span className="page-eyebrow-mark" style={{ background: s.color }}>
            <Icon name={s.icon} size={11} strokeWidth={2.2}/>
          </span>
          {s.name}
        </div>
        <h1 className="page-title">{title} {titleEm && <em>{titleEm}</em>}</h1>
        {desc && <div className="page-sub">{desc}</div>}
      </div>
      {actions && <div className="page-head-r">{actions}</div>}
    </div>
  );
};

// Empty state
const Empty = ({ icon = 'sparkles', title, desc, cta }) => (
  <div className="empty">
    <div className="empty-mark"><Icon name={icon} size={24}/></div>
    <h3>{title}</h3>
    <div style={{ maxWidth: 360, margin: '0 auto 12px', fontSize: 13, lineHeight: 1.5 }}>{desc}</div>
    {cta}
  </div>
);

// Table toolbar
const TableToolbar = ({ children }) => <div className="toolbar">{children}</div>;

// Search input (cosmetic)
const SearchInput = ({ placeholder, value, onChange }) => (
  <div className="tb-input">
    <Icon name="search" size={13}/>
    <input placeholder={placeholder} value={value || ''} onChange={e => onChange?.(e.target.value)}/>
  </div>
);

// Segmented control
const Seg = ({ value, options, onChange }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

// Mini fabric thumb (decorative)
const FabricThumb = ({ tone = 'warm', size = 36 }) => {
  const tones = {
    warm:  ['#f4d9b8', '#c2410c'],
    sand:  ['#efe6d3', '#a16207'],
    moss:  ['#d6dfd0', '#3a4a3d'],
    bone:  ['#f4f1ea', '#7a7160'],
    stone: ['#dfd9cd', '#57534e'],
  };
  const [a, b] = tones[tone] || tones.warm;
  return (
    <span style={{
      width: size, height: size, borderRadius: 8,
      background: `repeating-linear-gradient(135deg, ${a} 0 4px, ${b}22 4px 8px)`,
      border: `1px solid ${b}33`,
      display: 'inline-block', flexShrink: 0,
    }}/>
  );
};

// Custom select (dropdown) — matches our visual style, replaces native <select>
const Select = ({ value, onChange, options, placeholder = "Selecione…", searchable = true, renderOption }) => {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const ref = React.useRef(null);
  const searchRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    if (searchable) setTimeout(() => searchRef.current?.focus(), 30);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, searchable]);
  React.useEffect(() => { if (!open) setQ(''); }, [open]);
  const opts = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const current = opts.find(o => o.value === value);
  const filtered = q ? opts.filter(o => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(q.toLowerCase())) : opts;
  return (
    <div ref={ref} className="cs-wrap">
      <button type="button" className={"cs-trigger" + (open ? ' open' : '')} onClick={() => setOpen(v => !v)}>
        <span className={current ? "cs-val" : "cs-placeholder"} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {current && current.icon && <Icon name={current.icon} size={13} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current ? current.label : placeholder}</span>
        </span>
        <Icon name="chevron-down" size={14} style={{ color: 'var(--ink-3)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}/>
      </button>
      {open && (
        <div className="cs-menu">
          {searchable && (
            <div style={{ padding: 8, borderBottom: '1px solid var(--line-soft)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <div style={{ position: 'relative' }}>
                <Icon name="search" size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }}/>
                <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…"
                  style={{ width: '100%', padding: '7px 10px 7px 28px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', font: 'inherit', fontSize: 12.5, outline: 'none' }}/>
              </div>
            </div>
          )}
          {filtered.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>Nada encontrado</div>
          )}
          {filtered.map(o => (
            <button key={o.value} type="button"
              className={"cs-opt" + (o.value === value ? ' active' : '')}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              {renderOption ? renderOption(o) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  {o.icon && <Icon name={o.icon} size={13} style={{ color: 'var(--ink-3)' }}/>}
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                    {o.sub && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{o.sub}</span>}
                  </span>
                </span>
              )}
              {o.value === value && <Icon name="check" size={13} style={{ color: 'var(--accent)' }}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Numeric input with optional unit prefix/suffix and custom up/down stepper
// Replaces native browser number spinner.
const NumField = ({
  value, onChange, step = 1, min, max,
  prefix, suffix, decimals,
  align = 'left', placeholder, style,
}) => {
  const clamp = (n) => {
    if (typeof min === 'number' && n < min) n = min;
    if (typeof max === 'number' && n > max) n = max;
    return n;
  };
  const fmtVal = (v) => {
    if (v === '' || v === null || v === undefined || Number.isNaN(v)) return '';
    if (typeof decimals === 'number') {
      return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    // Infer decimals from step
    const sd = (String(step).split('.')[1] || '').length;
    return sd ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: sd, maximumFractionDigits: sd }) : String(v);
  };
  const [draft, setDraft] = React.useState(fmtVal(value));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => { if (!focused) setDraft(fmtVal(value)); }, [value, focused]);

  const parse = (s) => {
    if (s === '' || s === '-') return '';
    const cleaned = String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? '' : n;
  };
  const bump = (dir) => {
    const cur = typeof value === 'number' ? value : (parse(draft) || 0);
    const next = clamp(+(cur + dir * step).toFixed(10));
    onChange(next);
    setDraft(fmtVal(next));
  };
  return (
    <div className={"numfield" + (focused ? ' focus' : '')} style={style}>
      {prefix && <span className="numfield-affix numfield-prefix">{prefix}</span>}
      <input
        type="text" inputMode="decimal"
        value={focused ? draft : fmtVal(value)}
        placeholder={placeholder}
        onFocus={(e) => { setFocused(true); setDraft(String(value ?? '').replace('.', ',')); setTimeout(() => e.target.select(), 0); }}
        onBlur={() => { setFocused(false); const n = parse(draft); if (n !== '' && typeof n === 'number') { onChange(clamp(n)); } }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); bump(+1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
          if (e.key === 'Enter')     { e.target.blur(); }
        }}
        style={{ textAlign: align }}
      />
      {suffix && <span className="numfield-affix numfield-suffix">{suffix}</span>}
      <span className="numfield-stepper">
        <button type="button" tabIndex={-1} aria-label="Aumentar" onClick={() => bump(+1)}><Icon name="chevron-up" size={10} strokeWidth={2.4}/></button>
        <button type="button" tabIndex={-1} aria-label="Diminuir" onClick={() => bump(-1)}><Icon name="chevron-down" size={10} strokeWidth={2.4}/></button>
      </span>
    </div>
  );
};

// Sortable table header — click toggles asc/desc; shows arrow when active
const SortHeader = ({ id, sort, setSort, num, children, style }) => {
  const active = sort.col === id;
  const next = active && sort.dir === 'asc' ? 'desc' : 'asc';
  return (
    <th className={num ? 'num' : ''} onClick={() => setSort({ col: id, dir: next })}
        style={{ cursor: 'pointer', userSelect: 'none', ...(style || {}) }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: num ? 'flex-end' : 'flex-start', width: '100%' }}>
        {children}
        <Icon name={!active ? 'chevrons-up-down' : sort.dir === 'asc' ? 'chevron-up' : 'chevron-down'}
              size={11} style={{ color: active ? 'var(--ink-2)' : 'var(--ink-3)', opacity: active ? 1 : .5 }}/>
      </span>
    </th>
  );
};

// Sort helper: returns a comparator
const makeCmp = (sort, getters) => (a, b) => {
  const get = getters[sort.col]; if (!get) return 0;
  const va = get(a), vb = get(b);
  const dir = sort.dir === 'asc' ? 1 : -1;
  if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
  return String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR') * dir;
};

Object.assign(window, { SubBadge, ChannelChip, StatusPill, Card, Av, Spark, Modal, Sheet, PageHead, Empty, TableToolbar, SearchInput, Seg, FabricThumb, Select, NumField, SortHeader, makeCmp });
