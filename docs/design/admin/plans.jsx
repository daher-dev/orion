// Orion Console — Plans catalog + economics.
// Depends on: ConsoleHead, Card, Icon, CONSOLE.

const Plans = ({ setRoute }) => {
  const orgs = CONSOLE.orgs;
  const stats = CONSOLE.plans.map(p => {
    const subs = orgs.filter(o => o.plan === p.id);
    const paying = subs.filter(o => o.status === 'ativa' || o.status === 'inadimplente');
    return { ...p, count: subs.length, mrr: paying.length * p.price };
  });
  const totalMrr = stats.reduce((s, p) => s + p.mrr, 0);
  const limitRows = [
    ['Membros', 'membros'], ['Pedidos', 'pedidos'], ['Integrações', 'integracoes'], ['Armazenamento', 'armazenamento'],
  ];

  return (
    <div className="page">
      <ConsoleHead icon="layout-grid" color="#7e5bef" eyebrow="Plataforma" title="Planos"
        desc="O catálogo de planos Orion, seus limites e quanto cada um gera de receita."
        actions={<button className="btn btn-primary"><Icon name="plus" size={13}/> Novo plano</button>}/>

      {/* Plan cards */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 18 }}>
        {stats.map(p => (
          <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 4, background: p.color }}/>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }}/>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{p.tagline}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em' }}>
                  {p.price === 0 ? 'Grátis' : fmtBRL(p.price)}
                </span>
                {p.price > 0 && <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>/mês</span>}
              </div>
              <div style={{ display: 'grid', gap: 7, marginTop: 2 }}>
                {limitRows.map(([label, key]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{label}</span>
                    <span style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{p.limits[key]}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                  <b style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{p.count}</b> {p.count === 1 ? 'org' : 'orgs'}
                </span>
                <span style={{ fontSize: 12.5, color: p.mrr ? 'var(--ink)' : 'var(--ink-3)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {p.mrr ? fmtBRL(p.mrr) + '/mês' : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Economics table */}
      <Card title="Economia dos planos" sub="Assinantes e receita por plano" pad={false}
        action={<span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>MRR total <b style={{ color: 'var(--ink)' }}>{fmtBRL(totalMrr)}</b></span>}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Plano</th><th className="num">Preço</th><th className="num">Organizações</th>
              <th className="num">MRR</th><th className="num">% da receita</th><th style={{ width: '24%' }}></th>
            </tr>
          </thead>
          <tbody>
            {stats.map(p => {
              const share = totalMrr ? (p.mrr / totalMrr) * 100 : 0;
              return (
                <tr key={p.id}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color }}/>
                      <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{p.name}</span>
                    </span>
                  </td>
                  <td className="num" style={{ color: 'var(--ink-2)' }}>{p.price === 0 ? '—' : fmtBRL(p.price)}</td>
                  <td className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.count}</td>
                  <td className="num" style={{ fontWeight: 600, color: p.mrr ? 'var(--ink)' : 'var(--ink-3)' }}>{p.mrr ? fmtBRL(p.mrr) : '—'}</td>
                  <td className="num" style={{ color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{share.toFixed(0)}%</td>
                  <td>
                    <div className="meter" style={{ height: 8 }}><span style={{ width: share + '%', background: p.color }}/></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)', padding: '14px 4px 0' }}>
        <Icon name="info" size={12}/>
        Trials e contas gratuitas não entram no MRR. Veja cada assinatura em <span className="sub-link" style={{ color: 'var(--accent)', fontWeight: 500 }} onClick={() => setRoute('orgs')}>Organizações</span>.
      </div>
    </div>
  );
};

window.Plans = Plans;
