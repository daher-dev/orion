"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { useCreateSpec } from "@/hooks/use-specs";
import { SpecForm, type SpecFormSubmit } from "@/components/specs/SpecForm";
import { SpecDetailHeader } from "@/components/specs/SpecDetailHeader";
import { Button } from "@/components/ui/button";

export default function NewSpecPage() {
  const t = useTranslations();
  const router = useRouter();
  const create = useCreateSpec();

  const handleSubmit = async (payload: SpecFormSubmit) => {
    const result = await create.mutateAsync(payload);
    router.push(`/specs/${result.id}`);
  };

  return (
    <div data-testid="specs-new-page">
      <SpecDetailHeader
        eyebrow={t("specs.page.eyebrow")}
        title={t("specs.form.title.new")}
        sub={t("specs.list.sub")}
        actions={
          <Button asChild variant="outline">
            <Link href="/specs">
              <ChevronLeft className="size-3.5" /> {t("specs.actions.back")}
            </Link>
          </Button>
        }
      />
      <div className="rounded-xl border border-[color:var(--orion-line)] bg-[color:var(--orion-surface)] px-6 py-6">
        <SpecForm
          initial={null}
          submitting={create.isPending}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/specs")}
          apiError={create.error ?? null}
        />
      </div>
    </div>
  );
}
