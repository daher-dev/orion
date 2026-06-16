// Main Orion app — depends on all pages, sidebar, topbar, tweaks-panel

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2563eb",
  "companyName": "Underground",
  "role": "manager",
  "collapsed": false
}/*EDITMODE-END*/;

const ROUTES = {
  dashboard: 'Dashboard',
  orders: 'Pedidos', clients: 'Clients', ads: 'Ads',
  products: 'Products', specs: 'Specs', prints: 'Prints',
  planejamento: 'Planejamento',
  cutting: 'Cutting', sewing: 'Sewing', contractors: 'Contractors',
  printing: 'Printing', montagem: 'Montagem',
  fabric: 'Fabric', blanks: 'BlankPieces', paper: 'PaperRolls', printed: 'Printed', stock: 'Stock',
  reports: 'Reports', settings: 'Settings',
};

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState('dashboard');
  const [collapsed, setCollapsed] = React.useState(false);

  // Entered from the Console via "Entrar como" — show a clear banner.
  const impersonating = React.useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('impersonate'); } catch (e) { return null; }
  }, []);
  const companyName = impersonating || tweaks.companyName;

  // Apply accent
  React.useEffect(() => {
    document.documentElement.style.setProperty('--accent', tweaks.accent);
  }, [tweaks.accent]);

  // Bounce role to a safe route if hidden
  React.useEffect(() => {
    const hidden = (window.ROLE_HIDE && window.ROLE_HIDE[tweaks.role]) || new Set();
    // operator can't see orders/clients/ads/contractors/reports
    if (tweaks.role === 'operator' && ['orders','clients','ads','contractors','reports'].includes(route)) {
      setRoute('dashboard');
    }
  }, [tweaks.role]);

  const PageEl = window[ROUTES[route]] || window.Dashboard;

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <Sidebar route={route} setRoute={setRoute} role={tweaks.role}
               accent={tweaks.accent} companyName={companyName}/>
      <Topbar onBurger={() => setCollapsed(c => !c)}
              companyName={companyName}
              role={tweaks.role}
              setRoute={setRoute}/>
      <main className="main" data-screen-label={route}>
        {impersonating && (
          <div className="imp-banner">
            <Icon name="orbit" size={15}/>
            <span>Você está dentro de <b>{impersonating}</b> como equipe Orion — sessão de suporte.</span>
            <span className="imp-spacer"/>
            <a href="Orion Backoffice.html"><Icon name="arrow-left" size={13}/> Sair e voltar ao Console</a>
          </div>
        )}
        <PageEl role={tweaks.role} setRoute={setRoute} tweaks={tweaks} setTweak={setTweak}/>
      </main>

      <TweaksPanel>
        <TweakSection label="Marca"/>
        <TweakText label="Nome da empresa"
                   value={tweaks.companyName}
                   onChange={v => setTweak('companyName', v)}/>
        <TweakColor label="Cor de destaque"
                    value={tweaks.accent}
                    options={['#2563eb','#c2410c','#0f766e','#7e5bef','#b45309','#1f1b15']}
                    onChange={v => setTweak('accent', v)}/>
        <TweakSection label="Persona"/>
        <TweakRadio label="Função"
                    value={tweaks.role}
                    options={[
                      { value: 'admin',    label: 'Admin' },
                      { value: 'manager',  label: 'Gestor' },
                      { value: 'operator', label: 'Operador' },
                    ]}
                    onChange={v => setTweak('role', v)}/>
        <div style={{ fontSize: 10.5, color: 'rgba(41,38,27,.55)', marginTop: 8, lineHeight: 1.4 }}>
          Cada empresa personaliza nome e cor — exibimos como “{tweaks.companyName} <b>por Orion</b>”.
        </div>
      </TweaksPanel>
      <StockToaster/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

// Global stock toaster — surfaces ledger changes triggered from any feature
function StockToaster() {
  const [msg, setMsg] = React.useState(null);
  React.useEffect(() => window.StockStore.subscribeToast(setMsg), []);
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--ink-inv)',
      padding: '11px 17px', borderRadius: 10, fontSize: 13, boxShadow: 'var(--shadow-lg)', zIndex: 3000, display: 'flex', alignItems: 'center', gap: 9, maxWidth: '90vw' }}>
      <Icon name="arrow-down-up" size={16} style={{ color: '#7ee0a5' }}/> {msg}
    </div>
  );
}
window.StockToaster = StockToaster;
