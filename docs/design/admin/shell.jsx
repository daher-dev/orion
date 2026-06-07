// Orion Console — shell (sidebar, topbar, app switcher) + shared bits.
// Depends on: Icon, Card, Av, CONSOLE, ORION_DATA.

// ───────── Status / plan helpers ─────────
const ORG_STATUS = {
  ativa:        { kind: 'ok',    dot: 'ok',    label: 'Ativa' },
  trial:        { kind: 'info',  dot: 'info',  label: 'Trial' },
  inadimplente: { kind: 'err',   dot: 'err',   label: 'Inadimplente' },
  pausada:      { kind: 'muted', dot: 'muted', label: 'Pausada' },
};
const OrgStatus = ({ s }) => {
  const m = ORG_STATUS[s] || ORG_STATUS.ativa;
  return <span className={`pill ${m.kind}`}><span className="sdot" style={{ width: 6, height: 6, boxShadow: 'none' }}/>{m.label}</span>;
};
window.OrgStatus = OrgStatus;
window.ORG_STATUS = ORG_STATUS;

const PlanTag = ({ id, size }) => {
  const p = CONSOLE.planById(id); if (!p) return null;
  return (
    <span className="plan-tag" style={{ '--pc': p.color, ...(size === 'sm' ? { fontSize: 11, padding: '1px 8px 1px 6px' } : {}) }}>
      <span className="pill-dot"/>{p.name}
    </span>
  );
};
window.PlanTag = PlanTag;

// Org identity square
const OrgMark = ({ org, size = 34 }) => {
  const ini = org.name.split(/\s+/).filter(w => w.length > 1 || /\d/.test(w)).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return <span className="org-mark" style={{ background: org.accent, width: size, height: size, fontSize: Math.round(size * 0.44), borderRadius: Math.round(size * 0.26) }}>{ini}</span>;
};
window.OrgMark = OrgMark;

// Metric tile (overview KPIs)
const Metric = ({ label, value, delta, deltaGood, foot, accent }) => {
  const up = delta != null && delta >= 0;
  const good = deltaGood === undefined ? up : deltaGood;
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="kpi-value" style={accent ? { color: 'var(--accent)' } : null}>{value}</span>
        {delta != null && (
          <span className={`kpi-delta ${good ? 'up' : 'down'}`}>
            <Icon name={up ? 'arrow-up-right' : 'arrow-down-right'} size={12} strokeWidth={2.4}/>
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {foot && <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{foot}</div>}
    </div>
  );
};
window.Metric = Metric;

// ───────── App switcher popover ─────────
// Admin-only bridge between the tenant app and the console. Here in the
// console it offers a jump back into the product (optionally as an org).
const AppSwitcher = ({ onClose }) => {
  const mine = (CONSOLE.myOrgIds || []).map(CONSOLE.orgById).filter(Boolean);
  const go = (url) => { window.location.href = url; };
  return (
    <div className="sw-pop" style={{ left: 12, top: 56 }} onClick={e => e.stopPropagation()}>
      <div className="sw-sect">Você está em</div>
      <div className="sw-item" style={{ cursor: 'default' }}>
        <span className="sb-brand-mark" style={{ width: 30, height: 30, fontSize: 15, background: 'linear-gradient(150deg,#6d5cff,#4f46e5)' }}>
          <Icon name="orbit" size={15} strokeWidth={2} style={{ color: '#fff' }}/>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sw-item-name">Orion Console</div>
          <div className="sw-item-sub">Administração da plataforma</div>
        </div>
        <Icon name="check" size={15} style={{ color: 'var(--accent)' }}/>
      </div>

      {mine.length > 0 && (
        <>
          <div className="sw-div"/>
          <div className="sw-sect">Suas organizações</div>
          {mine.map(o => (
            <div key={o.id} className="sw-item" onClick={() => go('Orion.html')}>
              <OrgMark org={o} size={28}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sw-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</div>
                <div className="sw-item-sub">Sua conta · {o.city}</div>
              </div>
              <Icon name="arrow-up-right" size={14} style={{ color: 'var(--ink-3)' }}/>
            </div>
          ))}
        </>
      )}

      <div className="sw-div"/>
      <div className="sw-app" onClick={() => go('Orion.html')}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--ink)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="arrow-left" size={15}/>
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sw-item-name">Voltar ao app Orion</div>
          <div className="sw-item-sub">Sua própria conta de confecção</div>
        </div>
      </div>
    </div>
  );
};

// ───────── Sidebar ─────────
const CONSOLE_NAV = [
  { id: 'overview',     label: 'Visão geral',   icon: 'gauge',        color: 'var(--accent)' },
  { sect: 'Plataforma', items: [
    { id: 'orgs',         label: 'Organizações',  icon: 'building-2',   color: '#2563eb', count: null },
    { id: 'users',        label: 'Usuários',      icon: 'users',        color: '#0f766e' },
    { id: 'plans',        label: 'Planos',        icon: 'layout-grid',  color: '#7e5bef' },
    { id: 'integrations', label: 'Integrações',   icon: 'plug-zap',     color: '#c2410c' },
  ]},
];

const ConsoleSidebar = ({ route, setRoute, onPicker }) => {
  const attention = CONSOLE.orgs.filter(o => o.status === 'inadimplente' || (o.status === 'trial' && (o.trialEndsIn ?? 99) <= 7)).length;
  return (
    <aside className="sidebar">
      <div className="sb-brand sb-co-picker" onClick={onPicker}>
        <div className="sb-brand-mark"><Icon name="orbit" size={17} strokeWidth={2} style={{ color: '#fff' }}/></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="sb-brand-name">Orion</div>
          <div className="sb-console-tag">Console</div>
        </div>
        <Icon name="chevrons-up-down" size={14} style={{ color: 'rgba(199,194,255,.55)' }}/>
      </div>
      <div className="sb-scroll">
        {CONSOLE_NAV.map((n, i) => {
          if (n.sect) {
            return (
              <React.Fragment key={i}>
                <div className="sb-section">{n.sect}</div>
                {n.items.map(it => (
                  <div key={it.id} className={`sb-item ${route === it.id ? 'active' : ''}`}
                       style={{ '--sub-color': it.color }} onClick={() => setRoute(it.id)}>
                    <Icon name={it.icon} size={15}/>
                    <span>{it.label}</span>
                    {it.id === 'orgs' && attention > 0 && <span className="sb-count" style={{ background: 'color-mix(in oklab, var(--err) 80%, transparent)', color: '#fff' }}>{attention}</span>}
                  </div>
                ))}
              </React.Fragment>
            );
          }
          return (
            <div key={n.id} className={`sb-item ${route === n.id ? 'active' : ''}`}
                 style={{ '--sub-color': n.color }} onClick={() => setRoute(n.id)}>
              <Icon name={n.icon} size={15}/>
              <span>{n.label}</span>
            </div>
          );
        })}
      </div>
      <div className="sb-foot">
        <Av name="Orion Staff" color="#4f46e5"/>
        <div style={{ minWidth: 0, flex: 1 }} className="sb-foot-meta">
          <div className="sb-foot-name">Você · Orion</div>
          <div className="sb-foot-role">Equipe da plataforma</div>
        </div>
        <button className="sb-bell" title="Voltar ao app" onClick={(e) => { e.stopPropagation(); window.location.href = 'Orion.html'; }}>
          <Icon name="grid-2x2" size={15}/>
        </button>
      </div>
    </aside>
  );
};

// ───────── Topbar ─────────
const ConsoleTopbar = ({ onBurger }) => (
  <header className="topbar">
    <button className="tb-burger" onClick={onBurger}><Icon name="menu" size={18}/></button>
    <div className="tb-search" onClick={() => alert('Busca global — protótipo')}>
      <Icon name="search" size={14}/>
      <span>Buscar organização, pessoa ou e-mail…</span>
      <kbd>⌘K</kbd>
    </div>
    <div className="tb-spacer"/>
    <span className="tb-env"><Icon name="server" size={12}/> produção</span>
    <span className="tb-console-pill"><Icon name="shield" size={13} strokeWidth={2.2}/> Acesso interno</span>
  </header>
);

// ───────── Console page header (no SUBS dependency) ─────────
const ConsoleHead = ({ icon, color, eyebrow, title, titleEm, desc, actions }) => (
  <div className="page-head" style={{ '--sub-color': color || 'var(--accent)' }}>
    <div className="page-head-l">
      <div className="page-eyebrow">
        <span className="page-eyebrow-mark" style={{ background: color || 'var(--accent)' }}>
          <Icon name={icon} size={11} strokeWidth={2.2}/>
        </span>
        {eyebrow}
      </div>
      <h1 className="page-title">{title} {titleEm && <em>{titleEm}</em>}</h1>
      {desc && <div className="page-sub">{desc}</div>}
    </div>
    {actions && <div className="page-head-r">{actions}</div>}
  </div>
);

Object.assign(window, { AppSwitcher, ConsoleSidebar, ConsoleTopbar, ConsoleHead, CONSOLE_NAV });
