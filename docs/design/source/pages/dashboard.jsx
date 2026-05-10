// Dashboard page

const KPI = ({ data, color }) => (
  <div className="kpi">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="kpi-label">{data.label}</span>
      <span className={`kpi-delta ${data.delta > 0 ? 'up' : 'down'}`}>
        <Icon name={data.delta > 0 ? 'trending-up' : 'trending-down'} size={11} strokeWidth={2.5}/>
        {data.delta > 0 ? '+' : ''}{data.delta.toFixed(1)}%
      </span>
    </div>
    <div className="kpi-value">{typeof data.value === 'number' ? fmtInt(data.value) : data.value}</div>
    <div style={{ color, marginTop: 4 }}>
      <Spark data={data.spark} color={color}/>
    </div>
  </div>
);

const Dashboard = ({ role, setRoute }) => {
  const u = ORION_DATA.users[role];
  const k = ORION_DATA.kpis;
  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (role === 'operator') return <OperatorDashboard setRoute={setRoute}/>;

  return (
    <div className="page">
      <PageHead
        sub="dashboard"
        title={`${greet()},`}
        titleEm={u.name.split(' ')[0]}
        desc="Aqui está o panorama da sua operação hoje, 7 de maio."
        actions={<>
          <button className="btn"><Icon name="calendar" size={14}/> Últimos 30 dias</button>
          <button className="btn btn-primary"><Icon name="shopping-bag" size={14}/> Novo pedido</button>
        </>}
      />

      <div className="grid g-cols-5" style={{ marginBottom: 18 }}>
        <KPI data={k.pendingOrders}     color="var(--brand-sales)"/>
        <KPI data={k.cuttingInProgress} color="var(--brand-prod)"/>
        <KPI data={k.sewingOut}         color="var(--brand-prod)"/>
        <KPI data={k.lowStock}          color="var(--brand-inv)"/>
        <KPI data={k.revenue30d}        color="var(--accent)"/>
      </div>

      {/* Production pipeline — distinctive moment */}
      <Card title="Pipeline de produção" sub="Onde estão suas peças neste momento"
            action={<button className="btn btn-sm">Ver detalhes <Icon name="arrow-right" size={12}/></button>}
            pad={false}>
        <div style={{ padding: 18 }}>
          <div className="pipe">
            {ORION_DATA.pipeline.map((s, i) => (
              <div key={i} className="pipe-stage" style={{ '--stage-color': s.color }}>
                <div className="pipe-stage-head">
                  <div className="pipe-stage-name">{s.stage}</div>
                  <Icon name={["shopping-bag","scissors","send","boxes","truck"][i]} size={14}/>
                </div>
                <div className="pipe-stage-count">{s.count}</div>
                <div className="pipe-stage-sub">{s.short}</div>
              </div>
            ))}
          </div>
          {/* Conveyor flow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, color: 'var(--ink-3)', fontSize: 11 }}>
            <Icon name="git-branch" size={12}/>
            <span>Em média uma peça leva <b style={{ color: 'var(--ink)' }}>7,2 dias</b> para sair como pedido entregue.</span>
            <span style={{ marginLeft: 'auto' }}>Atualizado há 3 min</span>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
        <Card title="Precisa da sua atenção" sub="4 pendências"
              action={<button className="btn btn-sm btn-ghost">Ver todas</button>} pad={false}>
          <div style={{ padding: '4px 0' }}>
            {ORION_DATA.needsAction.map((a, i) => {
              const sub = SUBS[a.to];
              return (
                <div key={i} onClick={() => setRoute(a.to)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px', borderBottom: i === 3 ? 0 : '1px solid var(--line-soft)',
                  cursor: 'default',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: `color-mix(in oklab, ${sub.color} 14%, var(--surface))`,
                    color: sub.color, display: 'grid', placeItems: 'center',
                  }}>
                    <Icon name={sub.icon} size={15}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--ink)', fontSize: 13.5 }}>{a.text}</div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 11.5, marginTop: 2 }}>{a.since}</div>
                  </div>
                  <Icon name="arrow-right" size={14} style={{ color: 'var(--ink-3)' }}/>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Atividade recente" sub="Últimas 6 ações"
              action={<button className="btn btn-sm btn-ghost">Auditoria <Icon name="arrow-right" size={12}/></button>} pad={false}>
          <div style={{ padding: '4px 0' }}>
            {ORION_DATA.activity.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 18px', borderBottom: i === 5 ? 0 : '1px solid var(--line-soft)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)', marginTop: 7 }}/>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{a.who}</span>{' '}
                  <span style={{ color: 'var(--ink-3)' }}>{a.what}</span>{' '}
                  <span style={{ color: 'var(--ink)' }}>{a.target}</span>
                  {a.verb && <span style={{ color: 'var(--ink-3)' }}> {a.verb}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{a.when}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card title="Receita por canal" sub="Últimos 30 dias">
          <ChannelBars/>
        </Card>
      </div>
    </div>
  );
};

const OperatorDashboard = ({ setRoute }) => (
  <div className="page">
    <PageHead sub="dashboard" title="Bom dia," titleEm="Joana"
              desc="Suas tarefas para hoje na fábrica."/>
    <div className="grid g-cols-3" style={{ marginBottom: 18 }}>
      <div className="kpi">
        <span className="kpi-label">Cortes na sua fila</span>
        <div className="kpi-value">3</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>2 pendentes · 1 em andamento</div>
      </div>
      <div className="kpi">
        <span className="kpi-label">Remessas chegando hoje</span>
        <div className="kpi-value">2</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>SW-121 · SW-118</div>
      </div>
      <div className="kpi">
        <span className="kpi-label">Peças produzidas hoje</span>
        <div className="kpi-value">86</div>
        <div style={{ fontSize: 12, color: 'var(--ok)' }}><Icon name="trending-up" size={12}/> +12 vs ontem</div>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <Card title="Cortes esperando você">
        {ORION_DATA.cutting.filter(c => c.status === 'pendente' || c.status === 'cortando').slice(0,3).map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{c.code}</span>
            <span style={{ flex: 1 }}>{c.product}</span>
            <StatusPill s={c.status}/>
            <button className="btn btn-sm">Abrir <Icon name="arrow-right" size={11}/></button>
          </div>
        ))}
      </Card>
      <Card title="Ações rápidas">
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn" onClick={() => setRoute('cutting')}><Icon name="scissors" size={14}/> Registrar saída de corte</button>
          <button className="btn" onClick={() => setRoute('sewing')}><Icon name="package-check" size={14}/> Receber remessa de banca</button>
          <button className="btn" onClick={() => setRoute('stock')}><Icon name="boxes" size={14}/> Ajustar estoque</button>
        </div>
      </Card>
    </div>
  </div>
);

// Decorative bar chart for revenue by channel
const ChannelBars = () => {
  const data = [
    { ch: 'shopee', value: 68 },
    { ch: 'ml', value: 52 },
    { ch: 'shopify', value: 41 },
    { ch: 'instagram', value: 28 },
    { ch: 'whatsapp', value: 18 },
  ];
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {data.map(d => {
        const ch = ORION_DATA.channels[d.ch];
        return (
          <div key={d.ch} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 80px', alignItems: 'center', gap: 12 }}>
            <ChannelChip id={d.ch}/>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--bg)', overflow: 'hidden' }}>
              <div style={{ width: `${d.value}%`, height: '100%', background: ch.color, borderRadius: 999 }}/>
            </div>
            <div className="num" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtBRL(d.value * 1234)}</div>
          </div>
        );
      })}
    </div>
  );
};

window.Dashboard = Dashboard;
