"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Animated flow diagram for help popovers — direct port of `FlowNode`,
 * `FlowArrow`, and `Flow` from /docs/design/source/ui.jsx.
 *
 * A row of labelled nodes joined by arrows. A highlight pulse travels
 * left→right through the chain (one node every 1050ms) and each arrow carries
 * a continuous travelling dot — together they make the pipeline direction
 * legible at a glance. The pulse is disabled under `prefers-reduced-motion`
 * and for chains shorter than two nodes; the CSS disables the dot animation
 * under reduced motion as well.
 */

export type FlowStepTone = "accent" | "ok" | "warn";

export type FlowStep = {
  /** lucide-react icon component rendered in the node's icon slot. */
  icon: LucideIcon;
  /** Bold node label. */
  label: string;
  /** Optional muted sub-label under the label. */
  sub?: string;
  /** Persistent node tint — maps to the `.flow-nd.t-*` classes. */
  tone?: FlowStepTone;
};

function FlowNode({ icon: Icon, label, sub, tone, on }: FlowStep & { on: boolean }) {
  return (
    <div className={"flow-nd" + (tone ? " t-" + tone : "") + (on ? " on" : "")}>
      <span className="flow-nd-ic">
        <Icon size={15} />
      </span>
      <span className="flow-nd-tx">
        <span className="flow-nd-lb">{label}</span>
        {sub ? <span className="flow-nd-sb">{sub}</span> : null}
      </span>
    </div>
  );
}

function FlowArrow({ on }: { on: boolean }) {
  return (
    <span className={"flow-ar" + (on ? " on" : "")} aria-hidden="true">
      <span className="flow-ar-line" />
      <span className="flow-ar-dot" />
      <svg className="flow-ar-head" width="7" height="10" viewBox="0 0 7 10">
        <path
          d="M1 1l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function Flow({ steps, accent }: { steps: FlowStep[]; accent?: string }) {
  // -1 = no node highlighted. This is the resting state whenever the pulse is
  // disabled (reduced-motion users, or chains shorter than two nodes): the
  // effect returns early without starting the interval, so `active` stays at
  // -1 and the diagram renders fully static with no arbitrary node lit. When
  // the pulse is enabled the interval is the sole writer of `active` — its
  // first tick moves -1 → 0, lighting the first node, then travels onward.
  // (Never set state synchronously in the effect body — that cascades renders.)
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    if (steps.length < 2) return;
    const id = setInterval(() => setActive((v) => (v + 1) % steps.length), 1050);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div
      className="flow"
      style={accent ? ({ "--flow-accent": accent } as CSSProperties) : undefined}
    >
      {steps.map((step, idx) => (
        <Fragment key={idx}>
          {idx > 0 ? <FlowArrow on={active === idx} /> : null}
          <FlowNode {...step} on={active === idx} />
        </Fragment>
      ))}
    </div>
  );
}
