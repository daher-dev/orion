import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export function SettingsPlaceholder({ icon: Icon, title, body }: Props) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-14 text-center">
      <div
        aria-hidden
        className="mx-auto mb-3 grid size-10 place-items-center rounded-[10px] border border-[color:var(--orion-line)] bg-[color:var(--orion-bg)] text-[color:var(--brand-settings)]"
      >
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </div>
      <h3 className="font-serif text-[17px] font-medium tracking-[-0.01em] text-[color:var(--orion-ink)]">
        {title}
      </h3>
      <p className="mx-auto mt-1.5 max-w-[42ch] text-[13px] leading-[1.5] text-[color:var(--orion-ink-3)]">
        {body}
      </p>
    </div>
  );
}
