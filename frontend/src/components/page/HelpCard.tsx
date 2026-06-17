"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { HelpCircle, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Flow, type FlowStep } from "@/components/page/Flow";

/**
 * Per-page "Como funciona?" help — direct port of `HelpCard` from
 * /docs/design/source/ui.jsx.
 *
 * A collapsed "help-circle" pill lives in the page header (rendered by
 * `PageHead`). Clicking it opens a dismissible popover, portaled to
 * `document.body` and positioned just below the pill with a caret: a tinted
 * icon badge, a bold title, an explanatory paragraph (bold key terms), and an
 * animated `<Flow>` diagram. Dismisses on outside-click, Escape, and
 * repositions on scroll/resize. The flow pulse respects
 * `prefers-reduced-motion` (handled inside `<Flow>` + the flow CSS).
 */

export type HelpFlowStep = FlowStep;

export type HelpCardProps = {
  /** Icon for the popover's tinted badge. */
  icon: LucideIcon;
  /** Bold popover title. */
  title: string;
  /** Explanatory paragraph — pass `t.rich(...)` with a `<b>` tag for bold terms. */
  body?: ReactNode;
  /** Animated flow steps. */
  steps?: HelpFlowStep[];
  /** CSS var or color driving the badge tint + the flow accent. */
  tone?: string;
  /** Popover max width (px). Defaults to 600, matching the prototype. */
  maxW?: number;
};

type Pos = { left: number; top: number; width: number; caret: number };

export function HelpCard({ icon: Icon, title, body, steps, tone, maxW = 600 }: HelpCardProps) {
  const t = useTranslations("common");
  const label = t("help.label");
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 12;
    const gap = 10;
    const width = Math.min(maxW, window.innerWidth - margin * 2);
    let left = r.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - width));
    const caret = Math.max(16, Math.min(width - 16, r.left + r.width / 2 - left));
    setPos({ left, top: r.bottom + gap, width, caret });
  }, [maxW]);

  // Move keyboard focus into the dialog when it opens by focusing the close
  // button as it mounts — the popover is portaled to the end of <body>, so tab
  // order wouldn't otherwise reach it. Focus entering role="dialog" also makes
  // assistive tech announce the popover and its title.
  const focusOnMount = useCallback((node: HTMLButtonElement | null) => {
    node?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    // pointerdown (not mousedown) so outside-click dismissal also fires for
    // touch and pen input, not just mouse.
    const onDoc = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    // Throttle reposition to one measure per frame: scroll (especially
    // capture-phase events from nested scrollers) and resize can fire rapidly,
    // and an unthrottled setPos on each event causes avoidable re-renders/jank.
    let rafId = 0;
    const onMove = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        measure();
      });
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, measure]);

  const popover =
    open && pos
      ? createPortal(
          <div
            ref={popRef}
            className="help-pop"
            role="dialog"
            aria-labelledby={title ? titleId : undefined}
            style={
              {
                left: pos.left,
                top: pos.top,
                width: pos.width,
                zIndex: 300,
                "--flow-accent": tone || "var(--ember)",
              } as CSSProperties
            }
          >
            <span className="help-pop-caret" style={{ left: pos.caret }} />
            <button
              type="button"
              className="help-pop-x"
              ref={focusOnMount}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus({ preventScroll: true });
              }}
              aria-label={t("help.close")}
            >
              <X size={15} />
            </button>
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <span
                className="help-pop-badge"
                style={
                  tone
                    ? { background: `color-mix(in oklab, ${tone} 15%, var(--orion-surface))`, color: tone }
                    : undefined
                }
              >
                <Icon size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 22 }}>
                {title ? (
                  <div
                    id={titleId}
                    style={{ fontSize: 14, fontWeight: 600, color: "var(--orion-ink)" }}
                  >
                    {title}
                  </div>
                ) : null}
                {body ? <p className="help-pop-body">{body}</p> : null}
                {steps && steps.length > 0 ? (
                  <Flow steps={steps} accent={tone || "var(--ember)"} />
                ) : null}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={"help-pill" + (open ? " on" : "")}
        onClick={() => setOpen((v) => !v)}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <HelpCircle size={15} style={{ flexShrink: 0 }} />
        <span className="help-pill-label">{label}</span>
      </button>
      {popover}
    </>
  );
}
