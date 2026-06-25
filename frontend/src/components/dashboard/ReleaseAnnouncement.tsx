"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import { useSeenRelease } from "@/hooks/use-seen-release";
import { Flow } from "@/components/page/Flow";

/**
 * Post-login announcement of the newest release, shown once on the home screen
 * until seen (localStorage `orion.seenRelease`). Direct port of the design's
 * `.fa-veil` / `.fa-card-lg` feature popup. Dismissing — via the X, the veil,
 * the changelog link, or Escape — marks the release seen so it won't return.
 */
export function ReleaseAnnouncement() {
  const locale = useLocale();
  const t = useTranslations("news");
  const { latest, hasUnseen, markSeen } = useSeenRelease(locale);
  const [dismissed, setDismissed] = useState(false);

  const open = hasUnseen && !dismissed && latest != null;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDismissed(true);
        markSeen();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, markSeen]);

  if (!open || !latest) return null;

  function close() {
    setDismissed(true);
    markSeen();
  }

  return (
    <div
      className="fa-veil"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="fa-card fa-card-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="release-announcement-title"
        style={{ "--c": latest.areaColor } as CSSProperties}
      >
        <div className="fa-accentbar" />
        <button type="button" className="fa-x" onClick={close} aria-label={t("close")}>
          <X size={17} />
        </button>

        <div className="fa-eyebrow">
          <Sparkles size={13} /> {t("popupEyebrow")} · {latest.version}
        </div>
        <h2 id="release-announcement-title" className="fa-title">
          {latest.title}
          {latest.titleEm ? <em> {latest.titleEm}</em> : null}
        </h2>
        <p className="fa-intro">{latest.intro}</p>

        {latest.flow ? (
          <div className="fa-flow">
            <Flow steps={latest.flow} accent={latest.areaColor} />
          </div>
        ) : null}

        {latest.stats ? (
          <div className="fa-stats">
            {latest.stats.map((stat, i) => (
              <div className="fa-stat" key={i}>
                <div className={"fa-stat-v" + (stat.up ? " pos" : "")}>{stat.value}</div>
                <div className="fa-stat-l">{stat.label}</div>
              </div>
            ))}
          </div>
        ) : null}

        <Link href={`/novidades#rel-${latest.id}`} className="fa-link" onClick={close}>
          {t("viewInHistory")} <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
