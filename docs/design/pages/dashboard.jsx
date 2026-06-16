// Dashboard page — Início centred on the daily conferência (order checking)

// Actionable conference KPI tile
const ConfKPI = ({ label, value, suffix, icon, color, foot, onClick }) => (
  <div className="kpi conf-kpi" onClick={onClick} role="button" tabIndex={0}
       onKeyDown={e => { if (e.key === 'Enter') onClick?.(); }}>
    <div className="conf-kpi-top">
      <span className="kpi-label">{label}</span>
      <span className="conf-kpi-badge" style={{ background: `color-mix(in oklab, ${color} 15%, var(--surface))`, color }}>
        <Icon name={icon} size={16} strokeWidth={2.2}/>
      </span>
    </div>
    <div className="conf-kpi-value">
      {value}{suffix && <span style={{ fontSize: 20, color: 'var(--ink-3)' }}>{suffix}</span>}
    </div>
    {foot && <div className="conf-kpi-foot">{foot}</div>}
  </div>
);

// Big progress panel inside Resumo da Conferência
const ProgPanel = ({ title, icon, color, done, total, onClick }) => {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="conf-prog-panel" onClick={onClick}
         style={{ cursor: 'pointer',
                  background: `color-mix(in oklab, ${color} 7%, var(--surface))`,
                  borderColor: `color-mix(in oklab, ${color} 22%, var(--surface))` }}>
      <div className="conf-prog-head">
        <span className="conf-prog-title" style={{ color }}><Icon name={icon} size={15} strokeWidth={2.2}/>{title}</span>
        <span className="conf-prog-pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="conf-prog-nums"><b>{fmtInt(done)}</b> <span>/ {fmtInt(total)}</span></div>
      <div className="conf-track"><div className="conf-track-fill" style={{ width: `${pct}%`, background: color }}/></div>
    </div>
  );
};

// Small actionable tile (parciais / problemas / a conferir)
const SubTile = ({ label, value, icon, color, onClick }) => (
  <div className="conf-subtile" onClick={onClick}
       style={{ background: `color-mix(in oklab, ${color} 7%, var(--surface))`,
                borderColor: `color-mix(in oklab, ${color} 20%, var(--surface))` }}>
    <span className="conf-subtile-label" style={{ color }}><Icon name={icon} size={13} strokeWidth={2.2}/>{label}</span>
    <div className="conf-subtile-val">{fmtInt(value)}</div>
  </div>
);

const Dashboard = ({ role, setRoute }) => {
  const u = ORION_DATA.users[role];
  const c = ORION_DATA.conference;
  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (role === 'operator') return <OperatorDashboard setRoute={setRoute}/>;

  const maxPieces = Math.max(...c.topProducts.map(p => p.pieces));

  return (
    <div className="page">
      <PageHead
        sub="dashboard"
        title={`${greet()},`}
        titleEm={u.name.split(' ')[0]}
        desc="Lote de hoje, 3 de junho · 859 pedidos importados."
      />

      <HelpCard id="dashboard" icon="clipboard-check" maxW={720} title="Conferência do dia — do pedido à peça pronta">
        <HelpBody>
          Toda manhã o Orion importa os pedidos dos canais e monta o <b>lote do dia</b>. Aqui você <b>confere</b> cada pedido, resolve <b>parciais</b> e <b>problemas</b> e acompanha a produção avançar em tempo real. Os números são <b>clicáveis</b> — levam direto à tela que resolve.
        </HelpBody>
        <Flow accent="var(--accent)" steps={[
          { icon: 'download', label: 'Pedidos', sub: 'importados' },
          { icon: 'clipboard-check', label: 'Conferência', sub: 'confere & resolve', tone: 'accent' },
          { icon: 'factory', label: 'Produção', sub: 'em andamento' },
          { icon: 'truck', label: 'Expedição', sub: 'sai hoje', tone: 'ok' },
        ]}/>
      </HelpCard>

      {/* Conference KPIs — actionable */}
      <div className="grid g-cols-4" style={{ marginBottom: 18 }}>
        <ConfKPI label="Total de pedidos" value={fmtInt(c.totals.orders)} icon="file-text" color="var(--accent)"
                 foot={<>Importados hoje</>} onClick={() => setRoute('orders')}/>
        <ConfKPI label="Total de itens" value={fmtInt(c.totals.items)} icon="package" color="var(--brand-catalog)"
                 foot={<>Em {fmtInt(c.totals.orders)} pedidos</>} onClick={() => setRoute('orders')}/>
        <ConfKPI label="Estampas mapeadas" value={c.totals.mappedPct} suffix="%" icon="check-circle-2" color="var(--ok)"
                 foot={<>Todas vinculadas a uma estampa</>} onClick={() => setRoute('prints')}/>
        <ConfKPI label="Pendentes" value={fmtInt(c.totals.pending)} icon="alert-circle" color="var(--warn)"
                 foot={c.totals.pending === 0 ? <span style={{ color: 'var(--ok)' }}>Nada a resolver</span> : <>Aguardando mapeamento</>}
                 onClick={() => setRoute('prints')}/>
      </div>

      {/* Resumo da conferência + Top 5 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 18, marginBottom: 18, alignItems: 'start' }}>
        <Card title="Resumo da conferência" sub="Progresso do lote">
          <div className="conf-prog">
            <ProgPanel title="Pedidos 100% conferidos" icon="clipboard-check" color="var(--ok)"
                       done={c.progress.ordersDone} total={c.progress.ordersTotal} onClick={() => setRoute('orders')}/>
            <ProgPanel title="Peças conferidas" icon="package-check" color="var(--accent)"
                       done={c.progress.piecesDone} total={c.progress.piecesTotal} onClick={() => setRoute('orders')}/>
          </div>
          <div className="conf-sub">
            <SubTile label="Parciais"  value={c.progress.partial}  icon="circle-dashed"  color="var(--warn)"  onClick={() => setRoute('orders')}/>
            <SubTile label="Problemas" value={c.progress.problems} icon="alert-triangle" color="var(--err)"   onClick={() => setRoute('orders')}/>
            <SubTile label="A conferir" value={c.progress.toCheck} icon="clock"          color="var(--ink-3)" onClick={() => setRoute('orders')}/>
          </div>
        </Card>

        <Card title="Top 5 produtos" sub="Por peças no lote"
              action={<button className="btn btn-sm btn-ghost" onClick={() => setRoute('products')}>Ver todos</button>}>
          <div>
            {c.topProducts.map(p => (
              <div key={p.code} className="tp-row" onClick={() => setRoute('products')}>
                <span className={`tp-rank ${p.rank === 1 ? 'lead' : ''}`}>{p.rank}</span>
                <FabricThumb tone={p.tone} size={40}/>
                <div style={{ minWidth: 0 }}>
                  <div className="tp-name">{p.code}</div>
                  <div className="tp-track"><div className="tp-track-fill" style={{ width: `${(p.pieces / maxPieces) * 100}%` }}/></div>
                </div>
                <div className="tp-amt">
                  <div className="tp-pieces">{p.pieces}<small>pç</small></div>
                  <div className="tp-orders">{p.orders} ped.</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Relatório de Pedidos — actionable breakdown */}
      <Card title="Relatório de pedidos" sub="Resumo do lote de hoje" pad={false}>
        <div style={{ padding: 18 }}>
          <div className="report-grid">
            {c.report.map(r => (
              <div key={r.key} className="report-tile report-tile-static"
                   style={{ background: `color-mix(in oklab, ${r.color} 6%, var(--surface))`,
                            borderColor: `color-mix(in oklab, ${r.color} 18%, var(--surface))` }}>
                <div className="report-tile-top">
                  <span className="conf-kpi-badge" style={{ width: 28, height: 28, borderRadius: 7,
                        background: `color-mix(in oklab, ${r.color} 14%, var(--surface))`, color: r.color }}>
                    <Icon name={r.icon} size={14} strokeWidth={2.2}/>
                  </span>
                  <span className="report-tile-val" style={{ color: r.value === 0 && r.key === 'pending' ? 'var(--ink-3)' : r.color }}>{fmtInt(r.value)}</span>
                </div>
                <div className="report-tile-label">{r.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Operational follow-ups — Orion-native */}
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
                  cursor: 'pointer',
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
    </div>
  );
};

const OperatorDashboard = ({ setRoute }) => (
  <div className="page">
    <PageHead sub="dashboard" title="Bom dia," titleEm="Joana"
              desc="Suas tarefas para hoje na fábrica."/>
    <HelpCard id="dashboard-op" icon="clipboard-check" title="Seu dia na fábrica, em ordem">
      <HelpBody>
        Esta tela reúne só o que <b>é seu hoje</b>: cortes na sua fila, remessas que chegam e o que falta costurar. Toque num card para ir direto à tarefa — feche cada etapa e ela some daqui.
      </HelpBody>
      <Flow accent="var(--brand-prod)" steps={[
        { icon: 'scissors', label: 'Cortar', sub: 'sua fila', tone: 'accent' },
        { icon: 'send', label: 'Costurar', sub: 'remessas' },
        { icon: 'package-check', label: 'Entregar', sub: 'ao estoque', tone: 'ok' },
      ]}/>
    </HelpCard>

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

window.Dashboard = Dashboard;
