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

  // Um anúncio pode vincular UM OU MAIS produtos do catálogo (combo, kit ou
  // listagem multivariação). products = nomes dos produtos vinculados.
  ads: [
    { id: "a-12", channel: "shopee",   title: "Cropped Oversized Verão 2026",     products: ["Cropped Oversized"],                                                  status: "ativo",   orders30d: 38 },
    { id: "a-13", channel: "ml",       title: "Camisa Linho Premium",             products: ["Camisa Linho"],                                                       status: "ativo",   orders30d: 21 },
    { id: "a-14", channel: "shopify",  title: "Kit Essentials — Camiseta + Tote", products: ["T-Shirt Box", "Tote Bag Algodão"],                                    status: "pausado", orders30d:  4 },
    { id: "a-15", channel: "instagram",title: "Drop Outono — Moletom",            products: ["Moletom Vintage"],                                                    status: "ativo",   orders30d: 17 },
    { id: "a-16", channel: "whatsapp", title: "Catálogo VIP",                     products: ["Cropped Oversized", "Camisa Linho", "T-Shirt Box", "Tote Bag Algodão"], status: "ativo",   orders30d: 12 },
  ],

  products: [
    // colors: cada cor de material carrega UMA OU MAIS cores de estampa que combinam
    // com ela (tinta clara em peça escura, tinta escura em peça clara — p/ a arte aparecer).
    { id: "p-101", code: "CRP-OVS",  name: "Cropped Oversized",  spec: "FT-014", print: "EST-031", colors: [{material:"#1f1f1f",prints:["#f4f1ea","#b03a2e"]},{material:"#7a4b2a",prints:["#efe6d3"]},{material:"#c9b9a3",prints:["#1f1f1f","#3a4a3d"]}], sizes: ["P","M","G","GG"], stock: 84,  thumb: "warm" },
    { id: "p-102", code: "CAM-LIN",  name: "Camisa Linho",       spec: "FT-021", print: "EST-002", colors: [{material:"#efe6d3",prints:["#1f1f1f","#7a8a76"]},{material:"#cfb98e",prints:["#3a4a3d"]},{material:"#7a8a76",prints:["#f4f1ea"]}], sizes: ["P","M","G","GG"], stock: 46,  thumb: "sand" },
    { id: "p-103", code: "MOL-VTG",  name: "Moletom Vintage",    spec: "FT-008", print: "EST-019", colors: [{material:"#3a4a3d",prints:["#f4f1ea"]},{material:"#6b4a2e",prints:["#efe6d3"]},{material:"#1f1f1f",prints:["#f4f1ea","#cfb98e"]}], sizes: ["M","G","GG"],     stock: 28,  thumb: "moss" },
    { id: "p-104", code: "TSH-BOX",  name: "T-Shirt Box",        spec: "FT-003", print: "EST-005", colors: [{material:"#f4f1ea",prints:["#1f1f1f"]},{material:"#1f1f1f",prints:["#f4f1ea","#b03a2e"]},{material:"#b03a2e",prints:["#f4f1ea"]}], sizes: ["P","M","G","GG"], stock: 132, thumb: "bone" },
    { id: "p-105", code: "BAG-TOTE", name: "Tote Bag Algodão",   spec: "FT-030", print: "EST-040", colors: [{material:"#efe6d3",prints:["#3a4a3d"]},{material:"#3a4a3d",prints:["#f4f1ea"]}],           sizes: ["U"],              stock: 67,  thumb: "stone" },
  ],

  specs: [
    { id: "FT-014", name: "Cropped Oversized",  tipo: "camiseta", fabric: "Malha PV (67/33)",      gsm: 180, consumo: 0.20, ribanaUsa: true,  ribanaTipo: "Ribana 1×1", ribanaPct: 10, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Etiqueta de composição",cost:0.18},{tipo:"Tag de papel",cost:0.35}], mao: 8.50, preco: 89.00, updated: "02/05/2026" },
    { id: "FT-021", name: "Camisa Linho",       tipo: "blusa",    fabric: "Linho misto",           gsm: 145, consumo: 0.24, ribanaUsa: false, ribanaTipo: "—",          ribanaPct:  0, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Botão",cost:0.85},{tipo:"Tag de papel",cost:0.35}], mao: 14.00, preco: 249.90, updated: "30/04/2026" },
    { id: "FT-008", name: "Moletom Vintage",    tipo: "moletom",  fabric: "Moletom flanelado",     gsm: 320, consumo: 0.45, ribanaUsa: true,  ribanaTipo: "Ribana 2×1", ribanaPct: 15, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Etiqueta de composição",cost:0.18},{tipo:"Cordão capuz",cost:1.20},{tipo:"Tag de papel",cost:0.35}], mao: 16.50, preco: 199.00, updated: "21/04/2026" },
    { id: "FT-003", name: "T-Shirt Box",        tipo: "camiseta", fabric: "Malha 100% algodão",    gsm: 160, consumo: 0.18, ribanaUsa: true,  ribanaTipo: "Ribana 1×1", ribanaPct:  8, aviamentos: [{tipo:"Etiqueta interna tecida",cost:0.42},{tipo:"Etiqueta de composição",cost:0.18}], mao: 7.50, preco: 79.00, updated: "12/04/2026" },
    { id: "FT-030", name: "Tote Bag Algodão",   tipo: "blusa",    fabric: "Sarja crua",            gsm: 240, consumo: 0.30, ribanaUsa: false, ribanaTipo: "—",          ribanaPct:  0, aviamentos: [{tipo:"Etiqueta externa estampada",cost:0.55},{tipo:"Tag de papel",cost:0.35}], mao: 4.20, preco: 59.00, updated: "05/04/2026" },
  ],

  // Estampas — cada arte existe em UMA OU MAIS variações de cor. Os LADOS são
  // uma propriedade da estampa (sides): frente, costas, ou ambos — e valem para
  // TODAS as cores (todas têm exatamente os mesmos lados). Cada lado de cada cor
  // tem seu PNG. png: "ok" = subido | "pendente" = falta o arquivo.
  prints: [
    { id: "EST-031", name: "Aurora — Sol nascente", technique: "DTF",         cost: 4.20, tag: "verão",   tone: "warm", sides: ["front", "back"],
      variations: [
        { id: "v1", name: "Original", ink: "#b03a2e", front: { file: "aurora_original_frente.png", png: "ok" }, back: { file: "aurora_original_costas.png", png: "ok" } },
        { id: "v2", name: "Clara",    ink: "#f4f1ea", front: { file: "aurora_clara_frente.png", png: "ok" },     back: { file: null, png: "pendente" } },
        { id: "v3", name: "Escura",   ink: "#1f1f1f", front: { file: null, png: "pendente" },                    back: { file: null, png: "pendente" } },
      ] },
    { id: "EST-002", name: "Botânica linha-única",  technique: "Silkscreen",  cost: 2.10, tag: "atemporal", tone: "sand", sides: ["front"],
      variations: [
        { id: "v1", name: "Preto",     ink: "#1f1f1f", front: { file: "botanica_preto_frente.png", png: "ok" } },
        { id: "v2", name: "Off-white", ink: "#efe6d3", front: { file: "botanica_off_frente.png", png: "ok" } },
      ] },
    { id: "EST-019", name: "Tipográfica '94",       technique: "Sublimação",  cost: 5.80, tag: "outono",  tone: "moss", sides: ["front", "back"],
      variations: [
        { id: "v1", name: "Full color", ink: "#3a4a3d", front: { file: "tipo94_frente.png", png: "ok" }, back: { file: "tipo94_costas.png", png: "ok" } },
      ] },
    { id: "EST-005", name: "Liso etiquetado",       technique: "Silkscreen",  cost: 1.10, tag: "essencial", tone: "bone", sides: ["front"],
      variations: [
        { id: "v1", name: "Preto",  ink: "#1f1f1f", front: { file: "liso_preto_frente.png", png: "ok" } },
        { id: "v2", name: "Branco", ink: "#f4f1ea", front: { file: null, png: "pendente" } },
      ] },
    { id: "EST-040", name: "Mapa de bairro",        technique: "DTF",         cost: 3.40, tag: "edição limitada", tone: "stone", sides: ["front", "back"],
      variations: [
        { id: "v1", name: "Verde escuro", ink: "#3a4a3d", front: { file: "mapa_verde_frente.png", png: "ok" },  back: { file: "mapa_verde_costas.png", png: "ok" } },
        { id: "v2", name: "Branco",       ink: "#f4f1ea", front: { file: "mapa_branco_frente.png", png: "ok" }, back: { file: null, png: "pendente" } },
        { id: "v3", name: "Bege",         ink: "#cfb98e", front: { file: null, png: "pendente" },                back: { file: null, png: "pendente" } },
      ] },
  ],

  // Cada ordem carrega uma GRADE por tamanho (planned × actual) — a granularidade
  // que o card e o kanban usam. Uma ordem parcial aparece em DUAS colunas:
  // as linhas ainda abertas em "Cortando" e as já concluídas em "Concluído".
  cutting: [
    { id: "CO-214", code: "CO-214", product: "Cropped Oversized",  color: "Off-white", status: "pendente", roll: "BB-031", planned: 60, actual: 0,  operator: "Joana Pires",  date: "08/05",
      grade: [{ size: "P", planned: 12, actual: 0 }, { size: "M", planned: 20, actual: 0 }, { size: "G", planned: 18, actual: 0 }, { size: "GG", planned: 10, actual: 0 }] },
    { id: "CO-213", code: "CO-213", product: "Camisa Linho",       color: "Areia", status: "cortando", roll: "BB-029", planned: 40, actual: 18, operator: "Joana Pires",  date: "07/05",
      grade: [{ size: "P", planned: 8, actual: 8 }, { size: "M", planned: 14, actual: 10 }, { size: "G", planned: 12, actual: 0 }, { size: "GG", planned: 6, actual: 0 }] },
    { id: "CO-212", code: "CO-212", product: "Moletom Vintage",    color: "Verde", status: "cortando", roll: "BB-028", planned: 30, actual: 12, operator: "Marcos Lima",  date: "07/05",
      grade: [{ size: "M", planned: 12, actual: 12 }, { size: "G", planned: 12, actual: 0 }, { size: "GG", planned: 6, actual: 0 }] },
    { id: "CO-211", code: "CO-211", product: "T-Shirt Box",        color: "Branco", status: "concluido",roll: "BB-026", planned: 80, actual: 78, operator: "Joana Pires",  date: "06/05",
      grade: [{ size: "P", planned: 20, actual: 20 }, { size: "M", planned: 28, actual: 28 }, { size: "G", planned: 22, actual: 22 }, { size: "GG", planned: 10, actual: 8 }] },
    { id: "CO-210", code: "CO-210", product: "Tote Bag Algodão",   color: "Cru", status: "concluido",roll: "BB-024", planned: 50, actual: 50, operator: "Marcos Lima",  date: "05/05",
      grade: [{ size: "U", planned: 50, actual: 50 }] },
  ],

  // ───────── Impressão: espelho do Corte, mas no caminho do PAPEL ─────────
  // Uma ordem planeja contra uma ESTAMPA (catálogo) + uma BOBINA DE PAPEL/FILME.
  // A grade é por LADO (frente/costas) × VARIAÇÃO (cor da estampa). Imprimir
  // abate a bobina (metros) e gera os IMPRESSOS prontos para a Montagem.
  // status: pendente | imprimindo | concluido · consumed = metros já lançados
  printing: [
    { id: "IM-216", code: "IM-216", estampa: "EST-031", status: "pendente",   roll: "BP-301", planned: 60, printed: 0,  operator: "Joana Pires", date: "08/06", consumed: 0 },
    { id: "IM-215", code: "IM-215", estampa: "EST-040", status: "imprimindo",  roll: "BP-304", planned: 42, printed: 16, operator: "Marcos Lima", date: "07/06", consumed: 6 },
    { id: "IM-214", code: "IM-214", estampa: "EST-019", status: "imprimindo",  roll: "BP-303", planned: 30, printed: 12, operator: "Joana Pires", date: "07/06", consumed: 7 },
    { id: "IM-213", code: "IM-213", estampa: "EST-031", status: "concluido",   roll: "BP-302", planned: 48, printed: 48, operator: "Joana Pires", date: "06/06", consumed: 17 },
    { id: "IM-212", code: "IM-212", estampa: "EST-040", status: "concluido",   roll: "BP-301", planned: 34, printed: 34, operator: "Marcos Lima", date: "05/06", consumed: 12 },
  ],

  // ───────── Costura: espelho do Corte, mas no caminho das BANCAS ─────────
  // Uma REMESSA envia peças cortadas a uma banca terceirizada; ela costura e
  // devolve PEÇAS LISAS (semiacabado). A grade é por tipo de peça lisa, com
  // enviado (planned) × recebido (received). Receber credita o estoque de lisas —
  // pode ser PARCIAL (recebido < enviado), exatamente como o Corte. credited =
  // quanto de cada linha já entrou no estoque.
  // status: costurando | recebido · late = passou da data prevista. Sem "enviado":
  // antes de virar remessa, as peças cortadas ficam na coluna "Disponível".
  sewing: [
    { id: "SW-126", code: "SW-126", banca: "Banca Bom Retiro", status: "costurando",    sent: "07/06", expected: "13/06", date: "07/06", defects: 0,
      lines: [{ id: "bl-01", planned: 60, received: 0, credited: 0 }, { id: "bl-02", planned: 40, received: 0, credited: 0 }, { id: "bl-09", planned: 30, received: 0, credited: 0 }, { id: "bl-08", planned: 25, received: 0, credited: 0 }] },
    { id: "SW-125", code: "SW-125", banca: "Banca Costura+",    status: "costurando",    sent: "06/06", expected: "12/06", date: "06/06", defects: 0,
      lines: [{ id: "bl-03", planned: 48, received: 0, credited: 0 }, { id: "bl-04", planned: 32, received: 0, credited: 0 }, { id: "bl-06", planned: 20, received: 0, credited: 0 }, { id: "bl-07", planned: 16, received: 0, credited: 0 }] },
    { id: "SW-124", code: "SW-124", banca: "Banca Esperança",   status: "costurando", sent: "03/06", expected: "09/06", date: "03/06", defects: 1,
      lines: [{ id: "bl-03", planned: 36, received: 36, credited: 36 }, { id: "bl-04", planned: 24, received: 12, credited: 12 }, { id: "bl-09", planned: 30, received: 30, credited: 30 }, { id: "bl-08", planned: 20, received: 0, credited: 0 }] },
    { id: "SW-123", code: "SW-123", banca: "Banca Dona Lúcia",  status: "costurando", sent: "02/06", expected: "07/06", date: "02/06", defects: 0, late: true,
      lines: [{ id: "bl-01", planned: 30, received: 0, credited: 0 }, { id: "bl-02", planned: 20, received: 0, credited: 0 }] },
    { id: "SW-122", code: "SW-122", banca: "Banca Esperança",   status: "costurando", sent: "01/06", expected: "08/06", date: "01/06", defects: 0,
      lines: [{ id: "bl-06", planned: 22, received: 22, credited: 22 }, { id: "bl-07", planned: 18, received: 6, credited: 6 }] },
    { id: "SW-121", code: "SW-121", banca: "Banca Costura+",    status: "recebido",   sent: "28/05", expected: "03/06", date: "28/05", defects: 2,
      lines: [{ id: "bl-01", planned: 50, received: 50, credited: 50 }, { id: "bl-02", planned: 30, received: 30, credited: 30 }, { id: "bl-09", planned: 40, received: 40, credited: 40 }] },
    { id: "SW-120", code: "SW-120", banca: "Banca Esperança",   status: "recebido",   sent: "25/05", expected: "01/06", date: "25/05", defects: 0,
      lines: [{ id: "bl-06", planned: 22, received: 22, credited: 22 }, { id: "bl-07", planned: 18, received: 18, credited: 18 }] },
    { id: "SW-119", code: "SW-119", banca: "Banca Dona Lúcia",  status: "recebido",   sent: "22/05", expected: "28/05", date: "22/05", defects: 1,
      lines: [{ id: "bl-08", planned: 30, received: 30, credited: 30 }] },
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
  fabricMovements: [
    { date: "07/06 14:20", id: "BB-022", reason: "Saída · Corte CT-118",   qty: -6.2 },
    { date: "06/06 10:05", id: "BB-026", reason: "Saída · Corte CT-116",   qty: -9.4 },
    { date: "06/05 08:30", id: "BB-031", reason: "Entrada · Recebimento",  qty: +22.5 },
    { date: "04/06 16:40", id: "BB-029", reason: "Saída · Corte CT-110",   qty: -5.6 },
    { date: "03/05 09:15", id: "BB-029", reason: "Entrada · Recebimento",  qty: +18.0 },
    { date: "01/06 11:50", id: "BB-028", reason: "Saída · Corte CT-104",   qty: -5.8 },
    { date: "20/04 13:25", id: "BB-022", reason: "Entrada · Recebimento",  qty: +28.0 },
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
    // Produtos de demanda (POD) já montados e em estoque — caem direto na Separação
    { sku: "CAM-2170-OFF-P",       product: "Camiseta One Piece Luffy",  color: "Off-white", size: "P",     print: "2170", count:  4 },
    { sku: "CRP-2055-PRT-M",       product: "Cropped Naruto Akatsuki",   color: "Preto",     size: "M",     print: "2055", count:  3 },
    { sku: "CAM-2301-PRT-GG",      product: "Camiseta Berserk Guts",     color: "Preto",     size: "GG",    print: "2301", count:  2 },
    { sku: "ECO-2055-CRU-Único",   product: "Ecobag Naruto Akatsuki",    color: "Cru",       size: "Único", print: "2055", count:  4 },
    { sku: "ECO-2170-CRU-Único",   product: "Ecobag One Piece Luffy",    color: "Cru",       size: "Único", print: "2170", count:  3 },
  ],

  movements: [
    { date: "07/05 16:14", sku: "CRP-OVS-PRT-M", reason: "Saída · Pedido #10487", qty: -2 },
    { date: "07/05 12:30", sku: "TSH-BOX-BCO-P-LOGO", reason: "Entrada · Remessa SW-120", qty: +78 },
    { date: "06/05 18:02", sku: "MOL-VTG-VRD-GG-FLR", reason: "Saída · Pedido #10485", qty: -3 },
    { date: "05/05 11:11", sku: "BAG-TOTE-CRU-U", reason: "Ajuste · Inventário",   qty: +4 },
    { date: "04/05 09:48", sku: "CAM-LIN-ARE-G", reason: "Saída · Pedido #10470",  qty: -1 },
  ],

  // ───────── Estoque intermediário: PEÇAS LISAS (semiacabado / WIP) ─────────
  // Peças costuradas que voltaram da banca mas ainda NÃO foram estampadas.
  // É o maior estoque da operação. Chave = base + cor + tamanho (sem estampa).
  // Entra na Remessa recebida; sai na Montagem (vira Produto acabado).
  blankPieces: [
    { id: "bl-01", garment: "camiseta", base: "Camiseta",        color: "Branco",    size: "M",     count: 142, min: 40 },
    { id: "bl-02", garment: "camiseta", base: "Camiseta",        color: "Branco",    size: "G",     count: 118, min: 40 },
    { id: "bl-03", garment: "camiseta", base: "Camiseta",        color: "Preto",     size: "M",     count:  96, min: 40 },
    { id: "bl-04", garment: "camiseta", base: "Camiseta",        color: "Preto",     size: "G",     count:  74, min: 40 },
    { id: "bl-05", garment: "camiseta", base: "Camiseta",        color: "Off-white", size: "P",     count:  31, min: 35 },
    { id: "bl-06", garment: "moletom",  base: "Moletom Canguru", color: "Preto",     size: "G",     count:  38, min: 20 },
    { id: "bl-07", garment: "moletom",  base: "Moletom Canguru", color: "Preto",     size: "GG",    count:  22, min: 20 },
    { id: "bl-08", garment: "camiseta", base: "Cropped",         color: "Preto",     size: "M",     count:  44, min: 25 },
    { id: "bl-09", garment: "bolsa",    base: "Ecobag",          color: "Cru",       size: "Único", count:  73, min: 30 },
    { id: "bl-10", garment: "camiseta", base: "Camiseta",        color: "Preto",     size: "GG",    count:   9, min: 30 },
  ],
  blankMovements: [
    { date: "07/06 11:20", id: "bl-03", reason: "Entrada · Remessa SW-122",   qty: +60 },
    { date: "07/06 09:05", id: "bl-08", reason: "Saída · Montagem Lote 1",     qty: -18 },
    { date: "06/06 16:40", id: "bl-01", reason: "Entrada · Remessa SW-120",    qty: +80 },
    { date: "06/06 14:02", id: "bl-09", reason: "Saída · Montagem #UPTHK2541", qty: -2 },
    { date: "05/06 10:11", id: "bl-10", reason: "Saída · Montagem Lote 2",     qty: -24 },
  ],

  // ───────── Insumo de impressão: BOBINAS DE PAPEL / FILME (matéria-prima) ─────────
  // Espelho das bobinas de tecido, mas para a estamparia. Medido em metros.
  // Consumido na Impressão de um lote (gera os Estampados).
  paperRolls: [
    { id: "BP-301", type: "Filme DTF",         width: 60, initial: 100, current: 64,  supplier: "DTF Brasil",       received: "04/06" },
    { id: "BP-302", type: "Filme DTF",         width: 30, initial:  50, current: 11,  supplier: "DTF Brasil",       received: "30/05" },
    { id: "BP-303", type: "Papel sublimático", width: 160,initial: 200, current: 150, supplier: "SubliPrint",       received: "28/05" },
    { id: "BP-304", type: "Filme DTF",         width: 60, initial: 100, current: 88,  supplier: "Inktec Suprimentos",received: "02/06" },
    { id: "BP-305", type: "Papel transfer",    width: 30, initial:  40, current:  5,  supplier: "SubliPrint",       received: "22/05" },
  ],
  paperMovements: [
    { date: "07/06 10:50", id: "BP-301", reason: "Saída · Impressão Lote 2", qty: -22 },
    { date: "06/06 15:30", id: "BP-302", reason: "Saída · Impressão Lote 1", qty: -14 },
    { date: "04/06 09:12", id: "BP-301", reason: "Entrada · Compra NF-8841", qty: +100 },
    { date: "30/05 11:00", id: "BP-305", reason: "Saída · Impressão Lote 3", qty: -18 },
  ],

  // ───────── Estoque intermediário: ESTAMPADOS (componente, transfers prontos) ─────────
  // DTF/transfers já impressos, esperando a prensa. Chave = estampa + lado.
  // Entra na Impressão (consome Bobina de papel); sai na Montagem.
  printed: [
    { id: "pr-01", code: "2055", name: "Naruto — Akatsuki",      technique: "DTF",        side: "frente", tone: "warm",  count: 41, min: 15 },
    { id: "pr-02", code: "2039", name: "Jujutsu Kaisen — Gojo",  technique: "DTF",        side: "frente", tone: "moss",  count: 24, min: 12 },
    { id: "pr-03", code: "2039", name: "Jujutsu Kaisen — Gojo",  technique: "DTF",        side: "costas", tone: "moss",  count:  6, min: 12 },
    { id: "pr-04", code: "2047", name: "Demon Slayer — Tanjiro", technique: "DTF",        side: "frente", tone: "stone", count: 18, min: 12 },
    { id: "pr-05", code: "2170", name: "One Piece — Luffy",      technique: "Sublimação", side: "frente", tone: "sand",  count: 12, min: 12 },
    { id: "pr-06", code: "2301", name: "Berserk — Guts",         technique: "DTF",        side: "frente", tone: "moss",  count:  9, min: 10 },
    { id: "pr-07", code: "2303", name: "Chainsaw Man — Denji",   technique: "DTF",        side: "frente", tone: "bone",  count:  0, min: 10 },
  ],
  printedMovements: [
    { date: "07/06 10:48", id: "pr-01", reason: "Entrada · Impressão Lote 2", qty: +30 },
    { date: "07/06 09:05", id: "pr-04", reason: "Saída · Montagem Lote 1",    qty: -9  },
    { date: "06/06 15:28", id: "pr-02", reason: "Entrada · Impressão Lote 1", qty: +14 },
    { date: "05/06 13:10", id: "pr-05", reason: "Saída · Montagem #UPTHK2536",qty: -1  },
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

// ───────── Catalog configuration (configurable from Ajustes) ─────────
// Available colors for PRODUCTS (material) and for PRINTS (ink), plus the
// available size grid. Persisted per-browser; both palettes are independent.
const CATALOG_CONFIG_DEFAULTS = {
  productColors: [
    { hex: '#1f1f1f', name: 'Preto' },
    { hex: '#f4f1ea', name: 'Off-white' },
    { hex: '#7a4b2a', name: 'Marrom' },
    { hex: '#c9b9a3', name: 'Areia' },
    { hex: '#cfb98e', name: 'Bege' },
    { hex: '#7a8a76', name: 'Verde-musgo' },
    { hex: '#3a4a3d', name: 'Verde escuro' },
    { hex: '#6b4a2e', name: 'Caramelo' },
    { hex: '#b03a2e', name: 'Vermelho' },
    { hex: '#2a3b5a', name: 'Azul-marinho' },
  ],
  printColors: [
    { hex: '#f4f1ea', name: 'Branco' },
    { hex: '#1f1f1f', name: 'Preto' },
    { hex: '#efe6d3', name: 'Off-white' },
    { hex: '#b03a2e', name: 'Vermelho' },
    { hex: '#3a4a3d', name: 'Verde escuro' },
    { hex: '#cfb98e', name: 'Bege' },
    { hex: '#2a3b5a', name: 'Azul-marinho' },
  ],
  sizes: ['P', 'M', 'G', 'GG', 'U'],
  // Tipos de tecido — usados em Estoque › Tecidos (receber bobina) e na ficha técnica.
  fabricTypes: [
    'Algodão 30.1', 'Algodão 24.1 penteado', 'Malha PV (67/33)', 'Malha 100% poliéster',
    'Moletom flanelado', 'Sarja crua', 'Linho misto', 'Piquet algodão',
  ],
  // Tipos de peça — usados na Ficha técnica. icon aponta para a biblioteca de glifos.
  garmentTypes: [
    { id: 'camiseta', label: 'Camiseta', skuPrefix: 'CAM', icon: 'camiseta' },
    { id: 'moletom',  label: 'Moletom',  skuPrefix: 'MOL', icon: 'moletom'  },
    { id: 'regata',   label: 'Regata',   skuPrefix: 'REG', icon: 'regata'   },
    { id: 'blusa',    label: 'Blusa',    skuPrefix: 'BLU', icon: 'blusa'    },
    { id: 'calca',    label: 'Calça',    skuPrefix: 'CAL', icon: 'calca'    },
    { id: 'bermuda',  label: 'Bermuda',  skuPrefix: 'BER', icon: 'bermuda'  },
  ],
  // Aviamentos — usados na Ficha técnica.
  aviamentos: [
    'Etiqueta interna tecida', 'Etiqueta de composição', 'Etiqueta externa estampada',
    'Tag de papel', 'Lacre/sigilo', 'Cordão capuz', 'Zíper', 'Botão', 'Cadarço', 'Elástico',
  ],
  // Técnicas de estampa — usadas no Catálogo › Estampas.
  techniques: ['DTF', 'Silkscreen', 'Sublimação'],
  // Avisos de estoque baixo — limite de reposição por tipo de estoque.
  // unit: 'pct' (sobre o saldo inicial), 'qty'/'kg'/'m' (absoluto). enabled:false = sem aviso.
  stockThresholds: {
    fabric:  { enabled: true,  unit: 'pct', value: 25 },
    paper:   { enabled: true,  unit: 'pct', value: 25 },
    blank:   { enabled: true,  unit: 'qty', value: 20 },
    printed: { enabled: true,  unit: 'qty', value: 10 },
    product: { enabled: true,  unit: 'qty', value: 10 },
  },
};

window.CatalogConfig = (function () {
  const KEY = 'orion.catalogConfig.v1';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let state;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    // Merge over defaults so configs added in newer versions appear for existing users.
    state = saved && saved.productColors && saved.printColors && saved.sizes
      ? Object.assign(clone(CATALOG_CONFIG_DEFAULTS), saved)
      : clone(CATALOG_CONFIG_DEFAULTS);
  } catch (e) { state = clone(CATALOG_CONFIG_DEFAULTS); }
  const subs = new Set();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  return {
    defaults: CATALOG_CONFIG_DEFAULTS,
    get: () => state,
    set: (next) => { state = next; persist(); subs.forEach(f => f(state)); },
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    reset: () => { state = clone(CATALOG_CONFIG_DEFAULTS); persist(); subs.forEach(f => f(state)); },
  };
})();
