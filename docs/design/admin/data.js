// Orion Console — platform-level seed data (pt-BR).
// This is Orion's OWN admin view across every tenant org. Distinct from
// ORION_DATA (which is a single tenant's data).

const CONSOLE = {
  // ───────── Plans ─────────
  plans: [
    { id: 'gratis',  name: 'Grátis',  price: 0,   color: 'var(--plan-gratis)',  tagline: 'Para testar a operação',
      limits: { membros: '2', pedidos: '50/mês', integracoes: '1', armazenamento: '1 GB' } },
    { id: 'atelie',  name: 'Ateliê',  price: 79,  color: 'var(--plan-atelie)',  tagline: 'Marcas pequenas e ateliês',
      limits: { membros: '5', pedidos: '500/mês', integracoes: '3', armazenamento: '5 GB' } },
    { id: 'pro',     name: 'Pro',     price: 149, color: 'var(--plan-pro)',     tagline: 'Confecções em crescimento',
      limits: { membros: '10', pedidos: '5.000/mês', integracoes: '8', armazenamento: '10 GB' } },
    { id: 'fabrica', name: 'Fábrica', price: 349, color: 'var(--plan-fabrica)', tagline: 'Alto volume e múltiplas bancas',
      limits: { membros: 'Ilimitado', pedidos: 'Ilimitado', integracoes: 'Todas', armazenamento: '50 GB' } },
  ],

  // ───────── Organizations (tenants) ─────────
  orgs: [
    { id: 'o-underground', name: 'Underground', accent: '#2563eb', city: 'São Paulo, SP', plan: 'pro', status: 'ativa',
      owner: { name: 'Camila Borges', email: 'camila@underground.com' },
      members: 5, seats: 10, ordersMo: 312, ordersCap: 5000, mrr: 149, created: '14/03/2024', lastActive: 'agora',
      integrations: ['shopee','ml','shopify','correios','whatsapp','claude'], note: '' },
    { id: 'o-marealta', name: 'Maré Alta', accent: '#0f766e', city: 'Florianópolis, SC', plan: 'pro', status: 'ativa',
      owner: { name: 'Rodrigo Lemos', email: 'rodrigo@marealta.com.br' },
      members: 8, seats: 10, ordersMo: 488, ordersCap: 5000, mrr: 149, created: '02/06/2024', lastActive: 'há 6 min',
      integrations: ['shopee','ml','correios','melhorenvio','whatsapp'], note: '' },
    { id: 'o-oficina12', name: 'Oficina 12', accent: '#c2410c', city: 'Belo Horizonte, MG', plan: 'fabrica', status: 'ativa',
      owner: { name: 'Tiago Andrade', email: 'tiago@oficina12.com' },
      members: 17, seats: 999, ordersMo: 2140, ordersCap: 999999, mrr: 349, created: '21/11/2023', lastActive: 'há 2 min',
      integrations: ['shopee','ml','shopify','instagram','correios','bling','melhorenvio','whatsapp','claude'], note: '' },
    { id: 'o-raiz', name: 'Raiz Streetwear', accent: '#7e5bef', city: 'Recife, PE', plan: 'atelie', status: 'ativa',
      owner: { name: 'Bianca Nunes', email: 'bianca@raiz.st' },
      members: 4, seats: 5, ordersMo: 196, ordersCap: 500, mrr: 79, created: '08/01/2025', lastActive: 'há 1h',
      integrations: ['shopee','instagram','whatsapp'], note: '' },
    { id: 'o-bossa', name: 'Bossa Atelier', accent: '#b45309', city: 'Rio de Janeiro, RJ', plan: 'pro', status: 'inadimplente',
      owner: { name: 'Letícia Prado', email: 'leticia@bossa.com.br' },
      members: 6, seats: 10, ordersMo: 274, ordersCap: 5000, mrr: 149, created: '30/04/2024', lastActive: 'há 3 dias',
      integrations: ['ml','shopify','correios','whatsapp'], note: 'Fatura de maio recusada — cartão expirado.' },
    { id: 'o-norteasul', name: 'Norte a Sul', accent: '#1e40af', city: 'Porto Alegre, RS', plan: 'atelie', status: 'ativa',
      owner: { name: 'Gustavo Reis', email: 'gustavo@norteasul.com' },
      members: 3, seats: 5, ordersMo: 142, ordersCap: 500, mrr: 79, created: '17/09/2024', lastActive: 'há 4h',
      integrations: ['shopee','ml','correios'], note: '' },
    { id: 'o-capimsanto', name: 'Capim Santo', accent: '#15803d', city: 'Salvador, BA', plan: 'fabrica', status: 'ativa',
      owner: { name: 'Marina Teixeira', email: 'marina@capimsanto.com.br' },
      members: 22, seats: 999, ordersMo: 3180, ordersCap: 999999, mrr: 349, created: '05/07/2023', lastActive: 'há 11 min',
      integrations: ['shopee','ml','shopify','instagram','correios','bling','melhorenvio','whatsapp','claude'], note: '' },
    { id: 'o-vertice', name: 'Vértice', accent: '#9333ea', city: 'Curitiba, PR', plan: 'pro', status: 'ativa',
      owner: { name: 'Paulo Cardoso', email: 'paulo@vertice.com' },
      members: 7, seats: 10, ordersMo: 401, ordersCap: 5000, mrr: 149, created: '12/02/2024', lastActive: 'há 27 min',
      integrations: ['ml','shopify','correios','melhorenvio','whatsapp'], note: '' },
    { id: 'o-lapa9', name: 'Lapa 9', accent: '#be123c', city: 'São Paulo, SP', plan: 'atelie', status: 'trial',
      owner: { name: 'Sofia Martins', email: 'sofia@lapa9.com.br' },
      members: 2, seats: 5, ordersMo: 38, ordersCap: 500, mrr: 0, created: '24/05/2026', lastActive: 'há 2h', trialEndsIn: 6,
      integrations: ['shopee','whatsapp'], note: 'Trial termina em 6 dias.' },
    { id: 'o-costuracoletiva', name: 'Costura Coletiva', accent: '#0891b2', city: 'Fortaleza, CE', plan: 'atelie', status: 'ativa',
      owner: { name: 'André Fontes', email: 'andre@costuracoletiva.org' },
      members: 5, seats: 5, ordersMo: 312, ordersCap: 500, mrr: 79, created: '19/10/2024', lastActive: 'há 50 min',
      integrations: ['shopee','ml','instagram','correios','whatsapp'], note: 'Uso de assentos no limite (5/5).' },
    { id: 'o-brava', name: 'Brava Moda', accent: '#ca8a04', city: 'Goiânia, GO', plan: 'gratis', status: 'trial',
      owner: { name: 'Renata Dias', email: 'renata@bravamoda.com' },
      members: 1, seats: 2, ordersMo: 21, ordersCap: 50, mrr: 0, created: '27/05/2026', lastActive: 'há 5h', trialEndsIn: 12,
      integrations: ['instagram'], note: '' },
    { id: 'o-ferroelinha', name: 'Ferro & Linha', accent: '#4d7c0f', city: 'Campinas, SP', plan: 'pro', status: 'pausada',
      owner: { name: 'Henrique Sales', email: 'henrique@ferroelinha.com' },
      members: 6, seats: 10, ordersMo: 0, ordersCap: 5000, mrr: 0, created: '11/08/2024', lastActive: 'há 21 dias',
      integrations: ['ml','correios'], note: 'Conta pausada pelo titular — retomada agendada.' },
    { id: 'o-selvagem', name: 'Selvagem', accent: '#db2777', city: 'São Paulo, SP', plan: 'gratis', status: 'trial',
      owner: { name: 'Yuri Campos', email: 'yuri@selvagem.shop' },
      members: 1, seats: 2, ordersMo: 9, ordersCap: 50, mrr: 0, created: '29/05/2026', lastActive: 'há 1 dia', trialEndsIn: 14,
      integrations: [], note: '' },
    { id: 'o-donaonca', name: 'Dona Onça', accent: '#ea580c', city: 'Belo Horizonte, MG', plan: 'atelie', status: 'inadimplente',
      owner: { name: 'Cláudia Moraes', email: 'claudia@donaonca.com.br' },
      members: 4, seats: 5, ordersMo: 158, ordersCap: 500, mrr: 79, created: '03/03/2025', lastActive: 'há 8 dias',
      integrations: ['shopee','ml','whatsapp'], note: 'Fatura em atraso há 9 dias — 2ª tentativa de cobrança.' },
  ],

  // ───────── Orion's OWN team — who can access this console ─────────
  // The Users page manages THESE people (platform admins), not tenant org members.
  staff: [
    { name: 'Você',            email: 'voce@orion.app',     role: 'Proprietário',    status: 'ativo',     lastSeen: 'agora',      twofa: true,  scope: 'Tudo' },
    { name: 'Marcos Vianna',   email: 'marcos@orion.app',   role: 'Admin',           status: 'ativo',     lastSeen: 'há 22 min',  twofa: true,  scope: 'Tudo' },
    { name: 'Ana Beatriz',     email: 'ana@orion.app',      role: 'Admin',           status: 'ativo',     lastSeen: 'há 1h',      twofa: true,  scope: 'Tudo' },
    { name: 'Rafael Quintela',  email: 'rafael@orion.app',   role: 'Suporte',         status: 'ativo',     lastSeen: 'há 3h',      twofa: true,  scope: 'Organizações · Usuários' },
    { name: 'Priscila Gomes',  email: 'priscila@orion.app', role: 'Suporte',         status: 'ativo',     lastSeen: 'há 5h',      twofa: false, scope: 'Organizações · Usuários' },
    { name: 'Eduardo Lima',    email: 'eduardo@orion.app',  role: 'Faturamento',     status: 'ativo',     lastSeen: 'ontem',      twofa: true,  scope: 'Planos · Cobrança' },
    { name: 'Helena Castro',   email: 'helena@orion.app',   role: 'Somente leitura', status: 'ativo',     lastSeen: 'há 2 dias',  twofa: false, scope: 'Leitura' },
    { name: 'Bruno Tavares',   email: 'bruno@orion.app',    role: 'Suporte',         status: 'convidado', lastSeen: '—',          twofa: false, scope: 'Organizações · Usuários', invitedBy: 'Você', invited: 'há 2 dias' },
    { name: 'Larissa Pinto',   email: 'larissa@orion.app',  role: 'Faturamento',     status: 'convidado', lastSeen: '—',          twofa: false, scope: 'Planos · Cobrança',      invitedBy: 'Marcos Vianna', invited: 'há 6 dias' },
    { name: 'Otávio Ramos',    email: 'otavio@orion.app',   role: 'Admin',           status: 'suspenso',  lastSeen: 'há 40 dias', twofa: true,  scope: 'Tudo', note: 'Acesso revogado — desligamento.' },
  ],

  // Orgs where the signed-in admin ALSO has a real user account (they can
  // hop into these as themselves — shown in the top-left switcher).
  myOrgIds: ['o-underground', 'o-marealta'],

  // ───────── People across all orgs ─────────
  users: [
    { name: 'Camila Borges',  email: 'camila@underground.com',     org: 'o-underground',      role: 'Admin',    status: 'ativo',     lastSeen: 'agora' },
    { name: 'Rafael Mendes',  email: 'rafael@underground.com',     org: 'o-underground',      role: 'Gestor',   status: 'ativo',     lastSeen: 'há 12 min' },
    { name: 'Joana Pires',    email: 'joana@underground.com',      org: 'o-underground',      role: 'Operador', status: 'ativo',     lastSeen: 'há 1h' },
    { name: 'Rodrigo Lemos',  email: 'rodrigo@marealta.com.br',    org: 'o-marealta',         role: 'Admin',    status: 'ativo',     lastSeen: 'há 6 min' },
    { name: 'Priscila Maia',  email: 'priscila@marealta.com.br',   org: 'o-marealta',         role: 'Gestor',   status: 'ativo',     lastSeen: 'há 2h' },
    { name: 'Tiago Andrade',  email: 'tiago@oficina12.com',        org: 'o-oficina12',        role: 'Admin',    status: 'ativo',     lastSeen: 'há 2 min' },
    { name: 'Núbia Carvalho', email: 'nubia@oficina12.com',        org: 'o-oficina12',        role: 'Gestor',   status: 'ativo',     lastSeen: 'há 35 min' },
    { name: 'Bianca Nunes',   email: 'bianca@raiz.st',             org: 'o-raiz',             role: 'Admin',    status: 'ativo',     lastSeen: 'há 1h' },
    { name: 'Diego Farias',   email: 'diego@raiz.st',              org: 'o-raiz',             role: 'Operador', status: 'convidado', lastSeen: '—', invitedBy: 'Bianca Nunes', invited: 'há 2 dias' },
    { name: 'Letícia Prado',  email: 'leticia@bossa.com.br',       org: 'o-bossa',            role: 'Admin',    status: 'ativo',     lastSeen: 'há 3 dias' },
    { name: 'Gustavo Reis',   email: 'gustavo@norteasul.com',      org: 'o-norteasul',        role: 'Admin',    status: 'ativo',     lastSeen: 'há 4h' },
    { name: 'Marina Teixeira',email: 'marina@capimsanto.com.br',   org: 'o-capimsanto',       role: 'Admin',    status: 'ativo',     lastSeen: 'há 11 min' },
    { name: 'Wesley Aragão',  email: 'wesley@capimsanto.com.br',   org: 'o-capimsanto',       role: 'Operador', status: 'suspenso',  lastSeen: 'há 30 dias', note: 'Suspenso por solicitação do admin.' },
    { name: 'Paulo Cardoso',  email: 'paulo@vertice.com',          org: 'o-vertice',          role: 'Admin',    status: 'ativo',     lastSeen: 'há 27 min' },
    { name: 'Sofia Martins',  email: 'sofia@lapa9.com.br',         org: 'o-lapa9',            role: 'Admin',    status: 'ativo',     lastSeen: 'há 2h' },
    { name: 'André Fontes',   email: 'andre@costuracoletiva.org',  org: 'o-costuracoletiva',  role: 'Admin',    status: 'ativo',     lastSeen: 'há 50 min' },
    { name: 'Renata Dias',    email: 'renata@bravamoda.com',       org: 'o-brava',            role: 'Admin',    status: 'ativo',     lastSeen: 'há 5h' },
    { name: 'Cláudia Moraes', email: 'claudia@donaonca.com.br',    org: 'o-donaonca',         role: 'Admin',    status: 'ativo',     lastSeen: 'há 8 dias' },
    { name: 'Vitor Hugo',     email: 'vitor@donaonca.com.br',      org: 'o-donaonca',         role: 'Gestor',   status: 'convidado', lastSeen: '—', invitedBy: 'Cláudia Moraes', invited: 'há 5 dias' },
    { name: 'Yuri Campos',    email: 'yuri@selvagem.shop',         org: 'o-selvagem',         role: 'Admin',    status: 'ativo',     lastSeen: 'há 1 dia' },
  ],

  // ───────── Platform integrations health (aggregated across orgs) ─────────
  integrations: [
    { id: 'shopee',      name: 'Shopee',           group: 'Marketplaces', color: '#ee4d2d',               orgs: 9, status: 'operacional', uptime: 99.98, latency: 240, eventsToday: 4820, errorRate: 0.1 },
    { id: 'ml',          name: 'Mercado Livre',    group: 'Marketplaces', color: '#fff159', fg: '#1f1f1f', orgs: 11, status: 'degradado',  uptime: 99.20, latency: 910, eventsToday: 6110, errorRate: 1.8, incident: 'Latência elevada na API de pedidos.' },
    { id: 'shopify',     name: 'Shopify',          group: 'Marketplaces', color: '#7ab55c',               orgs: 5, status: 'operacional', uptime: 99.99, latency: 180, eventsToday: 1940, errorRate: 0.0 },
    { id: 'instagram',   name: 'Instagram Shop',   group: 'Marketplaces', color: '#d6249f',               orgs: 5, status: 'operacional', uptime: 99.90, latency: 320, eventsToday: 820, errorRate: 0.3 },
    { id: 'correios',    name: 'Correios',         group: 'Logística',    color: '#fcb900', fg: '#1f1f1f', orgs: 10, status: 'incidente',  uptime: 97.40, latency: 1850, eventsToday: 2240, errorRate: 6.2, incident: 'Cálculo de frete intermitente — fila com reprocessamento.' },
    { id: 'bling',       name: 'Bling ERP',        group: 'Logística',    color: '#1e88e5',               orgs: 2, status: 'operacional', uptime: 99.95, latency: 410, eventsToday: 612, errorRate: 0.2 },
    { id: 'melhorenvio', name: 'Melhor Envio',     group: 'Logística',    color: '#0fb9b1',               orgs: 4, status: 'operacional', uptime: 99.97, latency: 290, eventsToday: 1310, errorRate: 0.1 },
    { id: 'whatsapp',    name: 'WhatsApp Business', group: 'Comunicação', color: '#25d366',               orgs: 10, status: 'operacional', uptime: 99.96, latency: 210, eventsToday: 9870, errorRate: 0.2 },
    { id: 'claude',      name: 'Claude (IA)',      group: 'IA',           color: '#c66a2c',               orgs: 3, status: 'operacional', uptime: 99.99, latency: 640, eventsToday: 1480, errorRate: 0.0 },
  ],

  // ───────── MRR by month (last 12, R$) ─────────
  mrrSeries: [
    { m: 'jul', v: 760 },  { m: 'ago', v: 820 },  { m: 'set', v: 910 },
    { m: 'out', v: 980 },  { m: 'nov', v: 1080 }, { m: 'dez', v: 1180 },
    { m: 'jan', v: 1280 }, { m: 'fev', v: 1360 }, { m: 'mar', v: 1450 },
    { m: 'abr', v: 1520 }, { m: 'mai', v: 1580 }, { m: 'jun', v: 1610 },
  ],

  // ───────── Recent platform-admin actions ─────────
  audit: [
    { when: 'há 8 min',  who: 'Você',          action: 'org.impersonate', target: 'Capim Santo',  note: 'sessão de suporte · 14 min' },
    { when: 'há 1h',     who: 'Você',          action: 'plan.change',     target: 'Vértice',       note: 'Ateliê → Pro' },
    { when: 'há 3h',     who: 'Marcos (Orion)',action: 'invoice.retry',   target: 'Bossa Atelier', note: '2ª tentativa de cobrança' },
    { when: 'há 1 dia',  who: 'Você',          action: 'org.suspend_user',target: 'Capim Santo',   note: 'Wesley Aragão' },
    { when: 'há 2 dias', who: 'Ana (Orion)',   action: 'org.create',      target: 'Lapa 9',        note: 'trial · plano Ateliê' },
  ],
};

// Helpers
CONSOLE.planById = (id) => CONSOLE.plans.find(p => p.id === id);
CONSOLE.orgById = (id) => CONSOLE.orgs.find(o => o.id === id);

window.CONSOLE = CONSOLE;
