// Orion Console — app shell, routing, app-switcher, tweaks.
// Depends on: ConsoleSidebar, ConsoleTopbar, AppSwitcher, Overview, Organizations,
// Users, Plans, Integrations, TweaksPanel + helpers.

const CONSOLE_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#a83227",
  "density": "regular"
}/*EDITMODE-END*/;

function ConsoleApp() {
  const [tweaks, setTweak] = useTweaks(CONSOLE_DEFAULTS);
  const [route, setRoute] = React.useState('overview');
  const [orgId, setOrgId] = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(false);
  const [picker, setPicker] = React.useState(false);

  // Navigate via sidebar — clears any open org detail
  const navigate = (id) => { setOrgId(null); setRoute(id); };
  // Jump straight into an org's detail
  const openOrg = (id) => { setOrgId(id); setRoute('orgs'); };
  const closeOrg = () => setOrgId(null);

  let Page;
  if (route === 'overview')      Page = <Overview setRoute={navigate} openOrg={openOrg}/>;
  else if (route === 'orgs')     Page = <Organizations orgId={orgId} openOrg={openOrg} closeOrg={closeOrg}/>;
  else if (route === 'users')    Page = <Users openOrg={openOrg}/>;
  else if (route === 'plans')    Page = <Plans setRoute={navigate}/>;
  else if (route === 'integrations') Page = <Integrations/>;
  else Page = <Overview setRoute={navigate} openOrg={openOrg}/>;

  return (
    <div className={`app console ${collapsed ? 'collapsed' : ''} ${tweaks.density === 'compact' ? 'dense' : ''}`}
         style={{ '--accent': tweaks.accent }}>
      <ConsoleSidebar route={route} setRoute={navigate} onPicker={() => setPicker(p => !p)}/>
      <ConsoleTopbar onBurger={() => setCollapsed(c => !c)}/>
      <main className="main" data-screen-label={route === 'orgs' && orgId ? 'org-detail' : route}>
        {Page}
      </main>

      {picker && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={() => setPicker(false)}/>
          <AppSwitcher onClose={() => setPicker(false)}/>
        </>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Console"/>
        <TweakColor label="Cor do console" value={tweaks.accent}
          options={['#a83227', '#c2410c', '#b45309', '#7e5bef']}
          onChange={v => setTweak('accent', v)}/>
        <TweakRadio label="Densidade" value={tweaks.density}
          options={[{ value: 'compact', label: 'Compacta' }, { value: 'regular', label: 'Padrão' }]}
          onChange={v => setTweak('density', v)}/>
        <div style={{ fontSize: 10.5, color: 'rgba(41,38,27,.55)', marginTop: 8, lineHeight: 1.4 }}>
          O console é a administração da plataforma — a barra lateral escura e a etiqueta "Console" deixam claro que você não está na sua conta.
        </div>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ConsoleApp/>);
