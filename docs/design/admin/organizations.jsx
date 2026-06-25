// Orion Console — Organizations list. Renders the table; detail lives in org-detail.jsx.
// Depends on: ConsoleHead, Card, OrgMark, PlanTag, OrgStatus, Select, Seg, CONSOLE, OrgDetail.

const goImpersonate = (org) => { window.location.href = 'Orion.html?impersonate=' + encodeURIComponent(org.name); };
window.goImpersonate = goImpersonate;

const UsageBar = ({ value, cap, unit }) => {
  if (cap >= 999999) return <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtInt(value)} <span style={{ opacity: .7 }}>· ilimitado</span></span>;
  const pct = Math.min(100, (value / cap) * 100);
  const lvl = pct >= 100 ? 'err' : pct >= 80 ? 'warn' : '';
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
        {fmtInt(value)} <span style={{ color: 'var(--ink-3)' }}>/ {fmtInt(cap)}{unit ? ' ' + unit : ''}</span>
      </div>
      <div className="meter"><span className={lvl} style={{ width: pct + '%' }}/></div>
    </div>
  );
};
window.UsageBar = UsageBar;

const OrgsList = ({ openOrg }) => {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('todas');
  const [plan, setPlan] = React.useState('todos');
  const [sort, setSort] = React.useState({ col: 'mrr', dir: 'desc' });
  const [newOrg, setNewOrg] = React.useState(false);

  let rows = CONSOLE.orgs.filter(o => {
    if (status !== 'todas' && o.status !== status) return false;
    if (plan !== 'todos' && o.plan !== plan) return false;
    if (q) {
      const hay = (o.name + ' ' + o.city + ' ' + o.owner.name + ' ' + o.owner.email).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  const getters = {
    name: o => o.name, plan: o => CONSOLE.planById(o.plan).price, status: o => o.status,
    members: o => o.members, orders: o => o.ordersMo, mrr: o => o.mrr,
  };
  rows = [...rows].sort(makeCmp(sort, getters));

  const counts = {
    todas: CONSOLE.orgs.length,
    ativa: CONSOLE.orgs.filter(o => o.status === 'ativa').length,
    trial: CONSOLE.orgs.filter(o => o.status === 'trial').length,
    inadimplente: CONSOLE.orgs.filter(o => o.status === 'inadimplente').length,
    pausada: CONSOLE.orgs.filter(o => o.status === 'pausada').length,
  };

  return (
    <div className="page">
      <ConsoleHead icon="building-2" color="#a83227" eyebrow="Plataforma" title="Organizações"
        desc="Cada cliente Orion é uma organização. Gerencie plano, equipe, uso e cobrança."
        actions={<>
          <button className="btn"><Icon name="download" size={13}/> Exportar</button>
          <button className="btn btn-primary" onClick={() => setNewOrg(true)}><Icon name="building-2" size={13}/> Nova organização</button>
        </>}/>

      <div className="card" style={{ overflow: 'visible' }}>
        <div className="toolbar" style={{ overflow: 'visible' }}>
          <div className="tb-input" style={{ minWidth: 240 }}>
            <Icon name="search" size={13}/>
            <input placeholder="Buscar por nome, cidade ou titular…" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="seg">
            {[['todas','Todas'],['ativa','Ativas'],['trial','Trial'],['inadimplente','Inadimplentes'],['pausada','Pausadas']].map(([v, l]) => (
              <button key={v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>
                {l} <span style={{ opacity: .55, fontVariantNumeric: 'tabular-nums' }}>{counts[v]}</span>
              </button>
            ))}
          </div>
          <div style={{ width: 160, marginLeft: 'auto' }}>
            <Select value={plan} onChange={setPlan} searchable={false}
              options={[{ value: 'todos', label: 'Todos os planos' }, ...CONSOLE.plans.map(p => ({ value: p.id, label: p.name }))]}/>
          </div>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <SortHeader id="name" sort={sort} setSort={setSort}>Organização</SortHeader>
              <SortHeader id="plan" sort={sort} setSort={setSort}>Plano</SortHeader>
              <th>Status</th>
              <SortHeader id="members" sort={sort} setSort={setSort}>Equipe</SortHeader>
              <SortHeader id="orders" sort={sort} setSort={setSort}>Pedidos/mês</SortHeader>
              <SortHeader id="mrr" sort={sort} setSort={setSort} num>MRR</SortHeader>
              <th>Atividade</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(o => (
              <tr key={o.id} onClick={() => openOrg(o.id)} style={{ cursor: 'default' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <OrgMark org={o} size={34}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap' }}>{o.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{o.city}</div>
                    </div>
                  </div>
                </td>
                <td><PlanTag id={o.plan}/></td>
                <td><OrgStatus s={o.status}/></td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {o.members}<span style={{ color: 'var(--ink-3)' }}>/{o.seats >= 999 ? '∞' : o.seats}</span>
                </td>
                <td><UsageBar value={o.ordersMo} cap={o.ordersCap}/></td>
                <td className="num" style={{ color: o.mrr ? 'var(--ink)' : 'var(--ink-3)', fontWeight: o.mrr ? 600 : 400 }}>
                  {o.mrr ? fmtBRL(o.mrr) : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{o.lastActive}</td>
                <td className="num">
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); goImpersonate(o); }} title={`Entrar como ${o.name}`}>
                    <Icon name="log-in" size={12}/> Entrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon="search-x" title="Nenhuma organização" desc="Ajuste a busca ou os filtros acima."/>}
      </div>

      <NewOrgSheet open={newOrg} onClose={() => setNewOrg(false)}/>
    </div>
  );
};

// ───────── New organization drawer ─────────
const NewOrgSheet = ({ open, onClose }) => {
  const [name, setName] = React.useState('');
  const [city, setCity] = React.useState('');
  const [ownerName, setOwnerName] = React.useState('');
  const [ownerEmail, setOwnerEmail] = React.useState('');
  const [plan, setPlan] = React.useState('atelie');
  const [trial, setTrial] = React.useState(true);
  const [accent, setAccent] = React.useState('#a83227');

  React.useEffect(() => { if (open) { setName(''); setCity(''); setOwnerName(''); setOwnerEmail(''); setPlan('atelie'); setTrial(true); setAccent('#a83227'); } }, [open]);

  const ACCENTS = ['#a83227', '#0f766e', '#c2410c', '#7e5bef', '#be123c', '#15803d', '#9333ea', '#ca8a04'];
  const ini = (name || 'Nv').split(/\s+/).filter(w => w.length > 1 || /\d/.test(w)).map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'NV';
  const p = CONSOLE.planById(plan);
  const valid = name.trim() && ownerEmail.trim();

  return (
    <Sheet open={open} onClose={onClose} title="Nova organização"
      sub="Crie um workspace e convide o titular para assumir a conta."
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!valid} style={!valid ? { opacity: .5, pointerEvents: 'none' } : null} onClick={onClose}>
          <Icon name="building-2" size={13}/> Criar organização
        </button>
      </>}>
      {/* Live preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)', marginBottom: 20 }}>
        <span className="org-mark" style={{ background: accent, width: 42, height: 42, fontSize: 17, borderRadius: 11 }}>{ini}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: name ? 'var(--ink)' : 'var(--ink-3)', fontWeight: 500 }}>{name || 'Nome da organização'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="orbit" size={10}/> por Orion · {city || 'cidade'}
          </div>
        </div>
      </div>

      <div className="row-div" style={{ marginBottom: 14 }}><span style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>Organização</span><span className="ln"/></div>
      <div className="field">
        <label>Nome da organização</label>
        <input placeholder="Ex.: Ateliê Boa Vista" value={name} onChange={e => setName(e.target.value)}/>
      </div>
      <div className="field">
        <label>Cidade</label>
        <input placeholder="Cidade, UF" value={city} onChange={e => setCity(e.target.value)}/>
      </div>
      <div className="field">
        <label>Cor da marca</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCENTS.map(c => (
            <button key={c} onClick={() => setAccent(c)} style={{
              width: 30, height: 30, borderRadius: 8, background: c, cursor: 'default',
              border: accent === c ? '2px solid var(--ink)' : '2px solid transparent',
              boxShadow: accent === c ? '0 0 0 2px var(--surface) inset' : 'inset 0 0 0 1px rgba(0,0,0,.1)',
            }}/>
          ))}
        </div>
      </div>

      <div className="row-div" style={{ margin: '22px 0 14px' }}><span style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>Titular</span><span className="ln"/></div>
      <div className="field">
        <label>Nome do titular</label>
        <input placeholder="Quem vai administrar a conta" value={ownerName} onChange={e => setOwnerName(e.target.value)}/>
      </div>
      <div className="field">
        <label>E-mail do titular</label>
        <input type="email" placeholder="titular@empresa.com" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)}/>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>Enviaremos um convite para definir a senha e assumir o workspace.</div>
      </div>

      <div className="row-div" style={{ margin: '22px 0 14px' }}><span style={{ fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 700 }}>Plano</span><span className="ln"/></div>
      <div style={{ display: 'grid', gap: 8 }}>
        {CONSOLE.plans.map(pl => {
          const on = plan === pl.id;
          return (
            <div key={pl.id} onClick={() => setPlan(pl.id)} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', cursor: 'default',
              border: `1px solid ${on ? pl.color : 'var(--line)'}`, borderRadius: 10,
              background: on ? `color-mix(in oklab, ${pl.color} 8%, var(--surface))` : 'var(--surface)',
            }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${on ? pl.color : 'var(--line)'}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                {on && <span style={{ width: 8, height: 8, borderRadius: 999, background: pl.color }}/>}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{pl.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{pl.tagline}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {pl.price === 0 ? 'Grátis' : fmtBRL(pl.price)}<span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>{pl.price ? '/mês' : ''}</span>
              </div>
            </div>
          );
        })}
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, cursor: 'default', fontSize: 13, color: 'var(--ink-2)' }}>
        <input type="checkbox" checked={trial} onChange={e => setTrial(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}/>
        Iniciar com <b>14 dias de trial</b>{p && p.price > 0 ? ` do plano ${p.name}` : ''} antes da primeira cobrança
      </label>
    </Sheet>
  );
};

// Container: switches between list and detail
const Organizations = ({ orgId, openOrg, closeOrg }) => {
  const org = orgId ? CONSOLE.orgById(orgId) : null;
  if (org) return <OrgDetail org={org} onBack={closeOrg}/>;
  return <OrgsList openOrg={openOrg}/>;
};

window.Organizations = Organizations;
