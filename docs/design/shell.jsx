// Sidebar + Topbar — depends on Icon, SUBS, ORION_DATA

const NAV = [
  { id: 'dashboard', label: 'Início' },
  { sect: 'Vendas', items: [
    { id: 'orders', label: 'Pedidos', count: 47 },
    { id: 'clients', label: 'Clientes' },
    { id: 'ads', label: 'Anúncios' },
  ]},
  { sect: 'Produção', items: [
    { id: 'planejamento', label: 'Planejamento' },
    { id: 'cutting', label: 'Corte', count: 8 },
    { id: 'sewing', label: 'Costura', count: 14 },
    { id: 'printing', label: 'Impressão', count: 2 },
    { id: 'montagem', label: 'Montagem' },
    { id: 'contractors', label: 'Bancas' },
  ]},
  { sect: 'Estoque', items: [
    { id: 'fabric', label: 'Tecidos' },
    { id: 'blanks', label: 'Peças lisas', count: 2 },
    { id: 'paper', label: 'Papel' },
    { id: 'printed', label: 'Impressos' },
    { id: 'stock', label: 'Produtos', count: 6 },
  ]},
  { sect: 'Catálogo', items: [
    { id: 'products', label: 'Produtos' },
    { id: 'specs', label: 'Fichas técnicas' },
    { id: 'prints', label: 'Estampas' },
  ]},
  { id: 'reports', label: 'Relatórios', sep: true },
  { id: 'settings', label: 'Ajustes' },
];

// Role visibility
const ROLE_HIDE = {
  operator: new Set(['orders', 'clients', 'ads', 'contractors', 'reports']),
  manager:  new Set([]),
  admin:    new Set([]),
};

// Other companies this user could belong to (prototype) + the admin bridge.
const SIBLING_COS = [
  { name: 'Maré Alta', city: 'Florianópolis, SC', accent: '#0f766e' },
  { name: 'Vértice',   city: 'Curitiba, PR',      accent: '#9333ea' },
];

const Sidebar = ({ route, setRoute, role, accent, companyName }) => {
  const hidden = ROLE_HIDE[role] || new Set();
  const isItemVisible = (id) => !hidden.has(id);
  const [sw, setSw] = React.useState(false);
  const isAdmin = role === 'admin';
  const CoMark = ({ name, ac, size = 30 }) => (
    <span style={{ width: size, height: size, borderRadius: 8, background: ac, color: '#fff',
      display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 600,
      fontSize: Math.round(size * 0.46), flexShrink: 0 }}>{name[0].toUpperCase()}</span>
  );
  return (
    <>
    <aside className="sidebar">
      <div className="sb-brand sb-co-picker" onClick={() => setSw(s => !s)}>
        <div className="sb-brand-mark">{companyName ? companyName[0].toUpperCase() : 'A'}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="sb-brand-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyName}</div>
          <div className="sb-brand-sub">
            <Icon name="orbit" size={9} strokeWidth={1.8}/>
            <span>por Orion</span>
          </div>
        </div>
        <Icon name="chevrons-up-down" size={14} style={{ color: 'rgba(245,239,224,.55)' }}/>
      </div>
      <div className="sb-scroll">
        {NAV.map((n, i) => {
          if (n.sect) {
            const visible = n.items.filter(it => isItemVisible(it.id));
            if (visible.length === 0) return null;
            return (
              <React.Fragment key={i}>
                <div className="sb-section">{n.sect}</div>
                {visible.map(it => {
                  const sub = SUBS[it.id];
                  return (
                    <div key={it.id} className={`sb-item ${route === it.id ? 'active' : ''}`}
                         style={{ '--sub-color': sub?.color }}
                         onClick={() => setRoute(it.id)}>
                      <Icon name={sub?.icon || 'circle'} size={15}/>
                      <span>{it.label}</span>
                      {it.count != null && <span className="sb-count">{it.count}</span>}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          }
          if (!isItemVisible(n.id)) return null;
          const sub = SUBS[n.id];
          return (
            <React.Fragment key={n.id}>
              {n.sep && <div style={{ height: 12 }}/>}
              <div className={`sb-item ${route === n.id ? 'active' : ''}`}
                   style={{ '--sub-color': sub?.color }}
                   onClick={() => setRoute(n.id)}>
                <Icon name={sub?.icon || 'circle'} size={15}/>
                <span>{n.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="sb-foot">
        <Av name={ORION_DATA.users[role].name} color={ORION_DATA.users[role].color}/>
        <div style={{ minWidth: 0, flex: 1 }} className="sb-foot-meta">
          <div className="sb-foot-name">{ORION_DATA.users[role].name}</div>
          <div className="sb-foot-role">{ORION_DATA.users[role].role}</div>
        </div>
        <button className="sb-bell" title="Notificações" onClick={(e) => { e.stopPropagation(); }}>
          <Icon name="bell" size={15}/>
          <span className="sb-bell-badge">3</span>
        </button>
      </div>
    </aside>

    {sw && (
      <>
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={() => setSw(false)}/>
        <div className="sw-pop" style={{ left: 12, top: 56 }} onClick={e => e.stopPropagation()}>
          <div className="sw-sect">Empresa</div>
          <div className="sw-item" style={{ cursor: 'default' }}>
            <CoMark name={companyName || 'A'} ac={accent}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sw-item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{companyName}</div>
              <div className="sw-item-sub">Sua conta de confecção</div>
            </div>
            <Icon name="check" size={15} style={{ color: 'var(--accent)' }}/>
          </div>
          {SIBLING_COS.map(c => (
            <div key={c.name} className="sw-item" onClick={() => { setSw(false); alert('Trocar para ' + c.name + ' — protótipo'); }}>
              <CoMark name={c.name} ac={c.accent} size={28}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sw-item-name">{c.name}</div>
                <div className="sw-item-sub">{c.city}</div>
              </div>
            </div>
          ))}

          {isAdmin && (
            <>
              <div className="sw-div"/>
              <div className="sw-sect">Plataforma</div>
              <div className="sw-app" onClick={() => { window.location.href = 'Orion Backoffice.html'; }}>
                <span className="sb-brand-mark" style={{ width: 30, height: 30, fontSize: 14, background: 'linear-gradient(150deg,#c2473b,#a83227)' }}>
                  <Icon name="orbit" size={15} strokeWidth={2} style={{ color: '#fff' }}/>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sw-item-name">Orion Console</div>
                  <div className="sw-item-sub">Administração da plataforma</div>
                </div>
                <Icon name="arrow-up-right" size={15} style={{ color: 'var(--accent)' }}/>
              </div>
            </>
          )}
        </div>
      </>
    )}
    </>
  );
};

const Topbar = ({ onBurger, companyName, role, setRoute }) => {
  const u = ORION_DATA.users[role];
  const latest = window.ORION_LATEST_RELEASE;
  const [unseen, setUnseen] = React.useState(false);
  React.useEffect(() => {
    if (!latest) return;
    try { setUnseen(localStorage.getItem('orion.seenRelease') !== latest.id); } catch (e) { setUnseen(true); }
  }, [latest]);
  return (
    <header className="topbar">
      <button className="tb-burger" onClick={onBurger}><Icon name="menu" size={18}/></button>
      <div className="tb-search" onClick={() => alert('Paleta de comandos — protótipo')}>
        <Icon name="search" size={14}/>
        <span>O que vamos fazer agora?</span>
        <kbd>⌘K</kbd>
      </div>
      <div className="tb-spacer"/>
      <a className="tb-news" href="Novidades.html" title="Novidades do Orion"
         onClick={() => { try { latest && localStorage.setItem('orion.seenRelease', latest.id); } catch (e) {} }}>
        <Icon name="sparkles" size={15}/>
        <span>Novidades</span>
        {unseen && <span className="tb-news-dot"/>}
      </a>
    </header>
  );
};

Object.assign(window, { Sidebar, Topbar, NAV });
