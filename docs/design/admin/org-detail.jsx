// Orion Console — Organization detail (full page).
// Depends on: Card, OrgMark, PlanTag, OrgStatus, Av, Icon, UsageBar, StatusPill, CONSOLE, ORION_DATA.

const intLookup = (id) => CONSOLE.integrations.find(i => i.id === id) || { name: id, color: '#999' };

const Meter = ({ label, value, max, unit, capLabel }) => {
  const unlimited = max >= 999999 || max === 'Ilimitado';
  const pct = unlimited ? 12 : Math.min(100, (value / max) * 100);
  const lvl = !unlimited && pct >= 100 ? 'err' : !unlimited && pct >= 80 ? 'warn' : '';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</span>
        <span style={{ fontSize: 12.5, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {fmtInt(value)}{unit ? ' ' + unit : ''} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>/ {capLabel}</span>
        </span>
      </div>
      <div className="meter"><span className={lvl} style={{ width: pct + '%', opacity: unlimited ? .5 : 1 }}/></div>
    </div>
  );
};

const OrgDetail = ({ org, onBack }) => {
  const plan = CONSOLE.planById(org.plan);
  const members = CONSOLE.users.filter(u => u.org === org.id);
  const [confirmImp, setConfirmImp] = React.useState(false);
  const invoices = org.mrr ? [
    { id: 'INV-2026-06', date: '03/06/2026', amount: plan.price, status: org.status === 'inadimplente' ? 'pendente' : 'pago' },
    { id: 'INV-2026-05', date: '03/05/2026', amount: plan.price, status: 'pago' },
    { id: 'INV-2026-04', date: '03/04/2026', amount: plan.price, status: 'pago' },
  ] : [];

  return (
    <div className="page" style={{ maxWidth: 1240 }}>
      <div className="org-back" onClick={onBack}><Icon name="arrow-left" size={14}/> Organizações</div>

      {/* Header */}
      <div className="page-head" style={{ marginBottom: 18 }}>
        <div className="page-head-l" style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <OrgMark org={org} size={56}/>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {org.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <PlanTag id={org.plan}/>
              <OrgStatus s={org.status}/>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon name="map-pin" size={12}/> {org.city}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon name="calendar" size={12}/> desde {org.created}
              </span>
            </div>
          </div>
        </div>
        <div className="page-head-r">
          <button className="btn btn-primary" onClick={() => setConfirmImp(true)}>
            <Icon name="log-in" size={13}/> Entrar como {org.name.split(' ')[0]}
          </button>
        </div>
      </div>

      {org.note && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10,
          borderColor: org.status === 'inadimplente' ? 'color-mix(in oklab, var(--err) 30%, var(--line))' : 'var(--line)',
          background: org.status === 'inadimplente' ? 'var(--err-bg)' : 'var(--surface)' }}>
          <Icon name={org.status === 'inadimplente' ? 'alert-triangle' : 'info'} size={15}
            style={{ color: org.status === 'inadimplente' ? 'var(--err)' : 'var(--warn)' }}/>
          <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{org.note}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>
        {/* Main column */}
        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          {/* Usage */}
          <Card title="Uso no plano" sub={`Plano ${plan.name} · ciclo atual`}>
            <div style={{ display: 'grid', gap: 16 }}>
              <Meter label="Pedidos no mês" value={org.ordersMo} max={org.ordersCap} capLabel={plan.limits.pedidos}/>
              <Meter label="Assentos de equipe" value={org.members} max={org.seats} capLabel={plan.limits.membros}/>
              <Meter label="Integrações ativas" value={org.integrations.length} max={typeof plan.limits.integracoes === 'string' && /\d/.test(plan.limits.integracoes) ? +plan.limits.integracoes : 999999} capLabel={plan.limits.integracoes}/>
            </div>
          </Card>

          {/* Members */}
          <Card title="Equipe" sub={`${members.length} ${members.length === 1 ? 'pessoa' : 'pessoas'}`} pad={false}
            action={<button className="btn btn-sm"><Icon name="user-plus" size={12}/> Convidar</button>}>
            <table className="tbl">
              <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Status</th><th>Visto por último</th></tr></thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.email}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Av name={m.name} color={org.accent}/>
                        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{m.name}</span>
                      </div>
                    </td>
                    <td className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{m.email}</td>
                    <td>{m.role}</td>
                    <td><StatusPill s={m.status === 'ativo' ? 'ativo' : m.status === 'convidado' ? 'convidado' : 'pausado'}/></td>
                    <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{m.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Billing */}
          <Card title="Cobrança" sub="Faturas recentes" pad={false}
            action={org.status === 'inadimplente'
              ? <button className="btn btn-sm btn-primary"><Icon name="refresh-cw" size={12}/> Retentar cobrança</button>
              : <button className="btn btn-sm"><Icon name="external-link" size={12}/> Ver no Stripe</button>}>
            {invoices.length === 0 ? (
              <div style={{ padding: '18px', fontSize: 13, color: 'var(--ink-3)' }}>
                Sem cobranças — organização em {org.status === 'trial' ? 'período de trial' : 'plano gratuito'}.
              </div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Fatura</th><th>Data</th><th className="num">Valor</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{inv.id}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{inv.date}</td>
                      <td className="num" style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtBRL(inv.amount)}</td>
                      <td><span className={`pill ${inv.status === 'pago' ? 'ok' : 'warn'}`}><span className="pill-dot"/>{inv.status === 'pago' ? 'Pago' : 'Pendente'}</span></td>
                      <td className="num"><button className="btn btn-sm btn-ghost"><Icon name="download" size={12}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Danger zone */}
          <Card title="Zona crítica" sub="Ações que afetam o acesso da organização">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{org.status === 'pausada' ? 'Reativar conta' : 'Pausar conta'}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{org.status === 'pausada' ? 'Restaura o acesso da equipe imediatamente.' : 'Suspende o acesso da equipe sem apagar dados.'}</div>
              </div>
              <button className="btn"><Icon name={org.status === 'pausada' ? 'play' : 'pause'} size={13}/> {org.status === 'pausada' ? 'Reativar' : 'Pausar'}</button>
            </div>
            <div style={{ height: 1, background: 'var(--line-soft)', margin: '12px 0' }}/>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ color: 'var(--err)', fontWeight: 500 }}>Apagar organização</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Remove todos os dados após 30 dias. Irreversível.</div>
              </div>
              <button className="btn" style={{ color: 'var(--err)', borderColor: 'color-mix(in oklab, var(--err) 30%, var(--line))' }}>
                <Icon name="trash-2" size={13}/> Apagar
              </button>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <div style={{ display: 'grid', gap: 18, position: 'sticky', top: 8 }}>
          <Card title="Resumo">
            <dl className="kv">
              <dt>MRR</dt><dd style={{ color: org.mrr ? 'var(--ink)' : 'var(--ink-3)', fontWeight: 600 }}>{org.mrr ? fmtBRL(org.mrr) : '—'}</dd>
              <dt>Plano</dt><dd><PlanTag id={org.plan} size="sm"/></dd>
              <dt>Próx. fatura</dt><dd>{org.mrr ? '03/06/2026' : '—'}</dd>
              <dt>Pedidos/mês</dt><dd>{fmtInt(org.ordersMo)}</dd>
              <dt>Equipe</dt><dd>{org.members} / {org.seats >= 999 ? '∞' : org.seats}</dd>
              <dt>Criada</dt><dd>{org.created}</dd>
              <dt>Última atividade</dt><dd>{org.lastActive}</dd>
            </dl>
            <div style={{ height: 1, background: 'var(--line-soft)', margin: '14px 0' }}/>
            <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600, marginBottom: 8 }}>Titular</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Av name={org.owner.name} color={org.accent} size={34}/>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{org.owner.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{org.owner.email}</div>
              </div>
            </div>
          </Card>

          <Card title="Mudar plano">
            <div style={{ display: 'grid', gap: 8 }}>
              {CONSOLE.plans.map(p => {
                const cur = p.id === org.plan;
                return (
                  <button key={p.id} className="btn" style={{
                    justifyContent: 'space-between', width: '100%',
                    borderColor: cur ? p.color : 'var(--line)',
                    background: cur ? `color-mix(in oklab, ${p.color} 10%, var(--surface))` : 'var(--surface)',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="pill-dot" style={{ background: p.color, width: 7, height: 7, borderRadius: 999 }}/>
                      {p.name}
                    </span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{p.price === 0 ? 'grátis' : fmtBRL(p.price)}{cur ? ' · atual' : ''}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card title="Integrações" sub={`${org.integrations.length} de ${CONSOLE.integrations.length} conectadas`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {CONSOLE.integrations.map(it => {
                const on = org.integrations.includes(it.id);
                return (
                  <div key={it.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '7px 9px', borderRadius: 8,
                    background: on ? 'var(--surface)' : 'transparent',
                    border: `1px solid ${on ? 'var(--line)' : 'transparent'}`,
                    opacity: on ? 1 : 0.5,
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      background: on ? it.color : 'var(--surface-2)',
                      color: on ? (it.fg || '#fff') : 'var(--ink-3)',
                      filter: on ? 'none' : 'grayscale(1)',
                    }}>{it.name.slice(0, 2).toUpperCase()}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: on ? 'var(--ink)' : 'var(--ink-3)', fontWeight: on ? 500 : 400 }}>{it.name}</span>
                    {on
                      ? <Icon name="check" size={14} style={{ color: 'var(--ok)' }}/>
                      : <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>disponível</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Modal open={confirmImp} onClose={() => setConfirmImp(false)} title="Entrar como organização"
        footer={<>
          <button className="btn" onClick={() => setConfirmImp(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => { setConfirmImp(false); goImpersonate(org); }}>
            <Icon name="log-in" size={13}/> Entrar como {org.name.split(' ')[0]}
          </button>
        </>}>
        <div style={{ display: 'flex', gap: 14 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="shield-alert" size={20}/>
          </span>
          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
            Você entrará no workspace de <b style={{ color: 'var(--ink)' }}>{org.name}</b> com acesso total aos dados da organização — pedidos, clientes e configurações.
            <ul style={{ margin: '12px 0 0', paddingLeft: 18, display: 'grid', gap: 6 }}>
              <li>É uma ação <b>invasiva</b> e fica <b>registrada</b> no log da plataforma.</li>
              <li>A equipe de {org.name} verá uma faixa indicando uma sessão de suporte Orion.</li>
              <li>Encerre a sessão assim que concluir o atendimento.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};

window.OrgDetail = OrgDetail;
