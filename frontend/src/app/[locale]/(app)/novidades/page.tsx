"use client";

import { useEffect, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ImageIcon, Sparkles } from "lucide-react";
import { getReleases, type Release, type ReleaseKind } from "@/data/releases";
import { Flow } from "@/components/page/Flow";
import { useSeenRelease } from "@/hooks/use-seen-release";

const KIND_KEY: Record<ReleaseKind, "kindNovo" | "kindMelhoria" | "kindCorrecao"> = {
  novo: "kindNovo",
  melhoria: "kindMelhoria",
  correcao: "kindCorrecao",
};

/**
 * Novidades (What's New) — the release changelog as a vertical timeline.
 * Direct port of /docs/design/Novidades.html, rendered inside the app shell.
 * Visiting clears the top-bar "unseen" dot + the home popup (markSeen).
 */
export default function NovidadesPage() {
  const locale = useLocale();
  const t = useTranslations("news");
  const releases = getReleases(locale);
  const { markSeen } = useSeenRelease(locale);

  useEffect(() => {
    markSeen();
  }, [markSeen]);

  return (
    <div className="mx-auto max-w-[960px]">
      <section className="nv-hero">
        <div className="nv-eyebrow">
          <Sparkles size={13} /> {t("heroEyebrow")}
        </div>
        <h1 className="nv-h1">
          {t("heroTitle")}
          <br />
          <em>{t("heroTitleEm")}</em>
        </h1>
        <p className="nv-lede">{t("heroLede")}</p>
      </section>

      <main className="nv-timeline">
        {releases.map((release) => (
          <ReleaseEntry key={release.id} release={release} kindLabel={t(KIND_KEY[release.kind])} />
        ))}
      </main>
    </div>
  );
}

function ReleaseEntry({ release, kindLabel }: { release: Release; kindLabel: string }) {
  const AreaIcon = release.AreaIcon;

  return (
    <article className="rel" id={`rel-${release.id}`} style={{ "--c": release.areaColor } as CSSProperties}>
      <div className="rel-rail">
        <div className="rel-node">
          <AreaIcon size={14} strokeWidth={2} />
        </div>
      </div>
      <div className="rel-main">
        <div className="rel-meta">
          <span className="rel-date">{release.dateLabel}</span>
          <span className="rel-ver">{release.version}</span>
          <span className={`rel-kind k-${release.kind}`}>{kindLabel}</span>
          <span className="rel-area">
            <AreaIcon size={12} strokeWidth={2.2} />
            {release.area}
          </span>
        </div>

        <h2 className="rel-title">
          {release.title}
          {release.titleEm ? <em> {release.titleEm}</em> : null}
        </h2>
        <p className="rel-intro">{release.intro}</p>

        {release.stats ? (
          <div className="rel-stats">
            {release.stats.map((stat, i) => (
              <div className="rel-stat" key={i}>
                <div className={"rel-stat-v" + (stat.up ? " pos" : "")}>{stat.value}</div>
                <div className="rel-stat-l">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {release.flow ? (
          <div className="rel-flow-wrap">
            <Flow steps={release.flow} accent={release.areaColor} />
          </div>
        ) : null}

        {release.image ? (
          <div className="rel-shot">
            <span className="ic">
              <ImageIcon size={24} />
            </span>
            <span className="rel-shot-cap">{release.image}</span>
          </div>
        ) : null}

        {release.points ? (
          <ul className="rel-points">
            {release.points.map((point, i) => (
              <li key={i}>
                <span className="ck">
                  <Check size={12} strokeWidth={2.6} />
                </span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
