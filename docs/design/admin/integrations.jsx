// Orion Console — Integrations health across all orgs.
// Depends on: ConsoleHead, Card, Icon, CONSOLE.

const INT_STATUS = {
  operacional: { kind: 'ok',   dot: 'ok',   label: 'Operacional' },
  degradado:   { kind: 'warn', dot: 'warn', label: 'Degradado' },
  incidente:   { kind: 'err',  dot: 'err',  label: 'Incidente' },
  manutencao:  { kind: 'info', dot: 'info', label: 'Manutenção' },
};

const IntHealthCard = ({ it }) => {
  const s = INT_STATUS[it.status] || INT_STATUS.operacional;
  const initials = it.name.split(/\s+/).filter(w => w.length > 1).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, background: it.color, color: it.fg || '#fff',
          display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, flexShrink: 0,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15), 0 2px 6px -2px rgba(31,27,21,.18)',
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink)', fontWeight: 500 }}>{it.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{it.orgs} organizações conectadas</div>
        </div>
        <span className={`pill ${s.kind}`}><span className={`sdot ${s.dot}`} style={{ width: 6, height: 6, boxShadow: 'none' }}/>{s.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--line-soft)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line-soft)' }}>
        {[
          { k: 'Uptime 30d', v: it.uptime.toFixed(2) + '%' },
          { k: 'Latência p95', v: it.latency + ' ms' },
          { k: 'Erros 24h', v: it.errorRate.toFixed(1) + '%' },
        ].map(m => (
          <div key={m.k} style={{ background: 'var(--surface)', padding: '9px 11px' }}>
            <div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>{m.k}</div>
            <div style={{ fontSize: 15, color: 'var(--ink)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {it.incident ? (
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', padding: '7px 10px', background: it.status === 'incidente' ? 'var(--err-bg)' : 'var(--warn-bg)', borderRadius: 6, borderLeft: `2px solid var(--${it.status === 'incidente' ? 'err' : 'warn'})`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="alert-triangle" size={12} style={{ color: `var(--${it.status === 'incidente' ? 'err' : 'warn'})`, flexShrink: 0 }}/>
          {it.incident}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="activity" size={12}/> {fmtInt(it.eventsToday)} eventos hoje</span>
          <button className="btn btn-sm btn-ghost"><Icon name="settings-2" size={12}/> Detalhes</button>
        </div>
      )}
    </div>
  );
};

const Integrations = () => {
  const all = CONSOLE.integrations;
  const nOk = all.filter(i => i.status === 'operacional').length;
  const nDeg = all.filter(i => i.status === 'degradado').length;
  const nInc = all.filter(i => i.status === 'incidente').length;
  const events = all.reduce((s, i) => s + i.eventsToday, 0);
  const groups = ['Marketplaces', 'Logística', 'Comunicação', 'IA'];

  return (
    <div className="page">
      <ConsoleHead icon="plug-zap" color="#c2410c" eyebrow="Plataforma" title="Integrações"
        desc="Saúde dos conectores que abastecem todas as organizações — marketplaces, frete e mais."
        actions={<button className="btn"><Icon name="refresh-cw" size={13}/> Revalidar tudo</button>}/>

      {/* Status banner */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 220 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: nInc ? 'var(--err-bg)' : 'var(--ok-bg)', color: nInc ? 'var(--err)' : 'var(--ok)', display: 'grid', placeItems: 'center' }}>
            <Icon name={nInc ? 'alert-triangle' : 'check-circle-2'} size={20}/>
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>
              {nInc ? `${nInc} incidente${nInc > 1 ? 's' : ''} em andamento` : 'Todos os sistemas operacionais'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{nOk} operacionais · {nDeg} degradados · {nInc} em incidente</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 26 }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>Eventos hoje</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(events)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>Conectores</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{all.length}</div>
          </div>
        </div>
      </div>

      {groups.map(g => {
        const items = all.filter(i => i.group === g);
        if (!items.length) return null;
        return (
          <div key={g} style={{ marginBottom: 22 }}>
            <div className="row-div" style={{ marginBottom: 12 }}>
              <span>{g}</span><span className="ln"/><span className="ct">{items.length} {items.length === 1 ? 'conector' : 'conectores'}</span>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
              {items.map(it => <IntHealthCard key={it.id} it={it}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

window.Integrations = Integrations;
