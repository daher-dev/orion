// Main Orion app — depends on all pages, sidebar, topbar, tweaks-panel

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2563eb",
  "companyName": "Underground",
  "role": "manager",
  "collapsed": false
}/*EDITMODE-END*/;

const ROUTES = {
  dashboard: 'Dashboard',
  orders: 'Orders', clients: 'Clients', ads: 'Ads',
  products: 'Products', specs: 'Specs', prints: 'Prints',
  cutting: 'Cutting', sewing: 'Sewing', contractors: 'Contractors',
  fabric: 'Fabric', stock: 'Stock',
  reports: 'Reports', settings: 'Settings',
};

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState('dashboard');
  const [collapsed, setCollapsed] = React.useState(false);

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
               accent={tweaks.accent} companyName={tweaks.companyName}/>
      <Topbar onBurger={() => setCollapsed(c => !c)}
              companyName={tweaks.companyName}
              role={tweaks.role}
              setRoute={setRoute}/>
      <main className="main" data-screen-label={route}>
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
