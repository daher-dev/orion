// Sidebar + Topbar — depends on Icon, SUBS, ORION_DATA

const NAV = [
  { id: 'dashboard', label: 'Início' },
  { sect: 'Vendas', items: [
    { id: 'orders', label: 'Pedidos', count: 47 },
    { id: 'clients', label: 'Clientes' },
    { id: 'ads', label: 'Anúncios' },
  ]},
  { sect: 'Catálogo', items: [
    { id: 'products', label: 'Produtos' },
    { id: 'specs', label: 'Fichas técnicas' },
    { id: 'prints', label: 'Estampas' },
  ]},
  { sect: 'Produção', items: [
    { id: 'cutting', label: 'Corte', count: 8 },
    { id: 'sewing', label: 'Costura', count: 14 },
    { id: 'contractors', label: 'Bancas' },
  ]},
  { sect: 'Estoque', items: [
    { id: 'fabric', label: 'Tecidos' },
    { id: 'stock', label: 'Estoque', count: 6 },
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

const Sidebar = ({ route, setRoute, role, accent, companyName }) => {
  const hidden = ROLE_HIDE[role] || new Set();
  const isItemVisible = (id) => !hidden.has(id);
  return (
    <aside className="sidebar">
      <div className="sb-brand sb-co-picker" onClick={() => alert('Trocar de empresa — protótipo')}>
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
  );
};

const Topbar = ({ onBurger, companyName, role, setRoute }) => {
  const u = ORION_DATA.users[role];
  return (
    <header className="topbar">
      <button className="tb-burger" onClick={onBurger}><Icon name="menu" size={18}/></button>
      <div className="tb-search" onClick={() => alert('Paleta de comandos — protótipo')}>
        <Icon name="search" size={14}/>
        <span>O que vamos fazer agora?</span>
        <kbd>⌘K</kbd>
      </div>
      <div className="tb-spacer"/>
    </header>
  );
};

Object.assign(window, { Sidebar, Topbar, NAV });
