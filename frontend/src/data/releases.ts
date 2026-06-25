import type { LucideIcon } from "lucide-react";
import { type Locale } from "@/i18n/config";
import { releaseIcon } from "@/lib/release-icons";

/**
 * Orion release notes — the single source of truth for the Novidades page
 * (/novidades), the top-bar "Novidades" link, and the post-login home popup.
 * Newest first; the first entry is the "brand new" release the home popup
 * announces and the top-bar dot points to.
 *
 * Mirrors `window.ORION_RELEASES` from /docs/design/data.js. Long-form copy
 * lives here (not in next-intl) keyed by locale; the surrounding UI chrome
 * (page title, kind labels, links) goes through the `news` message namespace.
 */

export type ReleaseKind = "novo" | "melhoria" | "correcao";

export type ReleaseStat = { value: string; label: string; up?: boolean };

/** Authoring shape — the lucide icon name (kebab-case) for a flow step. */
type RawFlowStep = {
  icon: string;
  label: string;
  sub?: string;
  tone?: "accent" | "ok" | "warn";
};

/** Resolved flow step — the icon name swapped for its lucide component. */
export type ReleaseFlowStep = {
  icon: LucideIcon;
  label: string;
  sub?: string;
  tone?: "accent" | "ok" | "warn";
};

/** The locale-specific (translatable) half of a release. */
type ReleaseContent = {
  dateLabel: string;
  area: string;
  title: string;
  titleEm?: string;
  teaser: string;
  intro: string;
  stats?: ReleaseStat[];
  flow?: RawFlowStep[];
  points?: string[];
  image?: string;
};

/** The locale-agnostic half + per-locale content. */
type ReleaseBase = {
  id: string;
  /** ISO date — agnostic, used for ordering/dating. */
  date: string;
  version: string;
  kind: ReleaseKind;
  /** lucide icon name (kebab-case) for the area badge + timeline node. */
  areaIcon: string;
  /** Hex tone for the timeline node + area badge (maps to a brand colour). */
  areaColor: string;
  content: Record<Locale, ReleaseContent>;
};

/**
 * A fully-resolved release for a given locale — the area/flow icon names are
 * swapped for their lucide components, resolved once here so the UI renders
 * them via a member access (`release.AreaIcon`) rather than a call-in-render,
 * which the React Compiler lint rejects.
 */
export type Release = Omit<ReleaseBase, "content" | "areaIcon"> &
  Omit<ReleaseContent, "flow"> & {
    AreaIcon: LucideIcon;
    flow?: ReleaseFlowStep[];
  };

const RELEASES: ReleaseBase[] = [
  {
    id: "identidade-orion",
    date: "2026-06-22",
    version: "v3.0",
    kind: "novo",
    areaIcon: "sparkles",
    areaColor: "#a83227",
    content: {
      "pt-BR": {
        dateLabel: "22 de junho, 2026",
        area: "Orion",
        title: "O Orion ganhou",
        titleEm: "uma identidade",
        teaser:
          "Nova marca, console em tom Ember e esta página de Novidades pra você acompanhar tudo que muda.",
        intro:
          "O Orion vestiu uma identidade própria: a marca em órbita, uma paleta Ember consistente em todo o sistema e um console mais limpo pra quem opera. E criamos esta página de Novidades — daqui pra frente, cada melhoria aparece aqui em primeira mão.",
        flow: [
          { icon: "sparkles", label: "Marca", sub: "em órbita", tone: "accent" },
          { icon: "palette", label: "Paleta", sub: "Ember" },
          { icon: "layout-dashboard", label: "Novidades", sub: "nesta página", tone: "ok" },
        ],
        points: [
          "Visual consistente da tela de login até o console.",
          "Esta página reúne o histórico de tudo que lançamos.",
          "Quando há algo novo, o Orion te avisa assim que você entra.",
        ],
      },
      en: {
        dateLabel: "June 22, 2026",
        area: "Orion",
        title: "Orion got",
        titleEm: "an identity",
        teaser:
          "A new brand, an Ember-toned console and this What's New page so you can follow every change.",
        intro:
          "Orion put on an identity of its own: the orbit mark, a consistent Ember palette across the whole system and a cleaner console for operators. And we built this What's New page — from now on, every improvement shows up here first.",
        flow: [
          { icon: "sparkles", label: "Brand", sub: "in orbit", tone: "accent" },
          { icon: "palette", label: "Palette", sub: "Ember" },
          { icon: "layout-dashboard", label: "What's New", sub: "on this page", tone: "ok" },
        ],
        points: [
          "A consistent look from the login screen to the console.",
          "This page gathers the history of everything we've shipped.",
          "When something's new, Orion lets you know as soon as you sign in.",
        ],
      },
    },
  },
  {
    id: "inicio-conferencia",
    date: "2026-06-10",
    version: "v2.7",
    kind: "melhoria",
    areaIcon: "layout-dashboard",
    areaColor: "#a83227",
    content: {
      "pt-BR": {
        dateLabel: "10 de junho, 2026",
        area: "Início",
        title: "A tela inicial agora",
        titleEm: "gira em torno da conferência",
        teaser:
          "Abriu o Orion, já vê o lote do dia, o que falta conferir e os relatórios à mão.",
        intro:
          "Redesenhamos a tela inicial em torno da conferência: o lote do dia, o que já foi conferido e o que ainda trava a expedição ficam logo na entrada. Os números levam direto à tela que resolve, e os relatórios de vendas, produção, estoque e custos ficam a um clique.",
        flow: [
          { icon: "layout-dashboard", label: "Início", sub: "o dia num olhar", tone: "accent" },
          { icon: "clipboard-check", label: "Conferir", sub: "o que falta" },
          { icon: "bar-chart-3", label: "Relatórios", sub: "à mão", tone: "ok" },
        ],
        points: [
          "Os indicadores são clicáveis — vão direto pra tela que resolve.",
          "Uma visão de operador pra quem acompanha mais de uma operação.",
          "Relatórios de vendas, produção, estoque e custos em abas.",
        ],
      },
      en: {
        dateLabel: "June 10, 2026",
        area: "Home",
        title: "The home screen now",
        titleEm: "revolves around checking",
        teaser:
          "Open Orion and you see the day's batch, what's left to check and your reports at hand.",
        intro:
          "We rebuilt the home screen around checking: the day's batch, what's already checked and what's still holding up dispatch sit right at the entrance. The numbers take you straight to the screen that resolves them, and the sales, production, inventory and cost reports are one click away.",
        flow: [
          { icon: "layout-dashboard", label: "Home", sub: "the day at a glance", tone: "accent" },
          { icon: "clipboard-check", label: "Check", sub: "what's left" },
          { icon: "bar-chart-3", label: "Reports", sub: "at hand", tone: "ok" },
        ],
        points: [
          "The indicators are clickable — they jump to the screen that resolves them.",
          "An operator view for anyone watching more than one operation.",
          "Sales, production, inventory and cost reports in tabs.",
        ],
      },
    },
  },
  {
    id: "estampas-paleta",
    date: "2026-05-28",
    version: "v2.6",
    kind: "novo",
    areaIcon: "palette",
    areaColor: "#7e5bef",
    content: {
      "pt-BR": {
        dateLabel: "28 de maio, 2026",
        area: "Catálogo",
        title: "Estampas reconhecidas,",
        titleEm: "cores sob controle",
        teaser:
          "O Orion reconhece o produto e vincula a estampa sozinho — e as cores agora seguem uma paleta única.",
        intro:
          "Cada produto agora carrega a miniatura da estampa, e o Orion reconhece o item pelo código do anúncio pra fazer o vínculo sozinho. As cores passaram a seguir a paleta da empresa como fonte da verdade, então o que entra no catálogo é sempre uma cor que existe de fato.",
        flow: [
          { icon: "image", label: "Miniatura", sub: "da estampa" },
          { icon: "palette", label: "Paleta", sub: "fonte da verdade", tone: "accent" },
          { icon: "check", label: "Catálogo", sub: "sem cor solta", tone: "ok" },
        ],
        points: [
          "Itens sem correspondência ficam separados pra revisão rápida.",
          "Cada vínculo que você confirma ensina o Orion pra próxima vez.",
          "Cores novas entram pela paleta — nada de variação digitada à toa.",
        ],
      },
      en: {
        dateLabel: "May 28, 2026",
        area: "Catalog",
        title: "Prints recognized,",
        titleEm: "colors under control",
        teaser:
          "Orion recognizes the product and links its print on its own — and colors now follow a single palette.",
        intro:
          "Every product now carries its print thumbnail, and Orion recognizes the item from the listing code to make the link itself. Colors now follow the company palette as the source of truth, so whatever lands in the catalog is always a color that actually exists.",
        flow: [
          { icon: "image", label: "Thumbnail", sub: "of the print" },
          { icon: "palette", label: "Palette", sub: "source of truth", tone: "accent" },
          { icon: "check", label: "Catalog", sub: "no stray color", tone: "ok" },
        ],
        points: [
          "Items without a match are set aside for a quick review.",
          "Every link you confirm teaches Orion for next time.",
          "New colors come in through the palette — no free-typed variants.",
        ],
      },
    },
  },
  {
    id: "importar-pedidos",
    date: "2026-05-15",
    version: "v2.4",
    kind: "novo",
    areaIcon: "shopping-bag",
    areaColor: "#c2410c",
    content: {
      "pt-BR": {
        dateLabel: "15 de maio, 2026",
        area: "Vendas",
        title: "Pedidos dos canais,",
        titleEm: "direto pra dentro",
        teaser:
          "Importe o relatório de vendas do marketplace e o Orion monta os pedidos pra você.",
        intro:
          "Em vez de relançar pedido por pedido, você sobe o arquivo do canal e o Orion lê, confere e cria os pedidos — prontos pra separação. O que não casa fica separado pra você revisar antes de confirmar.",
        flow: [
          { icon: "download", label: "Subir arquivo", sub: "do canal" },
          { icon: "clipboard-check", label: "Conferir", sub: "antes de criar", tone: "accent" },
          { icon: "shopping-bag", label: "Pedidos", sub: "prontos", tone: "ok" },
        ],
        points: [
          "Os pedidos chegam já vinculados ao cliente e aos produtos.",
          "O que não casa fica separado pra você revisar antes de confirmar.",
        ],
      },
      en: {
        dateLabel: "May 15, 2026",
        area: "Sales",
        title: "Orders from your channels,",
        titleEm: "straight in",
        teaser:
          "Import the marketplace sales report and Orion builds the orders for you.",
        intro:
          "Instead of re-keying order by order, you upload the channel's file and Orion reads it, checks it and creates the orders — ready for picking. Whatever doesn't match is set aside for you to review before confirming.",
        flow: [
          { icon: "download", label: "Upload file", sub: "from the channel" },
          { icon: "clipboard-check", label: "Review", sub: "before creating", tone: "accent" },
          { icon: "shopping-bag", label: "Orders", sub: "ready", tone: "ok" },
        ],
        points: [
          "Orders arrive already linked to the customer and the products.",
          "Whatever doesn't match is set aside for you to review before confirming.",
        ],
      },
    },
  },
  {
    id: "producao-tecido-despacho",
    date: "2026-05-02",
    version: "v2.2",
    kind: "novo",
    areaIcon: "radar",
    areaColor: "#0f766e",
    content: {
      "pt-BR": {
        dateLabel: "2 de maio, 2026",
        area: "Produção",
        title: "Do tecido ao despacho,",
        titleEm: "tudo na mesma esteira",
        teaser:
          "Estoque em etapas — tecido, peça, estampada, montada, expedida — e um planejamento que enxerga a fábrica.",
        intro:
          "O estoque agora acompanha a peça em cada estágio: do rolo de tecido à peça em branco, estampada, montada e expedida. E o Planejamento mostra a fábrica inteira numa tela, com a demanda saindo dos pedidos em aberto — então os gargalos aparecem antes de virarem atraso.",
        flow: [
          { icon: "layers", label: "Tecido", sub: "em rolo" },
          { icon: "scissors", label: "Corte", sub: "peça em branco" },
          { icon: "palette", label: "Estampa", sub: "e montagem", tone: "accent" },
          { icon: "truck", label: "Expedição", sub: "pronta", tone: "ok" },
        ],
        points: [
          "Cada etapa do estoque mostra o que entrou e o que saiu.",
          "O planejamento puxa a demanda direto dos pedidos em aberto.",
          "Gargalos ficam sinalizados pra você agir antes do atraso.",
        ],
      },
      en: {
        dateLabel: "May 2, 2026",
        area: "Production",
        title: "From fabric to dispatch,",
        titleEm: "one continuous line",
        teaser:
          "Stock in stages — fabric, blank, printed, assembled, shipped — and planning that sees the whole floor.",
        intro:
          "Stock now follows the garment through every stage: from the fabric roll to the blank, printed, assembled and shipped piece. And Planning shows the whole factory on one screen, with demand drawn from open orders — so bottlenecks surface before they turn into delays.",
        flow: [
          { icon: "layers", label: "Fabric", sub: "on the roll" },
          { icon: "scissors", label: "Cutting", sub: "blank piece" },
          { icon: "palette", label: "Print", sub: "and assembly", tone: "accent" },
          { icon: "truck", label: "Dispatch", sub: "ready", tone: "ok" },
        ],
        points: [
          "Each stock stage shows what came in and what went out.",
          "Planning pulls demand straight from open orders.",
          "Bottlenecks are flagged so you act before the delay.",
        ],
      },
    },
  },
  {
    id: "lotes-etiquetas",
    date: "2026-04-25",
    version: "v2.0",
    kind: "melhoria",
    areaIcon: "shopping-bag",
    areaColor: "#c2410c",
    content: {
      "pt-BR": {
        dateLabel: "25 de abril, 2026",
        area: "Vendas",
        title: "Lotes, separação",
        titleEm: "e etiqueta na mão",
        teaser:
          "Agrupe os pedidos em lotes, separe item a item e imprima as etiquetas de envio na hora.",
        intro:
          "Quem trabalha por lote agora tem um fluxo só: agrupe os pedidos do dia, mande pra separação item a item e imprima as etiquetas de envio — tudo no mesmo lugar, com o status sempre à vista.",
        flow: [
          { icon: "shopping-bag", label: "Pedidos", sub: "do dia" },
          { icon: "layers", label: "Lote", sub: "agrupado", tone: "accent" },
          { icon: "scan-line", label: "Separação", sub: "item a item" },
          { icon: "printer", label: "Etiquetas", sub: "de envio", tone: "ok" },
        ],
        points: [
          "Cada lote mostra o que ainda falta separar.",
          "Divergências na separação voltam pra conferência automaticamente.",
          "As etiquetas saem prontas pra colar e despachar.",
        ],
      },
      en: {
        dateLabel: "April 25, 2026",
        area: "Sales",
        title: "Batches, picking",
        titleEm: "and labels in hand",
        teaser:
          "Group orders into batches, pick item by item and print the shipping labels on the spot.",
        intro:
          "If you work in batches, you now have a single flow: group the day's orders, send them to picking item by item and print the shipping labels — all in one place, with the status always in view.",
        flow: [
          { icon: "shopping-bag", label: "Orders", sub: "of the day" },
          { icon: "layers", label: "Batch", sub: "grouped", tone: "accent" },
          { icon: "scan-line", label: "Picking", sub: "item by item" },
          { icon: "printer", label: "Labels", sub: "for shipping", tone: "ok" },
        ],
        points: [
          "Each batch shows what's still left to pick.",
          "Discrepancies during picking go back to checking automatically.",
          "Labels come out ready to stick on and ship.",
        ],
      },
    },
  },
  {
    id: "catalogo-producao-no-ar",
    date: "2026-04-18",
    version: "v1.4",
    kind: "novo",
    areaIcon: "file-text",
    areaColor: "#7e5bef",
    content: {
      "pt-BR": {
        dateLabel: "18 de abril, 2026",
        area: "Catálogo",
        title: "Catálogo e produção",
        titleEm: "no ar",
        teaser:
          "Produtos, fichas técnicas, estampas, tecido, corte, costura e bancas — a operação inteira no Orion.",
        intro:
          "A espinha dorsal da operação entrou no ar: cadastre produtos e variações, monte fichas técnicas com a imagem da peça, organize estampas e tecido, e acompanhe corte, costura e as bancas. E em cada tela tem o atalho \"Como funciona?\" pra explicar o fluxo na hora.",
        flow: [
          { icon: "file-text", label: "Produtos", sub: "e fichas" },
          { icon: "scissors", label: "Corte", sub: "e costura", tone: "accent" },
          { icon: "factory", label: "Bancas", sub: "acompanhadas" },
          { icon: "package-check", label: "Peça pronta", sub: "no estoque", tone: "ok" },
        ],
        points: [
          "Fichas técnicas com a imagem da peça — corte não erra o modelo.",
          "Corte, costura e bancas com status em cada etapa.",
          "O atalho \"Como funciona?\" explica cada tela na hora.",
        ],
      },
      en: {
        dateLabel: "April 18, 2026",
        area: "Catalog",
        title: "Catalog and production",
        titleEm: "go live",
        teaser:
          "Products, tech sheets, prints, fabric, cutting, sewing and workshops — the whole operation in Orion.",
        intro:
          "The backbone of the operation went live: register products and variations, build tech sheets with the garment's image, organize prints and fabric, and follow cutting, sewing and the workshops. And every screen has the \"How does it work?\" shortcut to explain the flow on the spot.",
        flow: [
          { icon: "file-text", label: "Products", sub: "and sheets" },
          { icon: "scissors", label: "Cutting", sub: "and sewing", tone: "accent" },
          { icon: "factory", label: "Workshops", sub: "tracked" },
          { icon: "package-check", label: "Finished piece", sub: "in stock", tone: "ok" },
        ],
        points: [
          "Tech sheets with the garment's image — cutting won't get the model wrong.",
          "Cutting, sewing and workshops with status at every stage.",
          "The \"How does it work?\" shortcut explains each screen on the spot.",
        ],
      },
    },
  },
  {
    id: "acesso-equipe",
    date: "2026-04-12",
    version: "v1.0",
    kind: "novo",
    areaIcon: "users",
    areaColor: "#0f766e",
    content: {
      "pt-BR": {
        dateLabel: "12 de abril, 2026",
        area: "Acesso",
        title: "Acesso por convite,",
        titleEm: "equipe e papéis",
        teaser:
          "Entrada só por convite, login por link mágico e cada pessoa com o papel certo.",
        intro:
          "O Orion começa pelo acesso: a entrada é só por convite, o login é por link mágico — sem senha pra esquecer — e cada pessoa recebe um papel com as permissões certas. Você convida a equipe e controla quem vê e faz o quê.",
        flow: [
          { icon: "mail", label: "Convite", sub: "por e-mail" },
          { icon: "key", label: "Link mágico", sub: "sem senha", tone: "accent" },
          { icon: "shield", label: "Papel", sub: "permissões certas", tone: "ok" },
        ],
        points: [
          "Entrada só por convite — ninguém cria conta sozinho.",
          "Cada papel define o que a pessoa vê e pode fazer.",
          "Os acessos ficam registrados pra você auditar depois.",
        ],
      },
      en: {
        dateLabel: "April 12, 2026",
        area: "Access",
        title: "Invite-only access,",
        titleEm: "team and roles",
        teaser:
          "Invite-only entry, magic-link sign-in and the right role for each person.",
        intro:
          "Orion starts with access: entry is invite-only, sign-in is by magic link — no password to forget — and each person gets a role with the right permissions. You invite the team and control who sees and does what.",
        flow: [
          { icon: "mail", label: "Invite", sub: "by email" },
          { icon: "key", label: "Magic link", sub: "no password", tone: "accent" },
          { icon: "shield", label: "Role", sub: "right permissions", tone: "ok" },
        ],
        points: [
          "Invite-only entry — no one signs themselves up.",
          "Each role defines what a person sees and can do.",
          "Sign-ins are logged so you can audit them later.",
        ],
      },
    },
  },
];

function resolveLocale(locale: string): Locale {
  return locale === "en" ? "en" : "pt-BR";
}

/** All releases resolved for `locale`, newest first. */
export function getReleases(locale: string): Release[] {
  const loc = resolveLocale(locale);
  return RELEASES.map(({ content, areaIcon, ...base }) => {
    const c = content[loc];
    return {
      ...base,
      AreaIcon: releaseIcon(areaIcon),
      ...c,
      flow: c.flow?.map((step) => ({ ...step, icon: releaseIcon(step.icon) })),
    };
  });
}

/** The newest release resolved for `locale`, or null when there are none. */
export function getLatestRelease(locale: string): Release | null {
  return getReleases(locale)[0] ?? null;
}

/** The newest release's id — locale-agnostic; backs the "seen" tracking. */
export const latestReleaseId: string | null = RELEASES[0]?.id ?? null;
