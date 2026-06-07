// Orion Console — Overview (platform health).
// Depends on: ConsoleHead, Metric, Card, PlanTag, OrgMark, OrgStatus, CONSOLE.

const Overview = ({ setRoute, openOrg }) => {
  const orgs = CONSOLE.orgs;
  const byStatus = (s) => orgs.filter(o => o.status === s).length;
  const active = byStatus('ativa');
  const trials = byStatus('trial');
  const mrr = orgs.filter(o => o.status === 'ativa' || o.status === 'inadimplente')
                  .reduce((s, o) => s + (CONSOLE.planById(o.plan)?.price || 0), 0);
  const ordersMo = orgs.reduce((s, o) => s + o.ordersMo, 0);
  const pendingInvites = CONSOLE.users.filter(u => u.status === 'convidado').length;

  // Plan mix
  const mix = CONSOLE.plans.map(p => ({ ...p, count: orgs.filter(o => o.plan === p.id).length }));
  const total = orgs.length;

  // Attention queue
  const attention = orgs
    .filter(o => o.status === 'inadimplente' || (o.status === 'trial' && (o.trialEndsIn ?? 99) <= 7) || (o.seats !== 999 && o.members >= o.seats))
    .map(o => {
      let reason, icon, tone;
      if (o.status === 'inadimplente') { reason = o.note || 'Fatura em atraso'; icon = 'credit-card'; tone = 'err'; }
      else if (o.status === 'trial') { reason = `Trial termina em ${o.trialEndsIn} dias`; icon = 'timer'; tone = 'warn'; }
      else { reason = `Assentos no limite (${o.members}/${o.seats})`; icon = 'users'; tone = 'warn'; }
      return { o, reason, icon, tone };
    });

  const maxV = Math.max(...CONSOLE.mrrSeries.map(d => d.v));

  return (
    <div className="page">
      <ConsoleHead icon="gauge" eyebrow="Visão geral" title="Saúde da" titleEm="plataforma"
        desc="Receita, organizações e o que precisa da sua atenção hoje — em toda a base Orion."
        actions={<>
          <button className="btn"><Icon name="download" size={13}/> Relatório</button>
          <button className="btn btn-primary" onClick={() => setRoute('orgs')}><Icon name="building-2" size={13}/> Ver organizações</button>
        </>}/>

      {/* Hero metrics */}
      <div className="grid g-cols-4" style={{ marginBottom: 18 }}>
        <Metric label="MRR" value={fmtBRL(mrr)} delta={6.4} accent foot={`≈ ${fmtBRL(mrr * 12)} ARR`}/>
        <Metric label="Organizações ativas" value={active} delta={9.1} foot={`${total} no total · ${trials} em trial`}/>
        <Metric label="Novos cadastros (30d)" value={trials} delta={50} foot="3 trials abertos em maio"/>
        <Metric label="Churn mensal" value="2,4%" delta={-0.8} deltaGood={true} foot="1 conta pausada este mês"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, marginBottom: 18 }}>
        {/* MRR chart */}
        <Card title="Receita recorrente" sub="MRR contratado · últimos 12 meses"
          action={<span className="pill ok"><Icon name="trending-up" size={11} strokeWidth={2.2}/> +105% no período</span>}>
          <div className="bars" style={{ marginTop: 4 }}>
            {CONSOLE.mrrSeries.map((d, i) => (
              <div className="bars-col" key={i}>
                <div className="bars-bar" style={{ height: `${(d.v / maxV) * 100}%`, opacity: i === CONSOLE.mrrSeries.length - 1 ? 1 : 0.82 }}
                     title={fmtBRL(d.v)}/>
                <div className="bars-x">{d.m}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Plan mix */}
        <Card title="Distribuição por plano" sub={`${total} organizações`}>
          <div className="mix-rail" style={{ marginTop: 4 }}>
            {mix.map(p => p.count > 0 && (
              <div key={p.id} className="mix-seg" style={{ width: `${(p.count / total) * 100}%`, background: p.color }} title={`${p.name}: ${p.count}`}/>
            ))}
          </div>
          <div className="mix-legend">
            {mix.map(p => (
              <div key={p.id} className="mix-key">
                <span className="mix-swatch" style={{ background: p.color }}/>
                {p.name} <b>{p.count}</b>
                <span style={{ color: 'var(--ink-3)' }}>· {p.price === 0 ? 'grátis' : fmtBRL(p.price) + '/mês'}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--ink-2)' }}>
            <span>Pedidos no mês (plataforma)</span>
            <b style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(ordersMo)}</b>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Needs attention */}
        <Card title="Precisa de atenção" sub={`${attention.length} organizações`} pad={false}
          action={<button className="btn btn-sm" onClick={() => setRoute('orgs')}>Ver todas</button>}>
          <div>
            {attention.map(({ o, reason, icon, tone }, i) => (
              <div key={o.id} onClick={() => openOrg(o.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
                borderBottom: i === attention.length - 1 ? 0 : '1px solid var(--line-soft)', cursor: 'default',
              }} className="hoverrow">
                <OrgMark org={o} size={32}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.name}</span>
                    <PlanTag id={o.plan} size="sm"/>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <Icon name={icon} size={11} style={{ color: `var(--${tone === 'err' ? 'err' : 'warn'})`, flexShrink: 0 }}/>
                    {reason}
                  </div>
                </div>
                <Icon name="chevron-right" size={15} style={{ color: 'var(--ink-3)' }}/>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent admin actions */}
        <Card title="Atividade da plataforma" sub="Ações administrativas recentes" pad={false}
          action={<span className="tb-env" style={{ fontSize: 11 }}><Icon name="history" size={12}/> log</span>}>
          <table className="tbl">
            <tbody>
              {CONSOLE.audit.map((e, i) => (
                <tr key={i}>
                  <td style={{ width: 1, whiteSpace: 'nowrap', fontSize: 12, color: 'var(--ink-3)', verticalAlign: 'top', paddingTop: 14 }}>{e.when}</td>
                  <td style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--accent-edge)', flexShrink: 0 }}>{e.action}</span>
                      <span style={{ color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.target}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.who} · {e.note}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};

window.Overview = Overview;
