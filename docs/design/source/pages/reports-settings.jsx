// Reports + Settings pages

const Reports = () => {
  const [tab, setTab] = React.useState('sales');
  return (
    <div className="page">
      <PageHead sub="reports" title="Relatórios" titleEm="& análises"
                desc="Cruze dados de vendas, produção, estoque e custos."
                actions={<>
                  <button className="btn"><Icon name="calendar" size={14}/> Últimos 90 dias</button>
                  <button className="btn"><Icon name="download" size={14}/> Exportar CSV</button>
                </>}/>
      <div style={{ marginBottom: 16 }}>
        <Seg value={tab} onChange={setTab} options={[
          {value:'sales',label:'Vendas'},{value:'production',label:'Produção'},
          {value:'inventory',label:'Estoque'},{value:'costs',label:'Custos'},
        ]}/>
      </div>

      {tab === 'sales' && <SalesReport/>}
      {tab === 'production' && <ProductionReport/>}
      {tab === 'inventory' && <InventoryReport/>}
      {tab === 'costs' && <CostsReport/>}
    </div>
  );
};

const SalesReport = () => (
  <div style={{ display: 'grid', gap: 18 }}>
    <div className="grid g-cols-4">
      {[
        { l: 'Receita 90d', v: 'R$ 524.180', d: '+22%' },
        { l: 'Pedidos', v: '892', d: '+18%' },
        { l: 'Ticket médio', v: 'R$ 587', d: '+4%' },
        { l: 'Margem média', v: '38,4%', d: '+1,2pp' },
      ].map((k, i) => (
        <div key={i} className="kpi">
          <span className="kpi-label">{k.l}</span>
          <div className="kpi-value">{k.v}</div>
          <span className="kpi-delta up"><Icon name="trending-up" size={11} strokeWidth={2.5}/>{k.d}</span>
        </div>
      ))}
    </div>
    <Card title="Receita por mês"><RevenueChart/></Card>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <Card title="Top produtos">
        {ORION_DATA.products.slice(0,5).map((p, i) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i === 4 ? 0 : '1px solid var(--line-soft)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-3)', width: 22 }}>{i+1}</span>
            <FabricThumb tone={p.thumb} size={32}/>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.code}</div>
            </div>
            <div className="num" style={{ fontWeight: 500 }}>{fmtBRL([42_180, 31_240, 24_500, 18_900, 12_400][i])}</div>
          </div>
        ))}
      </Card>
      <Card title="Top clientes">
        {ORION_DATA.clients.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i === 4 ? 0 : '1px solid var(--line-soft)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-3)', width: 22 }}>{i+1}</span>
            <Av name={c.name} color={['#c2410c','#0f766e','#7e5bef','#1e40af','#b45309'][i]}/>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{c.orders} pedidos</div>
            </div>
            <div className="num" style={{ fontWeight: 500 }}>{fmtBRL(c.lifetime)}</div>
          </div>
        ))}
      </Card>
    </div>
  </div>
);

const RevenueChart = () => {
  const data = [82, 95, 110, 88, 132, 145, 138, 160, 175, 168, 184, 210];
  const months = ['Jun','Jul','Ago','Set','Out','Nov','Dez','Jan','Fev','Mar','Abr','Mai'];
  const max = Math.max(...data);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 8, alignItems: 'end', height: 200 }}>
        {data.map((v, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{v}</div>
            <div style={{ width: '100%', height: `${(v/max) * 170}px`, background: `linear-gradient(180deg, var(--accent) 0%, color-mix(in oklab, var(--accent) 70%, transparent) 100%)`, borderRadius: '4px 4px 0 0' }}/>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{months[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProductionReport = () => (
  <div className="grid g-cols-2">
    <Card title="Throughput semanal"><RevenueChart/></Card>
    <Card title="On-time por banca">
      {ORION_DATA.bancas.map(b => (
        <div key={b.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--ink)' }}>{b.name}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{b.ontime}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${b.ontime}%`, height: '100%', background: b.ontime >= 90 ? 'var(--ok)' : b.ontime >= 80 ? 'var(--warn)' : 'var(--err)' }}/>
          </div>
        </div>
      ))}
    </Card>
  </div>
);

const InventoryReport = () => (
  <Card title="Valor de estoque ao longo do tempo"><RevenueChart/></Card>
);

const CostsReport = () => (
  <Card title="Custo unitário por produto">
    <table className="tbl">
      <thead><tr><th>Produto</th><th className="num">CMT</th><th className="num">Estampa</th><th className="num">Custo total</th><th className="num">Preço</th><th className="num">Margem</th></tr></thead>
      <tbody>
        {ORION_DATA.products.map((p, i) => {
          const spec = ORION_DATA.specs.find(s => s.id === p.spec);
          const print = ORION_DATA.prints.find(pr => pr.id === p.print);
          const total = (spec?.cmt || 0) + (print?.cost || 0);
          const price = [99.00, 249.90, 179.00, 79.00, 59.00][i];
          const margin = ((price - total) / price * 100).toFixed(1);
          return (
            <tr key={p.id}>
              <td style={{color:'var(--ink)',fontWeight:500}}>{p.name}</td>
              <td className="num">{fmtBRL(spec?.cmt || 0)}</td>
              <td className="num">{fmtBRL(print?.cost || 0)}</td>
              <td className="num">{fmtBRL(total)}</td>
              <td className="num">{fmtBRL(price)}</td>
              <td className="num"><span className="pill ok">{margin}%</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </Card>
);

// ───────── Settings ─────────
const Settings = ({ tweaks, setTweak }) => {
  const [pane, setPane] = React.useState('company');
  const panes = [
    { id: 'company', label: 'Empresa', icon: 'building-2' },
    { id: 'members', label: 'Membros', icon: 'users' },
    { id: 'roles', label: 'Funções', icon: 'shield' },
    { id: 'billing', label: 'Cobrança', icon: 'credit-card' },
    { id: 'audit', label: 'Auditoria', icon: 'history' },
    { id: 'integrations', label: 'Integrações', icon: 'plug' },
    { id: 'profile', label: 'Perfil', icon: 'user' },
    { id: 'notifications', label: 'Notificações', icon: 'bell' },
  ];
  return (
    <div className="page">
      <PageHead sub="settings" title="Ajustes" desc="Configure sua conta, equipe e integrações."/>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 18 }}>
        <div>
          {panes.map(p => (
            <div key={p.id} onClick={() => setPane(p.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13.5,
              color: pane === p.id ? 'var(--ink)' : 'var(--ink-2)',
              background: pane === p.id ? 'var(--surface)' : 'transparent',
              border: pane === p.id ? '1px solid var(--line)' : '1px solid transparent',
              marginBottom: 2,
            }}>
              <Icon name={p.icon} size={15}/>
              {p.label}
            </div>
          ))}
        </div>
        <div>
          {pane === 'company' && <CompanyPane tweaks={tweaks} setTweak={setTweak}/>}
          {pane === 'members' && <MembersPane/>}
          {pane === 'audit' && <AuditPane/>}
          {pane !== 'company' && pane !== 'members' && pane !== 'audit' && (
            <Card title={panes.find(p => p.id === pane).label}>
              <Empty title="Em construção" desc="Esta seção será lançada nas próximas semanas." icon="construction"/>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const CompanyPane = ({ tweaks, setTweak }) => (
  <div style={{ display: 'grid', gap: 18 }}>
    <Card title="Identidade da empresa" sub="Como sua empresa aparece para a equipe e em documentos.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="field">
          <label>Nome da empresa</label>
          <input value={tweaks.companyName} onChange={e => setTweak('companyName', e.target.value)}/>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Será exibido como <b>“{tweaks.companyName} por Orion”</b>.</div>
        </div>
        <div className="field">
          <label>Localidade padrão</label>
          <select><option>Português (Brasil)</option><option>English</option></select>
        </div>
      </div>
      <div className="field">
        <label>Cor de destaque</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['#2563eb','#c2410c','#0f766e','#7e5bef','#b45309','#1f1b15'].map(c => (
            <button key={c} onClick={() => setTweak('accent', c)} style={{
              width: 36, height: 36, borderRadius: 8, background: c, border: 0,
              boxShadow: tweaks.accent === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : 'none',
            }}/>
          ))}
        </div>
      </div>
    </Card>
  </div>
);

const MembersPane = () => (
  <Card title="Membros" sub={`${ORION_DATA.members.length} pessoas`}
        action={<button className="btn btn-primary"><Icon name="plus" size={13}/> Convidar</button>} pad={false}>
    <table className="tbl">
      <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Status</th><th>Visto por último</th></tr></thead>
      <tbody>
        {ORION_DATA.members.map(m => (
          <tr key={m.email}>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Av name={m.name} color="#1f1b15"/>
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{m.name}</span>
              </div>
            </td>
            <td className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.email}</td>
            <td>{m.role}</td>
            <td><StatusPill s={m.status}/></td>
            <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.lastSeen}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);

const AuditPane = () => (
  <Card title="Log de auditoria" sub="Últimos eventos no sistema" pad={false}>
    <table className="tbl">
      <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>Detalhe</th></tr></thead>
      <tbody>
        {ORION_DATA.audit.map((e, i) => (
          <tr key={i}>
            <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e.when}</td>
            <td>{e.who}</td>
            <td className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.action}</td>
            <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{e.target}</td>
            <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{e.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);

Object.assign(window, { Reports, Settings });
