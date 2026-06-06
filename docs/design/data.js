// Seed data for Orion prototype — pt-BR

const ORION_DATA = {
  company: {
    name: "Underground",
    location: "São Paulo, SP",
    founded: "2021",
  },

  users: {
    admin:    { name: "Camila Borges",   role: "Admin",    initials: "CB", color: "#7c5cff" },
    manager:  { name: "Felipe",          role: "Gestor",   initials: "F",  color: "#0ea5e9" },
    operator: { name: "Joana Pires",     role: "Operador", initials: "JP", color: "#10b981" },
  },

  // KPI snapshot for the dashboard
  kpis: {
    pendingOrders:     { value: 47,  delta: +12.4, label: "Pedidos pendentes",   spark: [3,5,4,6,8,7,9,11,10,12] },
    cuttingInProgress: { value: 8,   delta: -3.1,  label: "Cortes em andamento", spark: [10,9,11,8,9,7,8,6,7,8] },
    sewingOut:         { value: 14,  delta: +5.0,  label: "Em bancas",           spark: [11,12,11,13,12,14,13,14,14,14] },
    lowStock:          { value: 6,   delta: +1.0,  label: "SKUs em ruptura",     spark: [2,3,2,4,3,5,4,5,6,6] },
    revenue30d:        { value: "R$ 184.530", delta: +18.2, label: "Receita 30d", spark: [120,140,135,160,155,170,175,180,178,184] },
  },

  // Conferência (order-checking) — the operational core the client tracks daily.
  // Real-time snapshot of today's batch of imported orders being conferred.
  conference: {
    totals: { orders: 859, items: 1077, mappedPct: 100, pending: 0 },
    progress: {
      ordersDone: 486, ordersTotal: 859,   // pedidos 100% conferidos
      piecesDone: 612, piecesTotal: 1077,   // peças conferidas
      partial: 23,                           // pedidos parcialmente conferidos
      problems: 5,                           // divergências encontradas
      toCheck: 350,                          // ainda sem nenhuma peça conferida
    },
    topProducts: [
      { rank: 1, code: "2055",             name: "Camiseta 2055",      pieces: 175, orders: 152, tone: "moss"  },
      { rank: 2, code: "2047",             name: "Camiseta 2047",      pieces: 94,  orders: 87,  tone: "stone" },
      { rank: 3, code: "Punisher",         name: "Bermuda Punisher",   pieces: 63,  orders: 53,  tone: "bone"  },
      { rank: 4, code: "Jiu Jitsu Shopee", name: "Bermuda Jiu Jitsu",  pieces: 37,  orders: 29,  tone: "sand"  },
      { rank: 5, code: "2303",             name: "Camiseta 2303",      pieces: 31,  orders: 10,  tone: "warm"  },
    ],
    // Relatório de Pedidos — order-level breakdown, each metric drills into a filtered list.
    report: [
      { key: "orders",  label: "Pedidos",   value: 859,  icon: "file-text",       color: "var(--accent)",       to: "orders" },
      { key: "pieces",  label: "Peças",     value: 1077, icon: "package",         color: "var(--brand-catalog)", to: "orders" },
      { key: "mapped",  label: "Mapeadas",  value: 1077, icon: "tag",             color: "var(--ok)",            to: "prints" },
      { key: "pending", label: "Pendentes", value: 0,    icon: "alert-circle",    color: "var(--warn)",          to: "prints" },
      { key: "done",    label: "Conferidos",value: 486,  icon: "check-circle-2",  color: "var(--ok)",            to: "orders" },
      { key: "tocheck", label: "A conferir",value: 373,  icon: "clock",           color: "var(--ink-3)",         to: "orders" },
      { key: "inbatch", label: "Em lote",   value: 101,  icon: "boxes",           color: "var(--brand-catalog)", to: "orders" },
      { key: "nobatch", label: "Sem lote",  value: 758,  icon: "box",             color: "var(--ink-3)",         to: "orders" },
    ],
  },

  // Pipeline counts
  pipeline: [
    { stage: "Pedidos",  short: "Aguardando produção",       count: 47, color: "var(--brand-sales)" },
    { stage: "Corte",    short: "Em corte ou aguardando",    count: 18, color: "var(--brand-prod)" },
    { stage: "Costura",  short: "Em bancas",                 count: 32, color: "var(--brand-prod)" },
    { stage: "Estoque",  short: "Prontas p/ envio",          count: 286, color: "var(--brand-inv)" },
    { stage: "Enviadas", short: "Últimos 7 dias",            count: 119, color: "var(--brand-sales)" },
  ],

  needsAction: [
    { kind: "order",    text: "8 pedidos sem ordem de corte vinculada", since: "há 2h", to: "orders" },
    { kind: "fabric",   text: "Bobina BB-022 (Moletom 320g) abaixo de 5kg", since: "há 4h", to: "fabric" },
    { kind: "shipment", text: "Remessa SW-118 atrasada na Banca Dona Lúcia (3 dias)", since: "há 1d", to: "sewing" },
    { kind: "stock",    text: "SKU CRP-OVS-PRT-M em ruptura", since: "há 6h", to: "stock" },
  ],

  activity: [
    { who: "Rafael Mendes", what: "marcou pedido", target: "#10482", verb: "como pago",        when: "há 3 min" },
    { who: "Joana Pires",   what: "registrou saída de", target: "CO-209", verb: "(48 peças)",  when: "há 22 min" },
    { who: "Sistema",       what: "importou",       target: "12 pedidos do Shopee",            when: "há 45 min" },
    { who: "Camila Borges", what: "atualizou ficha", target: "FT-014 Cropped Oversized", verb: "(custo CMT)", when: "há 1h" },
    { who: "Rafael Mendes", what: "criou remessa", target: "SW-122 → Banca Esperança",         when: "há 2h" },
    { who: "Joana Pires",   what: "recebeu remessa", target: "SW-115", verb: "(parcial 38/50)", when: "há 3h" },
  ],

  // Sales channels
  channels: {
    shopee:   { name: "Shopee",        color: "#ee4d2d", short: "SH" },
    ml:       { name: "Mercado Livre", color: "#fff159", fg: "#1f1f1f", short: "ML" },
    shopify:  { name: "Shopify",       color: "#7ab55c", short: "SP" },
    instagram:{ name: "Instagram",     color: "#d6249f", short: "IG" },
    whatsapp: { name: "WhatsApp",      color: "#25d366", short: "WA" },
  },

  orders: [
    { id: "10487", ext: "SH-99812", channel: "shopee", client: "Mariana Costa", status: "pendente", placedAt: "07/05 14:22",
      items: [
        { productId: "p-101", product: "Cropped Oversized", variant: "Preto · M",   qty: 2, price: 99.00, thumb: "warm" },
        { productId: "p-104", product: "T-Shirt Box",       variant: "Branco · M",  qty: 1, price: 79.00, thumb: "bone" },
      ] },
    { id: "10486", ext: "ML-44120", channel: "ml", client: "Felipe Andrade", status: "pago", placedAt: "07/05 11:08",
      items: [
        { productId: "p-102", product: "Camisa Linho", variant: "Areia · G", qty: 1, price: 249.90, thumb: "sand" },
      ] },
    { id: "10485", ext: "WA-002", channel: "whatsapp", client: "Beatriz Rocha", status: "enviado", placedAt: "06/05 17:55",
      items: [
        { productId: "p-103", product: "Moletom Vintage", variant: "Verde · GG", qty: 3, price: 179.00, thumb: "moss" },
      ] },
    { id: "10484", ext: "SP-77231", channel: "shopify", client: "Lucas Pereira", status: "entregue", placedAt: "06/05 10:02",
      items: [
        { productId: "p-104", product: "T-Shirt Box",     variant: "Branco · P", qty: 5, price: 79.00, thumb: "bone" },
        { productId: "p-105", product: "Tote Bag Algodão", variant: "Cru · U",   qty: 2, price: 59.00, thumb: "stone" },
      ] },
    { id: "10483", ext: "IG-DM-018", channel: "instagram", client: "Aline Souza", status: "pendente", placedAt: "05/05 22:14",
      items: [
        { productId: "p-101", product: "Cropped Oversized", variant: "Marrom · M", qty: 1, price: 99.00, thumb: "warm" },
      ] },
    { id: "10482", ext: "SH-99751", channel: "shopee", client: "Pedro Henrique", status: "pago", placedAt: "05/05 19:30",
      items: [
        { productId: "p-102", product: "Camisa Linho",     variant: "Off-white · M", qty: 2, price: 249.90, thumb: "sand" },
        { productId: "p-101", product: "Cropped Oversized", variant: "Areia · M",   qty: 1, price: 99.00,  thumb: "warm" },
        { productId: "p-104", product: "T-Shirt Box",       variant: "Preto · G",   qty: 1, price: 79.00,  thumb: "bone" },
      ] },
  ],

  clients: [
    { id: "c-301", name: "Mariana Costa",  city: "São Paulo, SP",   firstChannel: "shopee",    orders: 12, lifetime: 2_840.00, tags: ["VIP"] },
    { id: "c-302", name: "Felipe Andrade", city: "Curitiba, PR",    firstChannel: "ml",        orders: 4,  lifetime:   910.00, tags: [] },
    { id: "c-303", name: "Beatriz Rocha",  city: "Rio de Janeiro, RJ", firstChannel: "whatsapp", orders: 7, lifetime: 1_540.00, tags: ["recorrente"] },
    { id: "c-304", name: "Lucas Pereira",  city: "Belo Horizonte, MG", firstChannel: "shopify",  orders: 9, lifetime: 1_810.00, tags: ["atacado"] },
    { id: "c-305", name: "Aline Souza",    city: "Salvador, BA",    firstChannel: "instagram", orders: 2,  lifetime:   220.00, tags: [] },
  ],

  ads: [
    { id: "a-12", channel: "shopee",   title: "Cropped Oversized Verão 2026", product: "Cropped Oversized", status: "ativo",   orders30d: 38 },
    { id: "a-13", channel: "ml",       title: "Camisa Linho Premium",          product: "Camisa Linho",      status: "ativo",   orders30d: 21 },
    { id: "a-14", channel: "shopify",  title: "T-Shirt Box Essentials",        product: "T-Shirt Box",       status: "pausado", orders30d:  4 },
    { id: "a-15", channel: "instagram",title: "Drop Outono — Moletom",         product: "Moletom Vintage",   status: "ativo",   orders30d: 17 },
    { id: "a-16", channel: "whatsapp", title: "Catálogo VIP",                  product: "Múltiplos",         status: "ativo",   orders30d: 12 },
  ],

  products: [
    { id: "p-101", code: "CRP-OVS",  name: "Cropped Oversized",  spec: "FT-014", print: "EST-031", colors: ["#1f1f1f","#7a4b2a","#c9b9a3"], sizes: ["P","M","G","GG"], stock: 84,  thumb: "warm" },
    { id: "p-102", code: "CAM-LIN",  name: "Camisa Linho",       spec: "FT-021", print: "EST-002", colors: ["#efe6d3","#cfb98e","#7a8a76"], sizes: ["P","M","G","GG"], stock: 46,  thumb: "sand" },
    { id: "p-103", code: "MOL-VTG",  name: "Moletom Vintage",    spec: "FT-008", print: "EST-019", colors: ["#3a4a3d","#6b4a2e","#1f1f1f"], sizes: ["M","G","GG"],     stock: 28,  thumb: "moss" },
    { id: "p-104", code: "TSH-BOX",  name: "T-Shirt Box",        spec: "FT-003", print: "EST-005", colors: ["#f4f1ea","#1f1f1f","#b03a2e"], sizes: ["P","M","G","GG"], stock: 132, thumb: "bone" },
    { id: "p-105", code: "BAG-TOTE", name: "Tote Bag Algodão",   spec: "FT-030", print: "EST-040", colors: ["#efe6d3","#3a4a3d"],           sizes: ["U"],              stock: 67,  thumb: "stone" },
  ],

  specs: [
    { id: "FT-014", name: "Cropped Oversized",  tipo: "camiseta", fabric: "Malha PV (67/33)",      gsm: 180, consumo: 0.20, ribanaUsa: true,  ribanaTipo: "Ribana 1×1", ribanaPct: 10, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Etiqueta de composição",cost:0.18},{tipo:"Tag de papel",cost:0.35}], mao: 8.50, preco: 89.00, updated: "02/05/2026" },
    { id: "FT-021", name: "Camisa Linho",       tipo: "blusa",    fabric: "Linho misto",           gsm: 145, consumo: 0.24, ribanaUsa: false, ribanaTipo: "—",          ribanaPct:  0, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Botão",cost:0.85},{tipo:"Tag de papel",cost:0.35}], mao: 14.00, preco: 249.90, updated: "30/04/2026" },
    { id: "FT-008", name: "Moletom Vintage",    tipo: "moletom",  fabric: "Moletom flanelado",     gsm: 320, consumo: 0.45, ribanaUsa: true,  ribanaTipo: "Ribana 2×1", ribanaPct: 15, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Etiqueta de composição",cost:0.18},{tipo:"Cordão capuz",cost:1.20},{tipo:"Tag de papel",cost:0.35}], mao: 16.50, preco: 199.00, updated: "21/04/2026" },
    { id: "FT-003", name: "T-Shirt Box",        tipo: "camiseta", fabric: "Malha 100% algodão",    gsm: 160, consumo: 0.18, ribanaUsa: true,  ribanaTipo: "Ribana 1×1", ribanaPct:  8, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Etiqueta de composição",cost:0.18}], mao: 7.50, preco: 79.00, updated: "12/04/2026" },
    { id: "FT-030", name: "Tote Bag Algodão",   tipo: "blusa",    fabric: "Sarja crua",            gsm: 240, consumo: 0.30, ribanaUsa: false, ribanaTipo: "—",          ribanaPct:  0, aviamentos: [{tipo:"Etiqueta externa estampada",cost:0.55},{tipo:"Tag de papel",cost:0.35}], mao: 4.20, preco: 59.00, updated: "05/04/2026" },
  ],

  prints: [
    { id: "EST-031", name: "Aurora — Sol nascente", technique: "DTF",         cost: 4.20, tag: "verão",   tone: "warm" },
    { id: "EST-002", name: "Botânica linha-única",  technique: "Silkscreen",  cost: 2.10, tag: "atemporal", tone: "sand" },
    { id: "EST-019", name: "Tipográfica '94",       technique: "Sublimação",  cost: 5.80, tag: "outono",  tone: "moss" },
    { id: "EST-005", name: "Liso etiquetado",       technique: "Silkscreen",  cost: 1.10, tag: "essencial", tone: "bone" },
    { id: "EST-040", name: "Mapa de bairro",        technique: "DTF",         cost: 3.40, tag: "edição limitada", tone: "stone" },
  ],

  cutting: [
    { id: "CO-214", code: "CO-214", product: "Cropped Oversized",  status: "pendente", roll: "BB-031", planned: 60, actual: 0,  operator: "Joana Pires",  date: "08/05" },
    { id: "CO-213", code: "CO-213", product: "Camisa Linho",       status: "cortando", roll: "BB-029", planned: 40, actual: 18, operator: "Joana Pires",  date: "07/05" },
    { id: "CO-212", code: "CO-212", product: "Moletom Vintage",    status: "cortando", roll: "BB-028", planned: 30, actual: 12, operator: "Marcos Lima",  date: "07/05" },
    { id: "CO-211", code: "CO-211", product: "T-Shirt Box",        status: "concluido",roll: "BB-026", planned: 80, actual: 78, operator: "Joana Pires",  date: "06/05" },
    { id: "CO-210", code: "CO-210", product: "Tote Bag Algodão",   status: "concluido",roll: "BB-024", planned: 50, actual: 50, operator: "Marcos Lima",  date: "05/05" },
  ],

  sewing: [
    { id: "SW-122", banca: "Banca Esperança", status: "enviado", pieces: 60, defects: 0, sent: "07/05", expected: "12/05" },
    { id: "SW-121", banca: "Banca Dona Lúcia", status: "parcial", pieces: 50, defects: 3, sent: "04/05", expected: "08/05" },
    { id: "SW-120", banca: "Banca Costura+",   status: "recebido", pieces: 80, defects: 1, sent: "30/04", expected: "05/05" },
    { id: "SW-119", banca: "Banca Esperança",  status: "recebido", pieces: 40, defects: 0, sent: "28/04", expected: "03/05" },
    { id: "SW-118", banca: "Banca Dona Lúcia", status: "atrasado", pieces: 30, defects: 0, sent: "25/04", expected: "30/04" },
  ],

  bancas: [
    { id: "b-01", name: "Banca Esperança",  contact: "Sra. Marlene · (11) 95444-1122", active: 2, ontime: 96, capacity: "120/sem" },
    { id: "b-02", name: "Banca Dona Lúcia", contact: "Sr. João · (11) 98123-4517",     active: 2, ontime: 78, capacity: "80/sem"  },
    { id: "b-03", name: "Banca Costura+",   contact: "Sra. Adriana · (11) 96222-9810", active: 1, ontime: 91, capacity: "150/sem" },
    { id: "b-04", name: "Banca Bom Retiro", contact: "Sr. Ricardo · (11) 97500-3344",  active: 0, ontime: 88, capacity: "100/sem" },
  ],

  fabric: [
    { id: "BB-031", kind: "corpo", type: "Malha PV",            color: "Off-white", gsm: 180, initial: 22.5, current: 22.5, supplier: "Malharia Estrela",   received: "06/05" },
    { id: "BB-029", kind: "corpo", type: "Linho misto",         color: "Areia",     gsm: 145, initial: 18.0, current: 12.4, supplier: "Têxtil Nordeste",    received: "03/05" },
    { id: "BB-028", kind: "corpo", type: "Moletom flanelado",   color: "Verde",     gsm: 320, initial: 25.0, current: 19.2, supplier: "Malharia Estrela",   received: "01/05" },
    { id: "BB-026", kind: "corpo", type: "Algodão 100%",        color: "Branco",    gsm: 160, initial: 30.0, current:  8.6, supplier: "Cotton Brasil",      received: "27/04" },
    { id: "BB-022", kind: "corpo", type: "Moletom 320g",        color: "Preto",     gsm: 320, initial: 28.0, current:  4.8, supplier: "Malharia Estrela",   received: "20/04" },
    { id: "BB-018", kind: "ribana",type: "Ribana PV",           color: "Preto",     gsm: 220, initial:  6.0, current:  3.1, supplier: "Têxtil Nordeste",    received: "15/04" },
  ],

  stock: [
    { sku: "CRP-OVS-PRT-M",        product: "Cropped Oversized",  color: "Preto",  size: "M",  print: null,        count: 24 },
    { sku: "CRP-OVS-MAR-M",        product: "Cropped Oversized",  color: "Marrom", size: "M",  print: null,        count:  3 },
    { sku: "CAM-LIN-ARE-G",        product: "Camisa Linho",       color: "Areia",  size: "G",  print: null,        count: 18 },
    { sku: "MOL-VTG-VRD-GG-FLR",   product: "Moletom Vintage",    color: "Verde",  size: "GG", print: "Floral 24", count:  9 },
    { sku: "TSH-BOX-BCO-P-LOGO",   product: "T-Shirt Box",        color: "Branco", size: "P",  print: "Logo Mini", count: 47 },
    { sku: "TSH-BOX-BCO-P-AURO",   product: "T-Shirt Box",        color: "Branco", size: "P",  print: "Aurora",    count: 12 },
    { sku: "TSH-BOX-PRT-M-AURO",   product: "T-Shirt Box",        color: "Preto",  size: "M",  print: "Aurora",    count:  6 },
    { sku: "BAG-TOTE-CRU-U",       product: "Tote Bag Algodão",   color: "Cru",    size: "U",  print: null,        count: 67 },
  ],

  movements: [
    { date: "07/05 16:14", sku: "CRP-OVS-PRT-M", reason: "Saída · Pedido #10487", qty: -2 },
    { date: "07/05 12:30", sku: "TSH-BOX-BCO-P-LOGO", reason: "Entrada · Remessa SW-120", qty: +78 },
    { date: "06/05 18:02", sku: "MOL-VTG-VRD-GG-FLR", reason: "Saída · Pedido #10485", qty: -3 },
    { date: "05/05 11:11", sku: "BAG-TOTE-CRU-U", reason: "Ajuste · Inventário",   qty: +4 },
    { date: "04/05 09:48", sku: "CAM-LIN-ARE-G", reason: "Saída · Pedido #10470",  qty: -1 },
  ],

  members: [
    { name: "Camila Borges", email: "camila@aurora.com", role: "Admin",    status: "ativo", lastSeen: "agora" },
    { name: "Rafael Mendes", email: "rafael@aurora.com", role: "Gestor",   status: "ativo", lastSeen: "há 12 min" },
    { name: "Joana Pires",   email: "joana@aurora.com",  role: "Operador", status: "ativo", lastSeen: "há 1h" },
    { name: "Marcos Lima",   email: "marcos@aurora.com", role: "Operador", status: "ativo", lastSeen: "há 4h" },
    { name: "Vitória Souza", email: "vitoria@aurora.com",role: "Gestor",   status: "convidado", lastSeen: "—" },
  ],

  audit: [
    { when: "07/05 16:14", who: "Rafael Mendes", action: "order.update",   target: "Pedido #10487", note: "status: pendente → pago" },
    { when: "07/05 12:30", who: "Joana Pires",   action: "shipment.receive", target: "SW-120", note: "78 peças" },
    { when: "07/05 09:02", who: "Camila Borges", action: "spec.update",    target: "FT-014",        note: "cmt 13,20 → 14,20" },
    { when: "06/05 18:02", who: "Rafael Mendes", action: "order.ship",     target: "Pedido #10485", note: "Correios PAC" },
    { when: "06/05 14:30", who: "Sistema",       action: "order.import",   target: "Shopee · 12 pedidos", note: "webhook" },
  ],

  // ───────── Separação / Checkout / Lotes (expedição de pedidos) ─────────
  // The fulfillment workspace: importação de pedidos de marketplaces, mapeamento
  // de SKU→estampa, separação com etiquetas por peça, e agrupamento em lotes.
  fulfillment: {
    meta: { ads: 63, orders: 175, items: 190 },
    platforms: {
      ml:      { id: "ml",      name: "Mercado Libre" },
      shopee:  { id: "shopee",  name: "Shopee" },
      shopify: { id: "shopify", name: "Shopify" },
    },
    imports: [
      { id: "imp-0604-0912", label: "04/06 · 09:12", count: 92 },
      { id: "imp-0604-1340", label: "04/06 · 13:40", count: 58 },
      { id: "imp-0603-1805", label: "03/06 · 18:05", count: 25 },
    ],
    // Estampa = a arte aplicada. png: arquivo pronto p/ o montador DTF ("ok"|"pendente").
    estampas: {
      "2039": { code: "2039", name: "Jujutsu Kaisen — Gojo",  png: "ok",       garments: ["Moletom Canguru"],            tone: "moss"  },
      "2055": { code: "2055", name: "Naruto — Akatsuki",       png: "ok",       garments: ["Camiseta","Cropped","Bolsa ecobag"], tone: "warm"  },
      "2170": { code: "2170", name: "One Piece — Luffy",       png: "ok",       garments: ["Ecobag","Camiseta"],          tone: "sand"  },
      "2047": { code: "2047", name: "Demon Slayer — Tanjiro",  png: "ok",       garments: ["Camiseta"],                   tone: "stone" },
      "2303": { code: "2303", name: "Chainsaw Man — Denji",    png: "pendente", garments: ["Camiseta","Moletom"],         tone: "bone"  },
      "2301": { code: "2301", name: "Berserk — Guts",          png: "ok",       garments: ["Camiseta"],                   tone: "moss"  },
    },
    // status: a_imprimir | impresso | conferido
    orders: [
      { id: "UPTHK249567", platform: "ml",      importId: "imp-0604-0912", status: "a_imprimir", lote: null, items: [
        { estampa: "2039", garment: "Moletom Canguru", product: "Moletom Canguru Unissex Jujutsu Kaisen Gojo Anime", color: "Preto", size: "M", qty: 1 } ] },
      { id: "UPTHK251213", platform: "ml",      importId: "imp-0604-0912", status: "a_imprimir", lote: null, items: [
        { estampa: "2055", garment: "Camiseta", product: "Camiseta Naruto Shippuden Akatsuki", color: "Branco", size: "G", qty: 1 },
        { estampa: "2047", garment: "Camiseta", product: "Camiseta Demon Slayer Tanjiro",     color: "Preto",  size: "M", qty: 1 } ] },
      { id: "UPTHK251900", platform: "ml",      importId: "imp-0604-0912", status: "a_imprimir", lote: null, items: [
        { estampa: "2170", garment: "Camiseta", product: "Camiseta One Piece Luffy Gear 5", color: "Off-white", size: "P", qty: 1 } ] },
      { id: "UPTHK253371", platform: "ml",      importId: "imp-0604-1340", status: "a_imprimir", lote: null, items: [
        { estampa: "2301", garment: "Camiseta", product: "Camiseta Berserk Guts Armadura", color: "Preto", size: "GG", qty: 1 } ] },
      { id: "UPTHK253608", platform: "ml",      importId: "imp-0604-1340", status: "impresso",   lote: null, items: [
        { estampa: "2055", garment: "Cropped", product: "Cropped Naruto Akatsuki", color: "Preto", size: "M", qty: 1 } ] },
      { id: "UPTHK253654", platform: "shopee",  importId: "imp-0604-1340", status: "a_imprimir", lote: null, items: [
        { estampa: "2303", garment: "Camiseta", product: "Camiseta Chainsaw Man Denji", color: "Branco", size: "G", qty: 1 } ] },
      { id: "UPTHK253825", platform: "ml",      importId: "imp-0604-1340", status: "a_imprimir", lote: null, items: [
        { estampa: "2170", garment: "Bolsa ecobag", product: "Bolsa Ecobag One Piece", color: "Cru", size: "Unico", qty: 1 } ] },
      { id: "UPTHK253865", platform: "ml",      importId: "imp-0604-0912", status: "a_imprimir", lote: null, items: [
        { estampa: "2039", garment: "Moletom Canguru", product: "Moletom Canguru Jujutsu Kaisen Gojo", color: "Preto", size: "G", qty: 1 } ] },
      { id: "UPTHK254020", platform: "ml",      importId: "imp-0604-0912", status: "a_imprimir", lote: null, items: [
        { estampa: "2047", garment: "Camiseta", product: "Camiseta Demon Slayer Tanjiro", color: "Preto", size: "M", qty: 1 } ] },
      { id: "UPTHK254118", platform: "shopify", importId: "imp-0603-1805", status: "a_imprimir", lote: null, items: [
        { estampa: "2055", garment: "Bolsa ecobag", product: "Bolsa Ecobag Naruto Akatsuki", color: "Cru", size: "Unico", qty: 2 } ] },
      { id: "UPTHK254233", platform: "ml",      importId: "imp-0604-1340", status: "a_imprimir", lote: null, items: [
        { estampa: "2301", garment: "Camiseta", product: "Camiseta Berserk Guts",       color: "Branco", size: "M", qty: 1 },
        { estampa: "2047", garment: "Camiseta", product: "Camiseta Demon Slayer Tanjiro", color: "Branco", size: "G", qty: 1 },
        { estampa: "2170", garment: "Camiseta", product: "Camiseta One Piece Luffy",    color: "Preto",  size: "P", qty: 1 } ] },
      { id: "UPTHK254301", platform: "ml",      importId: "imp-0604-1340", status: "a_imprimir", lote: null, items: [
        { estampa: "2303", garment: "Moletom", product: "Moletom Chainsaw Man Denji", color: "Preto", size: "GG", qty: 1 } ] },
      { id: "UPTHK254420", platform: "shopee",  importId: "imp-0603-1805", status: "impresso",   lote: null, items: [
        { estampa: "2039", garment: "Moletom Canguru", product: "Moletom Canguru Jujutsu Kaisen Gojo", color: "Preto", size: "M", qty: 1 } ] },
      { id: "UPTHK254512", platform: "ml",      importId: "imp-0604-0912", status: "a_imprimir", lote: "LOTE-20260604-9142", items: [
        { estampa: "2055", garment: "Camiseta", product: "Camiseta Naruto Shippuden Akatsuki", color: "Off-white", size: "G", qty: 1 } ] },
      { id: "UPTHK254633", platform: "ml",      importId: "imp-0604-1340", status: "a_imprimir", lote: "LOTE-20260604-9142", items: [
        { estampa: "2170", garment: "Camiseta", product: "Camiseta One Piece Luffy", color: "Branco", size: "M", qty: 1 } ] },
      { id: "UPTHK254780", platform: "ml",      importId: "imp-0603-1805", status: "a_imprimir", lote: null, items: [
        { estampa: "2301", garment: "Camiseta", product: "Camiseta Berserk Guts", color: "Preto", size: "P", qty: 1 } ] },
    ],
    // Lote = grupo de pedidos despachados juntos. A grade de estampas mostra só as
    // artes que precisam ser montadas/impressas (necessário), não todas as peças.
    lotes: [
      { id: "LOTE-20260604-9142", num: 1, status: "aberto",      created: "04/06/2026 · 14:02", pedidos: 58, pecas: 77, estampas: [
        { code: "2055", items: 1,  toPrint: 1, montado: false, enviado: false },
        { code: "2170", items: 1,  toPrint: 1, montado: false, enviado: false },
      ] },
      { id: "LOTE-20260603-4471", num: 2, status: "em_producao", created: "03/06/2026 · 16:20", pedidos: 41, pecas: 53, estampas: [
        { code: "2039", items: 14, toPrint: 0, montado: true,  enviado: true  },
        { code: "2047", items: 9,  toPrint: 0, montado: true,  enviado: true  },
        { code: "2303", items: 6,  toPrint: 2, montado: false, enviado: false },
      ] },
      { id: "LOTE-20260602-1188", num: 3, status: "despachado",  created: "02/06/2026 · 11:08", pedidos: 63, pecas: 80, estampas: [
        { code: "2055", items: 20, toPrint: 0, montado: true,  enviado: true  },
        { code: "2301", items: 11, toPrint: 0, montado: true,  enviado: true  },
      ] },
    ],
    // Catálogo interno — Product < ProductVariation (SKU). A estampa é propriedade
    // do produto (sai daqui para a produção); a variação carrega cor/tamanho/SKU.
    catalogProducts: [
      { id: "p-2055-cam", code: "CAM-2055", name: "Camiseta Naruto Akatsuki",  garment: "Camiseta", estampa: "2055", colors: ["Preto","Branco","Off-white"], sizes: ["P","M","G","GG"] },
      { id: "p-2055-crp", code: "CRP-2055", name: "Cropped Naruto Akatsuki",   garment: "Cropped",  estampa: "2055", colors: ["Preto","Branco"],            sizes: ["P","M","G"] },
      { id: "p-2055-eco", code: "ECO-2055", name: "Ecobag Naruto Akatsuki",    garment: "Ecobag",   estampa: "2055", colors: ["Cru"],                        sizes: ["Unico"] },
      { id: "p-2039-mol", code: "MOL-2039", name: "Moletom Canguru JJK Gojo",  garment: "Moletom",  estampa: "2039", colors: ["Preto"],                      sizes: ["M","G","GG"] },
      { id: "p-2170-cam", code: "CAM-2170", name: "Camiseta One Piece Luffy",  garment: "Camiseta", estampa: "2170", colors: ["Preto","Branco","Off-white"], sizes: ["P","M","G","GG"] },
      { id: "p-2170-eco", code: "ECO-2170", name: "Ecobag One Piece Luffy",    garment: "Ecobag",   estampa: "2170", colors: ["Cru"],                        sizes: ["Unico"] },
      { id: "p-2047-cam", code: "CAM-2047", name: "Camiseta Demon Slayer Tanjiro", garment: "Camiseta", estampa: "2047", colors: ["Preto","Branco"],         sizes: ["P","M","G","GG"] },
      { id: "p-2301-cam", code: "CAM-2301", name: "Camiseta Berserk Guts",     garment: "Camiseta", estampa: "2301", colors: ["Preto","Branco"],            sizes: ["P","M","G","GG"] },
      { id: "p-2303-cam", code: "CAM-2303", name: "Camiseta Chainsaw Man Denji", garment: "Camiseta", estampa: "2303", colors: ["Preto","Branco"],          sizes: ["P","M","G","GG"] },
      { id: "p-2303-mol", code: "MOL-2303", name: "Moletom Chainsaw Man Denji", garment: "Moletom",  estampa: "2303", colors: ["Preto"],                     sizes: ["M","G","GG"] },
    ],
    // De/Para — Item do pedido (como veio do anúncio) → variação interna (SKU) de um produto.
    // productId+sku = mapeado; null = pendente (não vai para a Separação até resolver).
    orderItems: [
      { id: "oi-7741", platform: "ml",      adTitle: "Camiseta Naruto Shippuden Akatsuki Anime Algodão", adSku: "MLB3398-PRET-G",  variation: "Preto · G",     qty: 31, productId: "p-2055-cam", sku: "CAM-2055-PRT-G" },
      { id: "oi-7742", platform: "shopee",  adTitle: "Camiseta Naruto Akatsuki Nuvem Vermelha",          adSku: "SHP-NAR-AKT-PT-M", variation: "Preto · M",    qty: 12, productId: "p-2055-cam", sku: "CAM-2055-PRT-M" },
      { id: "oi-7743", platform: "ml",      adTitle: "Moletom Canguru Jujutsu Kaisen Gojo Unissex",      adSku: "MLB7720-PRET-GG", variation: "Preto · GG",    qty: 14, productId: "p-2039-mol", sku: "MOL-2039-PRT-GG" },
      { id: "oi-7744", platform: "ml",      adTitle: "Camiseta One Piece Luffy Gear 5 Sun God",          adSku: "MLB5510-OFF-P",   variation: "Off-white · P", qty: 18, productId: "p-2170-cam", sku: "CAM-2170-OFF-P" },
      { id: "oi-7745", platform: "shopify", adTitle: "Bolsa Ecobag One Piece Luffy",                     adSku: "SHF-ECO-OP-UNI",  variation: "Cru · Único",   qty:  6, productId: "p-2170-eco", sku: "ECO-2170-CRU-UNICO" },
      { id: "oi-7746", platform: "ml",      adTitle: "Camiseta Demon Slayer Tanjiro Kamado",             adSku: "MLB6101-PRET-M",  variation: "Preto · M",     qty: 22, productId: "p-2047-cam", sku: "CAM-2047-PRT-M" },
      { id: "oi-7747", platform: "shopify", adTitle: "Camiseta Berserk Guts Armadura do Berserker",      adSku: "SHF-BSK-GUTS-PT", variation: "Preto · G",     qty: 11, productId: "p-2301-cam", sku: "CAM-2301-PRT-G" },
      // Pendentes — itens novos que o sistema ainda não reconhece
      { id: "oi-7748", platform: "ml",      adTitle: "Camiseta Chainsaw Man Denji Motosserra",           adSku: "MLB8890-BRAN-G",  variation: "Branco · G",    qty:  7, productId: null, sku: null },
      { id: "oi-7749", platform: "ml",      adTitle: "Moletom Chainsaw Man Denji Hibrido",               adSku: "MLB8891-PRET-M",  variation: "Preto · M",     qty:  4, productId: null, sku: null },
      { id: "oi-7750", platform: "shopee",  adTitle: "Camiseta Naruto Akatsuki (sem variação no anúncio)", adSku: "",              variation: "Branco · GG",   qty:  3, productId: null, sku: null },
    ],
  },
};

window.ORION_DATA = ORION_DATA;
