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
    id: "conferencia-tempo-real",
    date: "2026-06-12",
    version: "v3.4",
    kind: "novo",
    areaIcon: "layout-dashboard",
    areaColor: "#a83227",
    content: {
      "pt-BR": {
        dateLabel: "12 de junho, 2026",
        area: "Início",
        title: "Conferência em tempo real,",
        titleEm: "do pedido à expedição",
        teaser:
          "A tela inicial agora mostra a conferência do lote acontecendo ao vivo — sem planilha, sem recarregar.",
        intro:
          "Toda manhã o Orion importa os pedidos dos seus canais e monta o lote do dia. Agora a tela inicial mostra a conferência acontecendo ao vivo: cada peça conferida, cada parcial resolvida e cada problema sinalizado aparece na hora. Você abre o Orion e já enxerga onde o lote está.",
        stats: [
          { value: "−42%", label: "tempo de conferência", up: true },
          { value: "859", label: "pedidos no lote de hoje" },
          { value: "ao vivo", label: "progresso atualiza sozinho" },
        ],
        flow: [
          { icon: "download", label: "Importar", sub: "dos canais" },
          { icon: "clipboard-check", label: "Conferir", sub: "peça a peça", tone: "accent" },
          { icon: "wrench", label: "Resolver", sub: "parciais e problemas", tone: "warn" },
          { icon: "truck", label: "Expedir", sub: "sai hoje", tone: "ok" },
        ],
        points: [
          "Os números da tela inicial são clicáveis — levam direto à tela que resolve.",
          "Parciais e problemas ganham destaque, então você ataca primeiro o que trava a produção.",
          "O progresso do lote atualiza sozinho conforme a equipe confere.",
        ],
        image: "Tela inicial · Resumo da conferência ao vivo",
      },
      en: {
        dateLabel: "June 12, 2026",
        area: "Home",
        title: "Real-time checking,",
        titleEm: "from order to dispatch",
        teaser:
          "The home screen now shows the day's batch being checked live — no spreadsheet, no reloading.",
        intro:
          "Every morning Orion imports your orders from every channel and builds the day's batch. Now the home screen shows the checking happening live: every item checked, every partial resolved and every flagged problem appears instantly. You open Orion and immediately see where the batch stands.",
        stats: [
          { value: "−42%", label: "checking time", up: true },
          { value: "859", label: "orders in today's batch" },
          { value: "live", label: "progress updates itself" },
        ],
        flow: [
          { icon: "download", label: "Import", sub: "from channels" },
          { icon: "clipboard-check", label: "Check", sub: "piece by piece", tone: "accent" },
          { icon: "wrench", label: "Resolve", sub: "partials & problems", tone: "warn" },
          { icon: "truck", label: "Dispatch", sub: "ships today", tone: "ok" },
        ],
        points: [
          "The home-screen numbers are clickable — they take you straight to the screen that resolves them.",
          "Partials and problems are highlighted, so you tackle what's blocking production first.",
          "The batch progress updates on its own as the team checks.",
        ],
        image: "Home screen · Live checking summary",
      },
    },
  },
  {
    id: "mapeamento-estampas",
    date: "2026-05-28",
    version: "v3.3",
    kind: "novo",
    areaIcon: "palette",
    areaColor: "#7e5bef",
    content: {
      "pt-BR": {
        dateLabel: "28 de maio, 2026",
        area: "Catálogo",
        title: "Estampas mapeadas",
        titleEm: "sem trabalho manual",
        teaser:
          "O Orion reconhece o produto e vincula a estampa sozinho. Você só revisa as exceções.",
        intro:
          "Antes, cada item importado precisava ser vinculado à sua estampa na mão — um por um, todo dia. Agora o Orion reconhece o produto pelo código do anúncio e faz o vínculo sozinho. Você entra apenas para revisar o que ficou em dúvida.",
        stats: [
          { value: "1.077", label: "itens mapeados hoje" },
          { value: "100%", label: "do lote vinculado", up: true },
          { value: "~3 s", label: "por lote, antes ~40 min", up: true },
        ],
        points: [
          "Itens sem correspondência ficam separados para revisão rápida.",
          "Cada vínculo que você confirma ensina o Orion para a próxima vez.",
          "A conferência começa com tudo já vinculado.",
        ],
      },
      en: {
        dateLabel: "May 28, 2026",
        area: "Catalog",
        title: "Prints mapped",
        titleEm: "with no manual work",
        teaser:
          "Orion recognizes the product and links the print on its own. You only review the exceptions.",
        intro:
          "Before, every imported item had to be linked to its print by hand — one by one, every day. Now Orion recognizes the product from the listing code and makes the link itself. You step in only to review whatever's in doubt.",
        stats: [
          { value: "1,077", label: "items mapped today" },
          { value: "100%", label: "of the batch linked", up: true },
          { value: "~3 s", label: "per batch, was ~40 min", up: true },
        ],
        points: [
          "Items without a match are set aside for a quick review.",
          "Every link you confirm teaches Orion for next time.",
          "Checking starts with everything already linked.",
        ],
      },
    },
  },
  {
    id: "lotes-separacao",
    date: "2026-05-10",
    version: "v3.2",
    kind: "melhoria",
    areaIcon: "shopping-bag",
    areaColor: "#c2410c",
    content: {
      "pt-BR": {
        dateLabel: "10 de maio, 2026",
        area: "Vendas",
        title: "Lotes e separação,",
        titleEm: "lado a lado",
        teaser: "Agrupe pedidos em lotes e acompanhe a separação na mesma tela.",
        intro:
          "Quem trabalha por lote agora tem um fluxo só: agrupe os pedidos do dia, mande para separação e acompanhe cada caixa fechar — tudo no mesmo lugar, com o status sempre à vista.",
        flow: [
          { icon: "shopping-bag", label: "Pedidos", sub: "do dia" },
          { icon: "layers", label: "Lote", sub: "agrupado", tone: "accent" },
          { icon: "scan-line", label: "Separação", sub: "caixa a caixa" },
          { icon: "package-check", label: "Despacho", sub: "conferido", tone: "ok" },
        ],
        points: [
          "Cada lote mostra quantas peças faltam separar em tempo real.",
          "Divergências na separação voltam para a conferência automaticamente.",
        ],
      },
      en: {
        dateLabel: "May 10, 2026",
        area: "Sales",
        title: "Batches and picking,",
        titleEm: "side by side",
        teaser: "Group orders into batches and track picking on the same screen.",
        intro:
          "If you work in batches, you now have a single flow: group the day's orders, send them to picking and watch each box close — all in one place, with the status always in view.",
        flow: [
          { icon: "shopping-bag", label: "Orders", sub: "of the day" },
          { icon: "layers", label: "Batch", sub: "grouped", tone: "accent" },
          { icon: "scan-line", label: "Picking", sub: "box by box" },
          { icon: "package-check", label: "Dispatch", sub: "checked", tone: "ok" },
        ],
        points: [
          "Each batch shows how many pieces are left to pick in real time.",
          "Discrepancies during picking go back to checking automatically.",
        ],
      },
    },
  },
  {
    id: "fichas-miniatura",
    date: "2026-04-22",
    version: "v3.1",
    kind: "melhoria",
    areaIcon: "file-text",
    areaColor: "#7e5bef",
    content: {
      "pt-BR": {
        dateLabel: "22 de abril, 2026",
        area: "Catálogo",
        title: "Fichas técnicas",
        titleEm: "com a peça à vista",
        teaser:
          "Agora dá para anexar a imagem da peça na ficha técnica — corte não erra mais o modelo.",
        intro:
          "Uma ficha técnica sem foto deixa margem para erro no corte e na costura. Agora você anexa a imagem da peça direto na ficha, arrastando o arquivo, e todo mundo na produção vê exatamente o que está fazendo.",
        stats: [
          { value: "arraste", label: "e solte a imagem" },
          { value: "1 fonte", label: "de verdade para a fábrica", up: true },
        ],
        points: [
          "A miniatura aparece em todo lugar que cita a peça.",
          "Menos ida e volta entre o corte e o escritório.",
        ],
      },
      en: {
        dateLabel: "April 22, 2026",
        area: "Catalog",
        title: "Tech sheets",
        titleEm: "with the garment in view",
        teaser:
          "You can now attach the garment's image to the tech sheet — cutting won't get the model wrong anymore.",
        intro:
          "A tech sheet without a photo leaves room for error in cutting and sewing. Now you attach the garment's image straight onto the sheet by dragging the file, and everyone on the floor sees exactly what they're making.",
        stats: [
          { value: "drag", label: "and drop the image" },
          { value: "1 source", label: "of truth for the floor", up: true },
        ],
        points: [
          "The thumbnail shows up everywhere the garment is referenced.",
          "Less back-and-forth between cutting and the office.",
        ],
      },
    },
  },
  {
    id: "planejamento-radar",
    date: "2026-04-03",
    version: "v3.0",
    kind: "novo",
    areaIcon: "radar",
    areaColor: "#0f766e",
    content: {
      "pt-BR": {
        dateLabel: "3 de abril, 2026",
        area: "Produção",
        title: "Planejamento",
        titleEm: "que enxerga a fábrica",
        teaser:
          "Uma visão de radar do que está em corte, em costura e nas bancas — antes de virar atraso.",
        intro:
          "O novo Planejamento mostra a fábrica inteira numa tela: o que está em corte, o que saiu para costura e o que voltou das bancas. Os gargalos aparecem antes de virarem atraso, então dá para remanejar a tempo.",
        stats: [
          { value: "1 tela", label: "para a produção inteira" },
          { value: "antes", label: "do atraso acontecer", up: true },
        ],
        points: [
          "Cada etapa mostra a fila e quem está responsável.",
          "Gargalos ficam sinalizados para você agir primeiro.",
        ],
      },
      en: {
        dateLabel: "April 3, 2026",
        area: "Production",
        title: "Planning",
        titleEm: "that sees the whole floor",
        teaser:
          "A radar view of what's in cutting, in sewing and out at the workshops — before it becomes a delay.",
        intro:
          "The new Planning shows the whole factory on one screen: what's in cutting, what went out to sewing and what's come back from the workshops. Bottlenecks surface before they turn into delays, so you can reshuffle in time.",
        stats: [
          { value: "1 screen", label: "for the whole production line" },
          { value: "ahead", label: "of the delay happening", up: true },
        ],
        points: [
          "Each stage shows the queue and who's responsible.",
          "Bottlenecks are flagged so you act on them first.",
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
