// Reports + Settings pages

const Reports = () => {
  const [tab, setTab] = React.useState('sales');
  return (
    <div className="page">
      <PageHead sub="reports" title="Relatórios" titleEm="& análises"
                desc="Vendas, produção, estoque e custos."
                actions={<>
                  <button className="btn"><Icon name="calendar" size={14}/> Últimos 90 dias</button>
                  <button className="btn"><Icon name="download" size={14}/> Exportar CSV</button>
                </>}/>
      <HelpCard id="reports" icon="bar-chart-3" tone="var(--brand-reports)" title="Relatórios — cruze vendas, produção, estoque e custo">
        <HelpBody>
          Todos os dados do Orion num só lugar para <b>analisar</b>: o que mais vende, gargalos de <b>produção</b>, giro de <b>estoque</b> e a <b>margem</b> real por produto. Filtre por período e <b>exporte</b> quando precisar.
        </HelpBody>
        <Flow accent="var(--brand-reports)" steps={[
          { icon: 'database', label: 'Dados', sub: 'vendas · produção' },
          { icon: 'bar-chart-3', label: 'Relatórios', sub: 'gráficos & filtros', tone: 'accent' },
          { icon: 'lightbulb', label: 'Decisões', sub: 'o que produzir', tone: 'ok' },
        ]}/>
      </HelpCard>
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

// Settings moved to pages/settings.jsx
Object.assign(window, { Reports });
