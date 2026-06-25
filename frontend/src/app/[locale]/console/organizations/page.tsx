"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Search, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/routing";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAdminOrganizations, useCreateOrganization } from "@/hooks/use-admin";
import { ConsoleHead } from "@/components/console-shell/ConsoleHead";
import {
  ConsoleButton,
  Meter,
  OrgMark,
  SoonBadge,
  useFormatters,
} from "@/components/console-shell/primitives";
import { useImpersonateAction } from "@/components/console-shell/useImpersonateAction";

export default function ConsoleOrganizationsPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const router = useRouter();
  const { fmtInt } = useFormatters(locale);
  const { data, isPending } = useAdminOrganizations();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const impersonate = useImpersonateAction();

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    if (!q) return items;
    const needle = q.toLowerCase();
    return items.filter((o) => (o.name + " " + o.subdomain).toLowerCase().includes(needle));
  }, [data, q]);

  return (
    <div>
      <ConsoleHead
        icon={Building2}
        color="var(--console-accent)"
        eyebrow={t("nav.platform")}
        title={t("organizations.title")}
        desc={t("organizations.desc")}
        actions={
          <ConsoleButton variant="primary" onClick={() => setCreating(true)}>
            <Building2 size={13} /> {t("organizations.new")}
          </ConsoleButton>
        }
      />

      <div className="overflow-hidden rounded-[14px] border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)]">
        <div className="flex items-center gap-3 border-b border-[color:var(--orion-line-soft)] p-3">
          <div className="relative max-w-[280px] flex-1">
            <Search className="absolute top-1/2 left-2.5 size-[14px] -translate-y-1/2 text-[color:var(--orion-ink-3)]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("organizations.searchPlaceholder")}
              className="h-9 pl-8"
            />
          </div>
          <span className="ml-auto text-[12px] text-[color:var(--orion-ink-3)]">
            {t("organizations.count", { count: rows.length })}
          </span>
        </div>

        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[color:var(--orion-ink-3)]">
              <Th>{t("organizations.cols.org")}</Th>
              <Th>
                {t("organizations.cols.plan")} <SoonBadge />
              </Th>
              <Th>
                {t("organizations.cols.status")} <SoonBadge />
              </Th>
              <Th>{t("organizations.cols.team")}</Th>
              <Th>{t("organizations.cols.ordersMonth")}</Th>
              <Th className="text-right">{t("organizations.cols.mrr")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              <tr>
                <td colSpan={7} className="px-[18px] py-10 text-center text-[color:var(--orion-ink-3)]">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-[18px] py-12 text-center text-[13px] text-[color:var(--orion-ink-3)]">
                  {t("organizations.empty")}
                </td>
              </tr>
            ) : (
              rows.map((o) => (
                <tr
                  key={o.id}
                  tabIndex={0}
                  aria-label={t("organizations.openAria", { name: o.name })}
                  onClick={() => router.push(`/console/organizations/${o.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/console/organizations/${o.id}`);
                    }
                  }}
                  className="cursor-pointer border-t border-[color:var(--orion-line-soft)] outline-none hover:bg-[color:var(--orion-surface-2)] focus-visible:bg-[color:var(--orion-surface-2)] focus-visible:ring-2 focus-visible:ring-[color:var(--console-accent)] focus-visible:ring-inset"
                >
                  <Td>
                    <div className="flex items-center gap-3">
                      <OrgMark name={o.name} accent={o.accent} />
                      <div className="min-w-0">
                        <div className="font-medium whitespace-nowrap text-[color:var(--orion-ink)]">{o.name}</div>
                        <div className="font-mono text-[11.5px] whitespace-nowrap text-[color:var(--orion-ink-3)]">
                          {o.subdomain}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-[12px] text-[color:var(--orion-ink-3)]">—</span>
                  </Td>
                  <Td>
                    <span className="text-[12px] text-[color:var(--orion-ink-3)]">—</span>
                  </Td>
                  <Td>
                    <span className="tabular-nums">{o.member_count}</span>
                  </Td>
                  <Td>
                    <div className="min-w-[96px]">
                      <div className="mb-1 text-[12px] tabular-nums text-[color:var(--orion-ink-2)]">
                        {fmtInt(o.orders_month)}
                      </div>
                      <Meter value={o.orders_month} cap={999999} />
                    </div>
                  </Td>
                  <Td className="text-right text-[color:var(--orion-ink-3)]">—</Td>
                  <Td className="text-right">
                    <ConsoleButton
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        impersonate.run(o);
                      }}
                      disabled={impersonate.pendingId === o.id}
                    >
                      {impersonate.pendingId === o.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <LogIn size={12} />
                      )}
                      {t("organizations.enter")}
                    </ConsoleButton>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NewOrgSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-[18px] py-2.5 font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-[18px] py-3 align-middle ${className}`}>{children}</td>;
}

function NewOrgSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("console");
  const create = useCreateOrganization();
  const [name, setName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const valid = name.trim() && subdomain.trim() && ownerEmail.trim();

  function reset() {
    setName("");
    setSubdomain("");
    setOwnerEmail("");
  }

  function submit() {
    create.mutate(
      { name: name.trim(), subdomain: subdomain.trim().toLowerCase(), owner_email: ownerEmail.trim() },
      {
        onSuccess: (res) => {
          toast.success(t("organizations.created", { name: res.organization.name }), {
            description: t("organizations.createdDesc", { email: res.owner_email }),
          });
          reset();
          onClose();
        },
        onError: (err) => toast.error(err.detail ?? t("organizations.createError")),
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="console-scope w-full overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>{t("organizations.sheet.title")}</SheetTitle>
          <SheetDescription>{t("organizations.sheet.sub")}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <Field label={t("organizations.sheet.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ateliê Boa Vista" />
          </Field>
          <Field label={t("organizations.sheet.subdomain")} hint={t("organizations.sheet.subdomainHint")}>
            <Input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="boavista"
              className="font-mono"
            />
          </Field>
          <Field label={t("organizations.sheet.ownerEmail")} hint={t("organizations.sheet.ownerEmailHint")}>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="titular@empresa.com"
            />
          </Field>
        </div>
        <SheetFooter>
          <ConsoleButton onClick={onClose}>{t("common.cancel")}</ConsoleButton>
          <ConsoleButton variant="primary" disabled={!valid || create.isPending} onClick={submit}>
            {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Building2 size={13} />}
            {t("organizations.sheet.submit")}
          </ConsoleButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[12.5px] font-medium text-[color:var(--orion-ink-2)]">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-[color:var(--orion-ink-3)]">{hint}</span>}
    </label>
  );
}
