// Settings (Ajustes) — full implementation
// Depends on: Card, PageHead, Icon, Av, StatusPill, fmt, fmtBRL, ORION_DATA

// ───────── Seed data scoped to settings ─────────
const SETTINGS_DATA = {
  plan: {
    name: 'Pro',
    price: 149,
    period: 'mês',
    next: '03/06/2026',
    features: [
      'Membros ilimitados',
      'Integrações com marketplaces',
      'NFe e emissão fiscal',
      'Suporte por WhatsApp',
      'Relatórios avançados e exportação',
    ],
    usage: [
      { label: 'Membros',        value: 5,   max: 10,   unit: '' },
      { label: 'Pedidos no mês', value: 312, max: 5000, unit: '' },
      { label: 'Integrações',    value: 5,   max: 8,    unit: '' },
      { label: 'Armazenamento',  value: 1.2, max: 10,   unit: 'GB' },
    ],
  },
  card: { brand: 'Visa', last4: '4521', exp: '11/27', holder: 'UNDERGROUND CONFEC. LTDA' },
  invoices: [
    { id: 'INV-2026-05', date: '03/05/2026', amount: 149.00, status: 'pago' },
    { id: 'INV-2026-04', date: '03/04/2026', amount: 149.00, status: 'pago' },
    { id: 'INV-2026-03', date: '03/03/2026', amount: 149.00, status: 'pago' },
    { id: 'INV-2026-02', date: '03/02/2026', amount:  99.00, status: 'pago' },
    { id: 'INV-2026-01', date: '03/01/2026', amount:  99.00, status: 'pago' },
  ],
  roles: [
    { id: 'admin',    name: 'Admin',    members: 1, desc: 'Acesso total — equipe, cobrança e integrações.' },
    { id: 'manager',  name: 'Gestor',   members: 2, desc: 'Opera vendas, catálogo, produção e estoque.' },
    { id: 'operator', name: 'Operador', members: 2, desc: 'Foca no dia a dia da produção e estoque.' },
  ],
  permissions: [
    { group: 'Vendas', items: [
      { label: 'Ver pedidos',              admin: 'all', manager: 'all', operator: 'none' },
      { label: 'Criar e editar pedidos',   admin: 'all', manager: 'all', operator: 'none' },
      { label: 'Cancelar pedidos',         admin: 'all', manager: 'all', operator: 'none' },
      { label: 'Ver dados do cliente',     admin: 'all', manager: 'all', operator: 'none' },
    ]},
    { group: 'Catálogo', items: [
      { label: 'Editar fichas técnicas',   admin: 'all', manager: 'all', operator: 'view' },
      { label: 'Definir preço de venda',   admin: 'all', manager: 'all', operator: 'none' },
      { label: 'Publicar produtos',        admin: 'all', manager: 'all', operator: 'none' },
    ]},
    { group: 'Produção', items: [
      { label: 'Abrir ordem de corte',     admin: 'all', manager: 'all', operator: 'all'  },
      { label: 'Registrar saída de peças', admin: 'all', manager: 'all', operator: 'all'  },
      { label: 'Gerenciar bancas',         admin: 'all', manager: 'all', operator: 'view' },
    ]},
    { group: 'Estoque', items: [
      { label: 'Receber tecido',           admin: 'all', manager: 'all', operator: 'all'  },
      { label: 'Ajuste de inventário',     admin: 'all', manager: 'all', operator: 'view' },
    ]},
    { group: 'Sistema', items: [
      { label: 'Ver relatórios',           admin: 'all', manager: 'all',  operator: 'none' },
      { label: 'Gerenciar equipe',         admin: 'all', manager: 'none', operator: 'none' },
      { label: 'Cobrança e plano',         admin: 'all', manager: 'none', operator: 'none' },
      { label: 'Integrações',              admin: 'all', manager: 'view', operator: 'none' },
    ]},
  ],
  integrations: [
    { id: 'shopee',      name: 'Shopee',           desc: 'Pedidos do marketplace', group: 'Marketplaces', status: 'conectado',  sync: 'há 3 min',  stat: '124 pedidos no mês', color: '#ee4d2d' },
    { id: 'ml',          name: 'Mercado Livre',    desc: 'Pedidos do marketplace', group: 'Marketplaces', status: 'conectado',  sync: 'há 8 min',  stat: '78 pedidos no mês',  color: '#fff159', fg: '#1f1f1f' },
    { id: 'shopify',     name: 'Shopify',          desc: 'Loja própria',           group: 'Marketplaces', status: 'conectado',  sync: 'há 1h',     stat: '34 pedidos no mês',  color: '#7ab55c' },
    { id: 'instagram',   name: 'Instagram Shop',   desc: 'Catálogo + pedidos por DM', group: 'Marketplaces', status: 'disponivel', color: '#d6249f' },
    { id: 'correios',    name: 'Correios',         desc: 'Cálculo de frete e rastreio',  group: 'Logística', status: 'conectado',  sync: 'há 30 min', stat: '14 etiquetas geradas hoje', color: '#fcb900', fg: '#1f1f1f' },
    { id: 'bling',       name: 'Bling ERP',        desc: 'Emissão de NFe e fiscal',      group: 'Logística', status: 'disponivel', color: '#1e88e5' },
    { id: 'melhorenvio', name: 'Melhor Envio',     desc: 'Frete consolidado',            group: 'Logística', status: 'disponivel', color: '#0fb9b1' },
    { id: 'whatsapp',    name: 'WhatsApp Business',desc: 'Confirmações e atendimento',   group: 'Comunicação', status: 'conectado',  sync: 'há 12 min', stat: '482 mensagens enviadas', color: '#25d366' },
    { id: 'slack',       name: 'Slack',            desc: 'Alertas no canal #operacao',   group: 'Comunicação', status: 'disponivel', color: '#4a154b' },
    { id: 'claude',      name: 'Claude (IA)',      desc: 'Descrições e atendimento automático', group: 'IA', status: 'conectado',  sync: 'agora', stat: '189 chamadas no mês', color: '#c66a2c' },
    { id: 'webhooks',    name: 'Webhooks',         desc: 'Endpoints customizados',       group: 'IA',          status: 'disponivel', color: '#1f1b15' },
  ],
  notifPrefs: [
    { group: 'Pedidos', items: [
      { label: 'Novo pedido recebido',           email: true,  inapp: true,  whats: true  },
      { label: 'Pedido pago',                    email: true,  inapp: true,  whats: false },
      { label: 'Pedido cancelado pelo cliente',  email: true,  inapp: true,  whats: true  },
      { label: 'Mensagem do cliente',            email: false, inapp: true,  whats: true  },
    ]},
    { group: 'Produção', items: [
      { label: 'Banca atrasou entrega',          email: true,  inapp: true,  whats: true  },
      { label: 'Corte concluído',                email: false, inapp: true,  whats: false },
      { label: 'Defeito reportado',              email: true,  inapp: true,  whats: false },
    ]},
    { group: 'Estoque', items: [
      { label: 'SKU em ruptura',                 email: true,  inapp: true,  whats: false },
      { label: 'Tecido abaixo do mínimo',        email: true,  inapp: true,  whats: false },
    ]},
    { group: 'Sistema', items: [
      { label: 'Novo membro entrou na equipe',   email: true,  inapp: false, whats: false },
      { label: 'Falha em integração',            email: true,  inapp: true,  whats: false },
    ]},
  ],
  sessions: [
    { device: 'MacBook Pro · São Paulo', icon: 'monitor',    browser: 'Chrome 124', when: 'agora',    current: true  },
    { device: 'iPhone 15 · São Paulo',   icon: 'smartphone', browser: 'Safari',     when: 'há 2h',    current: false },
    { device: 'iPad · São Paulo',        icon: 'tablet',     browser: 'Safari',     when: 'há 3 dias',current: false },
  ],
};

// ───────── Toggle (used in profile + notifications) ─────────
const Toggle = ({ on, onChange, size = 'md' }) => {
  const w = size === 'sm' ? 30 : 36;
  const h = size === 'sm' ? 18 : 22;
  const d = h - 4;
  return (
    <button onClick={() => onChange?.(!on)} style={{
      width: w, height: h, borderRadius: 999, border: 0, padding: 0,
      background: on ? 'var(--accent)' : 'var(--surface-2)',
      position: 'relative', cursor: 'pointer',
      transition: 'background .18s',
      boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--line)',
      flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2,
        left: on ? w - d - 2 : 2,
        width: d, height: d, borderRadius: 999, background: 'white',
        transition: 'left .18s',
        boxShadow: '0 1px 3px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05)',
      }}/>
    </button>
  );
};

// Section subhead inside table
const SubTableRow = ({ label, cols }) => (
  <tr>
    <td colSpan={cols} style={{
      background: 'var(--bg)', padding: '8px 14px',
      fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase',
      color: 'var(--ink-3)', fontWeight: 700,
    }}>{label}</td>
  </tr>
);

// ───────── Settings shell ─────────
const Settings = ({ tweaks, setTweak }) => {
  const [pane, setPane] = React.useState('company');
  const panes = [
    { group: 'Organização',
      items: [
        { id: 'company',       label: 'Empresa',      icon: 'building-2' },
        { id: 'members',       label: 'Membros',      icon: 'users' },
        { id: 'roles',         label: 'Funções',      icon: 'shield' },
        { id: 'billing',       label: 'Assinatura',   icon: 'credit-card' },
        { id: 'integrations',  label: 'Integrações',  icon: 'plug' },
        { id: 'audit',         label: 'Auditoria',    icon: 'history' },
      ] },
    { group: 'Personalização',
      items: [
        { id: 'catalog',       label: 'Catálogo',     icon: 'swatch-book' },
        { id: 'estoque',       label: 'Estoque',      icon: 'boxes' },
      ] },
    { group: 'Conta',
      items: [
        { id: 'profile',       label: 'Perfil',         icon: 'user' },
        { id: 'notifications', label: 'Notificações',   icon: 'bell' },
      ] },
  ];
  return (
    <div className="page">
      <PageHead sub="settings" title="Ajustes"
        desc="Conta, equipe, funções, integrações e avisos."/>
      <HelpCard id="settings" icon="settings" tone="var(--brand-settings)" title="Ajustes — sua conta, equipe e integrações">
        <HelpBody>
          Configure os dados da <b>empresa</b>, convide a <b>equipe</b> e defina <b>funções</b> (quem vê e edita o quê), conecte <b>canais e integrações</b> e escolha como quer ser <b>avisado</b>.
        </HelpBody>
        <Flow accent="var(--brand-settings)" steps={[
          { icon: 'users', label: 'Equipe', sub: 'empresa & membros' },
          { icon: 'shield', label: 'Funções', sub: 'quem vê o quê', tone: 'accent' },
          { icon: 'plug', label: 'Integrações', sub: 'canais & avisos', tone: 'ok' },
        ]}/>
      </HelpCard>
      <div className="settings-grid">
        <aside style={{ position: 'sticky', top: 8 }}>
          {panes.map((g, gi) => (
            <div key={g.group} style={{ marginBottom: gi === panes.length - 1 ? 0 : 14 }}>
              <div style={{
                fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase',
                color: 'var(--ink-3)', fontWeight: 700, padding: '4px 12px 6px',
              }}>{g.group}</div>
              {g.items.map(p => {
                const active = pane === p.id;
                return (
                  <div key={p.id} onClick={() => setPane(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13.5, cursor: 'default',
                    color: active ? 'var(--ink)' : 'var(--ink-2)',
                    background: active ? 'var(--surface)' : 'transparent',
                    border: active ? '1px solid var(--line)' : '1px solid transparent',
                    boxShadow: active ? 'var(--shadow-sm)' : 'none',
                    marginBottom: 2, position: 'relative',
                  }}>
                    {active && <span style={{
                      position: 'absolute', left: -1, top: 7, bottom: 7, width: 2,
                      background: 'var(--brand-settings)', borderRadius: 2,
                    }}/>}
                    <Icon name={p.icon} size={15} style={{ color: active ? 'var(--brand-settings)' : 'var(--ink-3)' }}/>
                    {p.label}
                  </div>
                );
              })}
            </div>
          ))}
        </aside>
        <div>
          {pane === 'company'        && <CompanyPane       tweaks={tweaks} setTweak={setTweak}/>}
          {pane === 'catalog'        && <CatalogPane/>}
          {pane === 'estoque'        && <StockThresholdsPane/>}
          {pane === 'members'        && <MembersPane/>}
          {pane === 'roles'          && <RolesPane/>}
          {pane === 'billing'        && <BillingPane/>}
          {pane === 'integrations'   && <IntegrationsPane/>}
          {pane === 'audit'          && <AuditPane/>}
          {pane === 'profile'        && <ProfilePane tweaks={tweaks}/>}
          {pane === 'notifications'  && <NotificationsPane/>}
        </div>
      </div>
    </div>
  );
};

// ───────── Pane: Empresa ─────────
const CompanyPane = ({ tweaks, setTweak }) => (
  <div style={{ display: 'grid', gap: 18 }}>
    <Card title="Identidade da empresa" sub="Como sua empresa aparece para a equipe e em documentos.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="field">
          <label>Nome da empresa</label>
          <input value={tweaks.companyName} onChange={e => setTweak('companyName', e.target.value)}/>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>Exibido como <b>"{tweaks.companyName} por Orion"</b>.</div>
        </div>
        <div className="field">
          <label>Localidade padrão</label>
          <select><option>Português (Brasil)</option><option>English</option></select>
        </div>
        <div className="field">
          <label>CNPJ</label>
          <input defaultValue="38.402.119/0001-44"/>
        </div>
        <div className="field">
          <label>Endereço fiscal</label>
          <input defaultValue="R. Augusta, 1471 · Consolação · São Paulo, SP"/>
        </div>
      </div>
      <div className="field" style={{ marginTop: 4 }}>
        <label>Cor de destaque</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['#2563eb','#c2410c','#0f766e','#7e5bef','#b45309','#1f1b15'].map(c => (
            <button key={c} onClick={() => setTweak('accent', c)} aria-label={c} style={{
              width: 36, height: 36, borderRadius: 8, background: c, border: 0, cursor: 'pointer',
              boxShadow: tweaks.accent === c
                ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}`
                : 'inset 0 0 0 1px rgba(0,0,0,.08)',
              transition: 'box-shadow .15s',
            }}/>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>Aparece na sidebar, nos botões primários e nos relatórios em PDF.</div>
      </div>
    </Card>

    <Card title="Zona crítica" sub="Ações que afetam todos os dados da empresa.">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <div>
          <div style={{ color: 'var(--ink)', fontWeight: 500 }}>Exportar todos os dados</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Pedidos, fichas, estoque e movimentações — formato CSV.</div>
        </div>
        <button className="btn"><Icon name="download" size={13}/> Exportar</button>
      </div>
      <div style={{ height: 1, background: 'var(--line-soft)', margin: '12px 0' }}/>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
        <div>
          <div style={{ color: 'var(--err)', fontWeight: 500 }}>Apagar empresa</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Remove todos os dados após 30 dias. Esta ação é irreversível.</div>
        </div>
        <button className="btn" style={{ color: 'var(--err)', borderColor: 'color-mix(in oklab, var(--err) 30%, var(--line))' }}>
          <Icon name="trash-2" size={13}/> Solicitar exclusão
        </button>
      </div>
    </Card>
  </div>
);

// ───────── Pane: Membros ─────────
const MembersPane = () => (
  <Card title="Membros" sub={`${ORION_DATA.members.length} pessoas`}
        action={<button className="btn btn-primary"><Icon name="users" size={13}/> Convidar</button>} pad={false}>
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

// ───────── Pane: Auditoria ─────────
const AuditPane = () => (
  <Card title="Log de auditoria" sub="Últimos eventos no sistema" pad={false}
        action={<button className="btn"><Icon name="download" size={13}/> Exportar CSV</button>}>
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

// ───────── Pane: Funções ─────────
const PermCell = ({ kind }) => {
  const tiles = {
    all:  { icon: 'check',     color: 'var(--ok)',    bg: 'color-mix(in oklab, var(--ok) 14%, var(--surface))',     label: 'Pode editar' },
    view: { icon: 'eye',       color: 'var(--info)',  bg: 'color-mix(in oklab, var(--info) 12%, var(--surface))',   label: 'Apenas visualiza' },
    none: { icon: 'lock',      color: 'var(--ink-3)', bg: 'var(--surface-2)',                                       label: 'Sem acesso' },
  };
  const t = tiles[kind] || tiles.none;
  return (
    <span title={t.label} style={{
      display: 'inline-grid', placeItems: 'center',
      width: 24, height: 24, borderRadius: 6,
      background: t.bg,
      border: kind === 'none' ? '1px solid var(--line-soft)' : '1px solid transparent',
    }}>
      <Icon name={t.icon} size={13} strokeWidth={2.4} style={{ color: t.color, opacity: kind === 'none' ? .65 : 1 }}/>
    </span>
  );
};

const RolesPane = () => (
  <div style={{ display: 'grid', gap: 18 }}>
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
      {SETTINGS_DATA.roles.map((r, i) => {
        const tone = ['#7c5cff', '#0ea5e9', '#10b981'][i];
        return (
          <div key={r.id} className="card" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: tone }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <span style={{
                width: 30, height: 30, borderRadius: 8,
                background: `color-mix(in oklab, ${tone} 14%, var(--surface))`,
                color: tone, display: 'grid', placeItems: 'center',
              }}>
                <Icon name="shield" size={15} strokeWidth={2}/>
              </span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{r.name}</div>
              <span className="pill muted" style={{ marginLeft: 'auto' }}>{r.members} {r.members === 1 ? 'pessoa' : 'pessoas'}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55, marginTop: 10, textWrap: 'pretty' }}>{r.desc}</div>
          </div>
        );
      })}
    </div>

    <Card title="Matriz de permissões" sub="O que cada função pode fazer no sistema" pad={false}
          action={<button className="btn"><Icon name="shield" size={13}/> Criar função personalizada</button>}>
      <table className="tbl">
        <thead>
          <tr>
            <th style={{ width: '50%' }}>Capacidade</th>
            <th className="num" style={{ width: '16.66%' }}>Admin</th>
            <th className="num" style={{ width: '16.66%' }}>Gestor</th>
            <th className="num" style={{ width: '16.66%' }}>Operador</th>
          </tr>
        </thead>
        <tbody>
          {SETTINGS_DATA.permissions.map((grp, gi) => (
            <React.Fragment key={grp.group}>
              <SubTableRow label={grp.group} cols={4}/>
              {grp.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{it.label}</td>
                  <td className="num"><PermCell kind={it.admin}/></td>
                  <td className="num"><PermCell kind={it.manager}/></td>
                  <td className="num"><PermCell kind={it.operator}/></td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </Card>

    <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: 'var(--ink-3)', padding: '0 4px' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <PermCell kind="all"/> Pode editar
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <PermCell kind="view"/> Apenas visualiza
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <PermCell kind="none"/> Sem acesso
      </span>
    </div>
  </div>
);

// ───────── Pane: Assinatura ─────────
const BillingPane = () => {
  const p = SETTINGS_DATA.plan;
  const members = p.usage.find(u => u.label === 'Membros');
  const pct = Math.min(100, (members.value / members.max) * 100);
  const remaining = members.max - members.value;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Hero plan */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '24px 26px',
          background: 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 5%, var(--surface)) 0%, var(--surface) 100%)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 28%, transparent) 0%, transparent 70%)',
            opacity: .5, pointerEvents: 'none',
          }}/>
          <div className="page-eyebrow" style={{ color: 'var(--accent)', position: 'relative' }}>
            <span className="page-eyebrow-mark" style={{ background: 'var(--accent)' }}>
              <Icon name="sparkles" size={11} strokeWidth={2.2}/>
            </span>
            Plano atual
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8, position: 'relative' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 42, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1 }}>
              {p.name}
            </span>
            <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
              <Icon name="flask-conical" size={11}/> Beta privada
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, maxWidth: '60ch', position: 'relative' }}>
            Você faz parte do grupo inicial — cobrança ainda não está habilitada. Quando habilitarmos, avisaremos com bastante antecedência.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {/* Members usage */}
        <Card title="Uso da equipe" sub="Membros com acesso à sua conta">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 40, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {members.value}
            </span>
            <span style={{ fontSize: 14, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>
              de {members.max} pessoas
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: pct + '%', height: '100%', background: pct > 80 ? 'var(--warn)' : 'var(--accent)', transition: 'width .3s' }}/>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.5 }}>
            {remaining > 0
              ? <>Restam <b style={{ color: 'var(--ink-2)' }}>{remaining}</b> {remaining === 1 ? 'assento' : 'assentos'} disponíveis nesta conta.</>
              : <>Limite atingido — fale com a gente para liberar mais assentos.</>}
          </div>
        </Card>

        {/* Includes */}
        <Card title="O que está incluído" sub={`Recursos disponíveis no plano ${p.name}`}>
          {p.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i === p.features.length - 1 ? 0 : '1px solid var(--line-soft)' }}>
              <Icon name="check" size={14} strokeWidth={2.6} style={{ color: 'var(--ok)' }}/>
              <span style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>{f}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

// ───────── Pane: Integrações ─────────
const IntCard = ({ it }) => {
  const isConn = it.status === 'conectado';
  const initials = it.name.split(/\s+/).filter(w => w.length > 1).map(s => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: it.color, color: it.fg || 'white',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16,
          flexShrink: 0,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15), 0 2px 6px -2px rgba(31,27,21,.18)',
        }}>{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.005em' }}>{it.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{it.desc}</div>
        </div>
      </div>

      {isConn && it.stat && (
        <div style={{
          fontSize: 11.5, color: 'var(--ink-2)',
          padding: '7px 10px',
          background: 'var(--bg)',
          borderRadius: 6,
          borderLeft: '2px solid ' + it.color,
          fontVariantNumeric: 'tabular-nums',
        }}>{it.stat}</div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
        {isConn ? (
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--ok)', boxShadow: '0 0 0 3px color-mix(in oklab, var(--ok) 22%, transparent)' }}/>
            sincronizado {it.sync}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Não conectado</span>
        )}
        {isConn
          ? <button className="btn btn-sm btn-ghost"><Icon name="settings-2" size={12}/> Configurar</button>
          : <button className="btn btn-sm"><Icon name="plug" size={12}/> Conectar</button>}
      </div>
    </div>
  );
};

const IntegrationsPane = () => {
  const groups = ['Marketplaces', 'Logística', 'Comunicação', 'IA'];
  const all = SETTINGS_DATA.integrations;
  const totalConn = all.filter(i => i.status === 'conectado').length;
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
            <Icon name="plug-zap" size={17}/>
          </span>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{totalConn}</b> de <b style={{ fontVariantNumeric: 'tabular-nums' }}>{all.length}</b> integrações ativas
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Última sincronização geral há 3 min — tudo verde.</div>
          </div>
        </div>
        <button className="btn"><Icon name="refresh-cw" size={13}/> Sincronizar agora</button>
        <button className="btn"><Icon name="search" size={13}/> Explorar tudo</button>
      </div>

      {groups.map(g => {
        const items = all.filter(i => i.group === g);
        if (!items.length) return null;
        const active = items.filter(i => i.status === 'conectado').length;
        return (
          <div key={g}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, padding: '0 2px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)', fontWeight: 500 }}>{g}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--line-soft)' }}/>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{active} de {items.length} ativas</span>
            </div>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
              {items.map(it => <IntCard key={it.id} it={it}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ───────── Pane: Perfil ─────────
const ProfilePane = ({ tweaks }) => {
  const u = ORION_DATA.users[tweaks?.role || 'manager'];
  const [twofa, setTwofa] = React.useState(true);
  const [darkMode, setDarkMode] = React.useState(false);
  const emails = { admin: 'camila@underground.com', manager: 'felipe@underground.com', operator: 'joana@underground.com' };
  const roleTitles = { admin: 'Administradora', manager: 'Gerente de operações', operator: 'Operador de produção' };
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Card title="Perfil" sub="Como você aparece para o resto da equipe">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18, paddingBottom: 18, borderBottom: '1px solid var(--line-soft)' }}>
          <Av name={u.name} color={u.color} size={68}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{u.name}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{u.role} · {tweaks?.companyName || 'Underground'}</div>
          </div>
          <button className="btn"><Icon name="camera" size={13}/> Trocar foto</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>Nome completo</label><input defaultValue={u.name}/></div>
          <div className="field"><label>E-mail</label><input defaultValue={emails[tweaks?.role || 'manager']} type="email"/></div>
          <div className="field"><label>Telefone</label><input defaultValue="(11) 98123-4567"/></div>
          <div className="field"><label>Cargo</label><input defaultValue={roleTitles[tweaks?.role || 'manager']}/></div>
        </div>
      </Card>

      <Card title="Preferências">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field"><label>Idioma</label><select><option>Português (Brasil)</option><option>English (US)</option><option>Español</option></select></div>
          <div className="field"><label>Fuso horário</label><select><option>America/São_Paulo (GMT−3)</option><option>America/Manaus (GMT−4)</option></select></div>
          <div className="field"><label>Formato de data</label><select><option>DD/MM/AAAA</option><option>AAAA-MM-DD</option></select></div>
          <div className="field"><label>Primeiro dia da semana</label><select><option>Segunda-feira</option><option>Domingo</option></select></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 4px', borderTop: '1px solid var(--line-soft)', marginTop: 4 }}>
          <div>
            <div style={{ color: 'var(--ink)', fontWeight: 500 }}>Tema escuro</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Em breve — por enquanto só o modo papel, do jeito que confecção pede.</div>
          </div>
          <Toggle on={darkMode} onChange={setDarkMode}/>
        </div>
      </Card>

      <Card title="Segurança">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 14px', borderBottom: '1px solid var(--line-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center' }}>
              <Icon name="key-round" size={16}/>
            </span>
            <div>
              <div style={{ color: 'var(--ink)', fontWeight: 500 }}>Senha</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Última alteração há 47 dias</div>
            </div>
          </div>
          <button className="btn">Alterar senha</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: twofa ? 'color-mix(in oklab, var(--ok) 14%, var(--surface))' : 'var(--surface-2)', color: twofa ? 'var(--ok)' : 'var(--ink-2)', display: 'grid', placeItems: 'center' }}>
              <Icon name="shield-check" size={16}/>
            </span>
            <div>
              <div style={{ color: 'var(--ink)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                Autenticação em dois passos
                {twofa && <span className="pill ok"><Icon name="check" size={10} strokeWidth={2.6}/> Ativa</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Código por SMS no número <span style={{ fontFamily: 'var(--font-mono)' }}>(11) ••••-4567</span></div>
            </div>
          </div>
          <Toggle on={twofa} onChange={setTwofa}/>
        </div>
      </Card>

      <Card title="Sessões ativas" sub="Aparelhos com acesso à sua conta" pad={false}>
        <table className="tbl">
          <thead><tr><th>Aparelho</th><th>Navegador</th><th>Atividade</th><th></th></tr></thead>
          <tbody>
            {SETTINGS_DATA.sessions.map((s, i) => (
              <tr key={i}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--surface-2)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center' }}>
                      <Icon name={s.icon} size={14}/>
                    </span>
                    <div>
                      <div style={{ color: 'var(--ink)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {s.device}
                        {s.current && <span className="pill ok"><span className="pill-dot"/> Esta sessão</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{s.browser}</td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{s.when}</td>
                <td className="num">
                  {!s.current && <button className="btn btn-sm btn-ghost" style={{ color: 'var(--err)' }}>Encerrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// ───────── Pane: Notificações ─────────
const NotificationsPane = () => {
  const [prefs, setPrefs] = React.useState(SETTINGS_DATA.notifPrefs);
  const [digest, setDigest] = React.useState(true);
  const [dnd, setDnd] = React.useState(false);
  const toggle = (gi, ii, key) => {
    setPrefs(p => p.map((g, i) => i !== gi ? g : {
      ...g, items: g.items.map((it, j) => j !== ii ? it : { ...it, [key]: !it[key] }),
    }));
  };
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, background: 'color-mix(in oklab, var(--accent) 14%, var(--surface))', color: 'var(--accent)', borderRadius: 10, display: 'grid', placeItems: 'center' }}>
              <Icon name="sunrise" size={20}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>Resumo da manhã</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>E-mail diário às 8h com tudo que precisa de você.</div>
            </div>
            <Toggle on={digest} onChange={setDigest}/>
          </div>
          {digest && (
            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: 'var(--bg)', borderRadius: 8,
              fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55,
              fontStyle: 'italic',
              borderLeft: '2px solid var(--accent)',
            }}>
              Hoje: <b style={{ fontStyle: 'normal' }}>4 pedidos pendentes</b>, <b style={{ fontStyle: 'normal' }}>2 remessas em risco</b> e <b style={{ fontStyle: 'normal' }}>1 SKU em ruptura</b>.
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, background: dnd ? 'color-mix(in oklab, var(--warn) 14%, var(--surface))' : 'var(--surface-2)', color: dnd ? 'var(--warn)' : 'var(--ink-2)', borderRadius: 10, display: 'grid', placeItems: 'center' }}>
              <Icon name="moon" size={20}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>Não perturbe</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Pausa notificações fora do horário comercial.</div>
            </div>
            <Toggle on={dnd} onChange={setDnd}/>
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--ink-3)' }}>
            <span className="pill muted">Seg–Sex · 19h às 8h</span>
            <span className="pill muted">Sáb · Dom</span>
            <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>Editar horários</button>
          </div>
        </div>
      </div>

      <Card title="Notificações por evento" sub="Escolha como quer ser avisado para cada tipo de evento." pad={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: '52%' }}>Evento</th>
              <th className="num" style={{ width: '16%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', width: '100%' }}>
                  <Icon name="bell" size={11}/> No app
                </span>
              </th>
              <th className="num" style={{ width: '16%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', width: '100%' }}>
                  <Icon name="mail" size={11}/> E-mail
                </span>
              </th>
              <th className="num" style={{ width: '16%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', width: '100%' }}>
                  <Icon name="message-circle" size={11}/> WhatsApp
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {prefs.map((grp, gi) => (
              <React.Fragment key={grp.group}>
                <SubTableRow label={grp.group} cols={4}/>
                {grp.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--ink)', fontWeight: 500 }}>{it.label}</td>
                    <td className="num"><div style={{ display: 'inline-flex' }}><Toggle size="sm" on={it.inapp} onChange={() => toggle(gi, i, 'inapp')}/></div></td>
                    <td className="num"><div style={{ display: 'inline-flex' }}><Toggle size="sm" on={it.email} onChange={() => toggle(gi, i, 'email')}/></div></td>
                    <td className="num"><div style={{ display: 'inline-flex' }}><Toggle size="sm" on={it.whats} onChange={() => toggle(gi, i, 'whats')}/></div></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)', padding: '0 4px' }}>
        <Icon name="info" size={12}/>
        Notificações por WhatsApp usam sua integração WhatsApp Business — verifique o número em <span style={{ color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}>Integrações → WhatsApp</span>.
      </div>
    </div>
  );
};

// ───────── Pane: Catálogo (cores & tamanhos configuráveis) ─────────
const PaletteEditor = ({ colors, onChange, addLabel }) => {
  const update = (i, patch) => onChange(colors.map((c, j) => j === i ? { ...c, ...patch } : c));
  const remove = (i) => onChange(colors.filter((_, j) => j !== i));
  const add = () => onChange([...colors, { hex: '#cccccc', name: '' }]);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(216px, 1fr))', gap: 10 }}>
        {colors.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px 8px 10px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
            <label style={{ position: 'relative', width: 30, height: 30, borderRadius: 8, background: c.hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)', cursor: 'pointer', flexShrink: 0 }} title="Escolher cor">
              <input type="color" value={c.hex} onChange={e => update(i, { hex: e.target.value })} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0 }}/>
            </label>
            <input value={c.name} placeholder="Nome da cor" onChange={e => update(i, { name: e.target.value })}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit', outline: 'none', padding: 0 }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', flexShrink: 0 }}>{c.hex}</span>
            <button className="btn btn-ghost btn-sm" title="Remover" onClick={() => remove(i)} disabled={colors.length <= 1} style={{ padding: 5, color: 'var(--ink-3)', opacity: colors.length <= 1 ? 0.4 : 1, flexShrink: 0 }}><Icon name="x" size={14}/></button>
          </div>
        ))}
      </div>
      <button className="btn btn-sm" onClick={add} style={{ marginTop: 12 }}><Icon name="plus" size={13}/> {addLabel}</button>
    </div>
  );
};

const SizesEditor = ({ sizes, onChange }) => {
  const [val, setVal] = React.useState('');
  const add = () => { const v = val.trim().toUpperCase(); if (v && !sizes.includes(v)) onChange([...sizes, v]); setVal(''); };
  const remove = (s) => onChange(sizes.filter(x => x !== s));
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {sizes.map(s => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 5px 5px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--ink)' }}>
            {s}
            <button className="btn btn-ghost btn-sm" onClick={() => remove(s)} disabled={sizes.length <= 1} style={{ padding: 3, color: 'var(--ink-3)', opacity: sizes.length <= 1 ? 0.4 : 1 }} title="Remover"><Icon name="x" size={13}/></button>
          </span>
        ))}
        {!sizes.length && <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Nenhum tamanho — adicione ao menos um.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, maxWidth: 280, alignItems: 'center' }}>
        <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Ex: XG, 38, Único…"
          style={{ flex: 1, minWidth: 0, padding: '7px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', outline: 'none', appearance: 'none', WebkitAppearance: 'none', height: 34, boxSizing: 'border-box' }}/>
        <button className="btn" onClick={add} style={{ height: 34 }}><Icon name="plus" size={13}/> Adicionar</button>
      </div>
    </div>
  );
};

// ── Generic list-of-strings editor (tipos de tecido, aviamentos, técnicas) ──
const StringListEditor = ({ items, onChange, placeholder, addLabel, icon = 'plus' }) => {
  const update = (i, val) => onChange(items.map((x, j) => j === i ? val : x));
  const remove = (i) => onChange(items.filter((_, j) => j !== i));
  const add = () => onChange([...items, '']);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px 4px 6px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--surface)' }}>
            <span style={{ width: 22, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
            <input value={it} placeholder={placeholder} onChange={e => update(i, e.target.value)}
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontSize: 13, color: 'var(--ink)', fontFamily: 'inherit', outline: 'none', padding: '6px 0' }}/>
            <button className="btn btn-ghost btn-sm" title="Remover" onClick={() => remove(i)} disabled={items.length <= 1}
              style={{ padding: 5, color: 'var(--ink-3)', opacity: items.length <= 1 ? 0.4 : 1, flexShrink: 0 }}><Icon name="x" size={14}/></button>
          </div>
        ))}
      </div>
      <button className="btn btn-sm" onClick={add} style={{ marginTop: 12 }}><Icon name={icon} size={13}/> {addLabel}</button>
    </div>
  );
};

// Render a glyph from the catalog icon library at an arbitrary size.
const LibGlyph = ({ icon, size = 18 }) => {
  const lib = window.GARMENT_ICON_LIBRARY || {};
  const g = lib[icon] || lib.camiseta;
  return g ? React.cloneElement(g, { width: size, height: size, strokeWidth: 1.6 }) : <Icon name="shirt" size={size}/>;
};

// Inline icon chooser — shows the current glyph, expands to a grid of options.
const IconChooser = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const keys = Object.keys(window.GARMENT_ICON_LIBRARY || {});
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} title="Escolher ícone"
        style={{ width: 38, height: 38, borderRadius: 9, border: open ? '1.5px solid var(--accent)' : '1px solid var(--line)', background: open ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--ink)', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <LibGlyph icon={value} size={19}/>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }}/>
          <div style={{ position: 'absolute', top: 44, left: 0, zIndex: 41, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow-lg, 0 12px 32px -8px rgba(31,27,21,.22))', padding: 8, display: 'grid', gridTemplateColumns: 'repeat(6, 34px)', gap: 4, width: 'max-content' }}>
            {keys.map(k => {
              const active = k === value;
              return (
                <button key={k} type="button" onClick={() => { onChange(k); setOpen(false); }} title={k}
                  style={{ width: 34, height: 34, borderRadius: 8, border: active ? '1.5px solid var(--accent)' : '1px solid var(--line-soft)', background: active ? 'var(--accent-soft)' : 'var(--surface)', color: 'var(--ink-2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
                  <LibGlyph icon={k} size={17}/>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// Editor for the configurable "Tipo de peça" — icon + label + SKU prefix.
const GarmentTypesEditor = ({ types, onChange }) => {
  const update = (i, patch) => onChange(types.map((t, j) => j === i ? { ...t, ...patch } : t));
  const remove = (i) => onChange(types.filter((_, j) => j !== i));
  const add = () => onChange([...types, { id: 'tipo-' + Date.now().toString(36), label: '', skuPrefix: '', icon: 'shirt' }]);
  return (
    <div>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '38px 1fr 96px 30px', gap: 10, padding: '0 2px', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', fontWeight: 600 }}>
          <span>Ícone</span><span>Nome</span><span>SKU</span><span/>
        </div>
        {types.map((t, i) => (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '38px 1fr 96px 30px', gap: 10, alignItems: 'center' }}>
            <IconChooser value={t.icon} onChange={v => update(i, { icon: v })}/>
            <input value={t.label} placeholder="Ex: Camiseta" onChange={e => update(i, { label: e.target.value })}
              style={{ minWidth: 0, padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', outline: 'none', height: 38, boxSizing: 'border-box' }}/>
            <input value={t.skuPrefix} placeholder="CAM" maxLength={4}
              onChange={e => update(i, { skuPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
              style={{ minWidth: 0, padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: 12.5, letterSpacing: '.06em', outline: 'none', height: 38, boxSizing: 'border-box', textAlign: 'center' }}/>
            <button className="btn btn-ghost btn-sm" title="Remover" onClick={() => remove(i)} disabled={types.length <= 1}
              style={{ padding: 5, color: 'var(--ink-3)', opacity: types.length <= 1 ? 0.4 : 1 }}><Icon name="x" size={14}/></button>
          </div>
        ))}
      </div>
      <button className="btn btn-sm" onClick={add} style={{ marginTop: 12 }}><Icon name="plus" size={13}/> Adicionar tipo de peça</button>
    </div>
  );
};

// ───────── Pane: Estoque (avisos de estoque baixo) ─────────
const STOCK_TIERS = [
  { id: 'fabric',  label: 'Bobinas de tecido',        icon: 'layers',  where: 'Estoque › Bobinas de tecido', scope: 'por bobina',
    units: [{ id: 'pct', label: '%', suffix: '%' }, { id: 'kg', label: 'kg', suffix: 'kg' }] },
  { id: 'paper',   label: 'Bobinas de papel / filme', icon: 'scroll',  where: 'Estoque › Papel',             scope: 'por bobina',
    units: [{ id: 'pct', label: '%', suffix: '%' }, { id: 'm', label: 'm', suffix: 'm' }] },
  { id: 'blank',   label: 'Peças lisas',              icon: 'shirt',   where: 'Estoque › Peças lisas',       scope: 'por variação',
    units: [{ id: 'qty', label: 'un.', suffix: 'un.' }] },
  { id: 'printed', label: 'Impressos',                icon: 'palette', where: 'Estoque › Impressos',         scope: 'por estampa · lado',
    units: [{ id: 'qty', label: 'un.', suffix: 'un.' }] },
  { id: 'product', label: 'Produtos acabados',        icon: 'boxes',   where: 'Estoque › Produtos',          scope: 'por SKU',
    units: [{ id: 'qty', label: 'un.', suffix: 'un.' }] },
];

// Valor sugerido ao trocar a unidade de um estoque.
const STOCK_UNIT_DEFAULTS = {
  fabric:  { pct: 25, kg: 5 },
  paper:   { pct: 25, m: 30 },
  blank:   { qty: 20 },
  printed: { qty: 10 },
  product: { qty: 10 },
};

const stockSummary = (t, cur) => {
  if (!cur.enabled) return 'Sem aviso — este estoque não é acompanhado.';
  const u = t.units.find(x => x.id === cur.unit) || t.units[0];
  if (cur.unit === 'pct') return `Avisa abaixo de ${cur.value}% do saldo inicial · ${t.scope}`;
  return `Avisa abaixo de ${cur.value} ${u.label} restantes · ${t.scope}`;
};

const StockThresholdsPane = () => {
  const cfg = useCatalogConfig();
  const store = window.CatalogConfig;
  const th = cfg.stockThresholds || {};
  const setTier = (id, patch) => store.set({ ...cfg, stockThresholds: { ...th, [id]: { ...th[id], ...patch } } });

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Card title="Avisos de estoque baixo" sub="O Orion destaca o item e avisa quando o saldo cruza o limite definido aqui." pad={false}>
        <div>
          {STOCK_TIERS.map((t, i) => {
            const cur = th[t.id] || { enabled: true, unit: t.units[0].id, value: STOCK_UNIT_DEFAULTS[t.id][t.units[0].id] };
            const on = !!cur.enabled;
            const unit = t.units.find(u => u.id === cur.unit) || t.units[0];
            return (
              <div key={t.id} style={{ padding: '15px 18px', borderTop: i ? '1px solid var(--line-soft)' : 'none', opacity: on ? 1 : 0.78, transition: 'opacity .18s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ width: 38, height: 38, borderRadius: 9, background: on ? 'color-mix(in oklab, var(--brand-inv) 12%, var(--surface))' : 'var(--surface-2)', color: on ? 'var(--brand-inv)' : 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0, transition: 'background .18s, color .18s' }}>
                    <Icon name={t.icon} size={18} strokeWidth={1.7}/>
                  </span>
                  <div style={{ flex: 1, minWidth: 160, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 500, fontSize: 14 }}>{t.label}</span>
                    <span className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{t.where}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
                    {on ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {t.units.length > 1 && (
                          <Seg value={cur.unit} onChange={(u) => setTier(t.id, { unit: u, value: STOCK_UNIT_DEFAULTS[t.id][u] })}
                            options={t.units.map(u => ({ value: u.id, label: u.label }))}/>
                        )}
                        <div style={{ width: 118 }}>
                          <NumField value={cur.value} onChange={(v) => setTier(t.id, { value: v })}
                            step={unit.id === 'pct' ? 5 : 1} min={0} max={unit.id === 'pct' ? 100 : undefined}
                            decimals={0} suffix={unit.suffix} align="right"/>
                        </div>
                      </div>
                    ) : (
                      <span className="pill muted">Sem alerta</span>
                    )}
                    <Toggle on={on} onChange={(v) => setTier(t.id, { enabled: v })}/>
                  </div>
                </div>

                <div style={{ marginTop: 9, marginLeft: 52, fontSize: 12, color: on ? 'var(--ink-2)' : 'var(--ink-3)', textWrap: 'pretty', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {on
                    ? <Icon name="bell" size={11} style={{ color: 'var(--brand-inv)', flexShrink: 0 }}/>
                    : <Icon name="bell-off" size={11} style={{ color: 'var(--ink-3)', flexShrink: 0 }}/>}
                  {stockSummary(t, cur)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)', maxWidth: '62ch', textWrap: 'pretty' }}>
          <Icon name="info" size={12} style={{ flexShrink: 0 }}/> Desligar um estoque silencia os avisos de reposição dele em todo o Orion — útil para itens que sua confecção não mantém em estoque.
        </div>
        <button className="btn" onClick={() => store.set({ ...cfg, stockThresholds: JSON.parse(JSON.stringify(store.defaults.stockThresholds)) })} style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <Icon name="rotate-ccw" size={13}/> Restaurar padrão
        </button>
      </div>
    </div>
  );
};

const CatalogPane = () => {
  const cfg = useCatalogConfig();
  const store = window.CatalogConfig;
  const setPart = (key, val) => store.set({ ...cfg, [key]: val });
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Card title="Cores de tecidos" sub="Cores de material disponíveis ao criar um produto. Cada produto escolhe entre estas.">
        <PaletteEditor colors={cfg.productColors} onChange={v => setPart('productColors', v)} addLabel="Adicionar cor de tecido"/>
      </Card>

      <Card title="Cores de estampa" sub="Cores de tinta disponíveis para a arte aplicada — combinadas a cada cor de material no produto.">
        <PaletteEditor colors={cfg.printColors} onChange={v => setPart('printColors', v)} addLabel="Adicionar cor de estampa"/>
      </Card>

      <Card title="Tamanhos" sub="Grade de tamanhos que pode ser ativada nas variações de cada produto.">
        <SizesEditor sizes={cfg.sizes} onChange={v => setPart('sizes', v)}/>
      </Card>

      <Card title="Tipos de tecido" sub="Disponíveis ao receber bobinas em Estoque › Tecidos e na ficha técnica.">
        <StringListEditor items={cfg.fabricTypes} onChange={v => setPart('fabricTypes', v)}
          placeholder="Ex: Malha 100% algodão" addLabel="Adicionar tipo de tecido"/>
      </Card>

      <Card title="Tipos de peça" sub="Modelagens da ficha técnica. Cada uma tem um ícone e um prefixo de SKU.">
        <GarmentTypesEditor types={cfg.garmentTypes} onChange={v => setPart('garmentTypes', v)}/>
      </Card>

      <Card title="Aviamentos" sub="Itens que podem ser somados ao custo de uma ficha técnica.">
        <StringListEditor items={cfg.aviamentos} onChange={v => setPart('aviamentos', v)}
          placeholder="Ex: Etiqueta de composição" addLabel="Adicionar aviamento"/>
      </Card>

      <Card title="Técnicas de estampa" sub="Métodos de estampa disponíveis em Catálogo › Estampas.">
        <StringListEditor items={cfg.techniques} onChange={v => setPart('techniques', v)}
          placeholder="Ex: DTF, Silkscreen…" addLabel="Adicionar técnica"/>
      </Card>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
          <Icon name="info" size={12}/> As mudanças valem para novos produtos. Produtos existentes mantêm o que já foi salvo.
        </div>
        <button className="btn" onClick={() => store.reset()} style={{ marginLeft: 'auto' }}><Icon name="rotate-ccw" size={13}/> Restaurar padrão</button>
      </div>
    </div>
  );
};

Object.assign(window, { Settings });
