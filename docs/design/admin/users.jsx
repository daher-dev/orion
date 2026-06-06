// Orion Console — Console users (Orion's own team with backoffice access).
// NOT tenant org members — this manages who can sign into the platform admin.
// Depends on: ConsoleHead, Card, Av, Metric, Select, Icon, Sheet, CONSOLE.

const STAFF_STATUS = {
  ativo:     { kind: 'ok',   label: 'Ativo' },
  convidado: { kind: 'warn', label: 'Convite pendente' },
  suspenso:  { kind: 'err',  label: 'Acesso revogado' },
};
const StaffStatus = ({ s }) => {
  const m = STAFF_STATUS[s] || STAFF_STATUS.ativo;
  return <span className={`pill ${m.kind}`}><span className="pill-dot"/>{m.label}</span>;
};

const STAFF_ROLES = [
  { id: 'Proprietário',    desc: 'Controle total, incluindo cobrança e equipe Orion.', color: '#4f46e5' },
  { id: 'Admin',           desc: 'Gerencia organizações, usuários e planos.',          color: '#2563eb' },
  { id: 'Suporte',         desc: 'Acessa organizações e usuários para dar suporte.',    color: '#0f766e' },
  { id: 'Faturamento',     desc: 'Planos, faturas e cobranças.',                        color: '#b45309' },
  { id: 'Somente leitura', desc: 'Visualiza tudo, sem alterar.',                        color: '#78716c' },
];
const roleColor = (r) => (STAFF_ROLES.find(x => x.id === r) || {}).color || '#78716c';

const InviteStaffSheet = ({ open, onClose }) => {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState('Suporte');
  const sel = STAFF_ROLES.find(r => r.id === role);
  return (
    <Sheet open={open} onClose={onClose} title="Convidar para o console"
      sub="A pessoa receberá acesso à administração da plataforma Orion."
      footer={<>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onClose}><Icon name="send" size={13}/> Enviar convite</button>
      </>}>
      <div className="field">
        <label>E-mail corporativo</label>
        <input type="email" placeholder="nome@orion.app" value={email} onChange={e => setEmail(e.target.value)}/>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>Apenas e-mails <b>@orion.app</b> podem acessar o console.</div>
      </div>
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Nível de acesso</label>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {STAFF_ROLES.map(r => {
          const on = role === r.id;
          return (
            <div key={r.id} onClick={() => setRole(r.id)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 13px', cursor: 'default',
              border: `1px solid ${on ? r.color : 'var(--line)'}`, borderRadius: 10,
              background: on ? `color-mix(in oklab, ${r.color} 8%, var(--surface))` : 'var(--surface)',
            }}>
              <span style={{ width: 18, height: 18, borderRadius: 999, border: `2px solid ${on ? r.color : 'var(--line)'}`,
                display: 'grid', placeItems: 'center', marginTop: 1, flexShrink: 0 }}>
                {on && <span style={{ width: 8, height: 8, borderRadius: 999, background: r.color }}/>}
              </span>
              <div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{r.id}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 1 }}>{r.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, padding: '11px 13px', background: 'var(--accent-soft)', borderRadius: 9, display: 'flex', gap: 9, fontSize: 12, color: 'var(--ink-2)' }}>
        <Icon name="shield" size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}/>
        Exigiremos verificação em duas etapas no primeiro acesso de <b>{email || 'novo membro'}</b>.
      </div>
    </Sheet>
  );
};

const Users = () => {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('todos');
  const [role, setRole] = React.useState('todas');
  const [invite, setInvite] = React.useState(false);

  const staff = CONSOLE.staff;
  let rows = staff.filter(u => {
    if (status !== 'todos' && u.status !== status) return false;
    if (role !== 'todas' && u.role !== role) return false;
    if (q) {
      const hay = (u.name + ' ' + u.email + ' ' + u.role).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const nActive = staff.filter(u => u.status === 'ativo').length;
  const nInvited = staff.filter(u => u.status === 'convidado').length;
  const noTwofa = staff.filter(u => u.status === 'ativo' && !u.twofa).length;

  return (
    <div className="page">
      <ConsoleHead icon="users" color="#0f766e" eyebrow="Plataforma" title="Usuários" titleEm="do console"
        desc="A equipe Orion com acesso à administração da plataforma. Não confunda com os membros das organizações."
        actions={<button className="btn btn-primary" onClick={() => setInvite(true)}><Icon name="user-plus" size={13}/> Convidar para o console</button>}/>

      <div className="grid g-cols-4" style={{ marginBottom: 18 }}>
        <Metric label="Membros do console" value={staff.length} foot="equipe Orion"/>
        <Metric label="Ativos" value={nActive}/>
        <div className="kpi">
          <div className="kpi-label">Convites pendentes</div>
          <div className="kpi-value" style={{ color: nInvited ? 'var(--warn)' : 'var(--ink)' }}>{nInvited}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>aguardando aceite</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Sem 2FA</div>
          <div className="kpi-value" style={{ color: noTwofa ? 'var(--warn)' : 'var(--ok)' }}>{noTwofa}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{noTwofa ? 'exigir verificação' : 'todos protegidos'}</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'visible' }}>
        <div className="toolbar" style={{ overflow: 'visible' }}>
          <div className="tb-input" style={{ minWidth: 240 }}>
            <Icon name="search" size={13}/>
            <input placeholder="Buscar por nome, e-mail ou função…" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="seg">
            {[['todos','Todos'],['ativo','Ativos'],['convidado','Convidados'],['suspenso','Revogados']].map(([v, l]) => (
              <button key={v} className={status === v ? 'on' : ''} onClick={() => setStatus(v)}>{l}</button>
            ))}
          </div>
          <div style={{ width: 168, marginLeft: 'auto' }}>
            <Select value={role} onChange={setRole} searchable={false}
              options={[{ value: 'todas', label: 'Todas as funções' }, ...STAFF_ROLES.map(r => ({ value: r.id, label: r.id }))]}/>
          </div>
        </div>

        <table className="tbl">
          <thead>
            <tr><th>Membro</th><th>Função</th><th>Escopo de acesso</th><th>2FA</th><th>Status</th><th>Visto por último</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.email}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Av name={u.name} color={u.status === 'suspenso' ? '#a8a29e' : roleColor(u.role)}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: 'var(--ink)', fontWeight: 500, whiteSpace: 'nowrap' }}>{u.name}</div>
                      <div className="mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
                    <span className="pill-dot" style={{ background: roleColor(u.role), width: 7, height: 7, borderRadius: 999 }}/>
                    {u.role}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{u.scope}</td>
                <td>
                  {u.twofa
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ok)' }}><Icon name="shield-check" size={13}/> Ativo</span>
                    : u.status === 'convidado'
                      ? <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>—</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--warn)' }}><Icon name="shield-alert" size={13}/> Pendente</span>}
                </td>
                <td>
                  <StaffStatus s={u.status}/>
                  {u.status === 'convidado' && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>por {u.invitedBy} · {u.invited}</div>}
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{u.lastSeen}</td>
                <td className="num">
                  {u.status === 'convidado'
                    ? <button className="btn btn-sm btn-ghost"><Icon name="send" size={12}/> Reenviar</button>
                    : u.status === 'suspenso'
                      ? <button className="btn btn-sm btn-ghost" style={{ color: 'var(--ok)' }}><Icon name="rotate-ccw" size={12}/> Restaurar</button>
                      : u.role === 'Proprietário'
                        ? <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>você</span>
                        : <button className="btn btn-sm btn-ghost"><Icon name="more-horizontal" size={14}/></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <Empty icon="search-x" title="Nenhum membro" desc="Ajuste a busca ou os filtros."/>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)', padding: '14px 4px 0' }}>
        <Icon name="info" size={12}/>
        Procurando membros de uma organização cliente? Eles ficam dentro de cada <b style={{ color: 'var(--ink-2)' }}>organização</b>, na aba Equipe.
      </div>

      <InviteStaffSheet open={invite} onClose={() => setInvite(false)}/>
    </div>
  );
};

window.Users = Users;
