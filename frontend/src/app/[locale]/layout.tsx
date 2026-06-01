import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { CompanyProvider } from "@/providers/company-provider";
import { fontVariableClasses } from "@/app/layout";
import "../globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: { default: "Orion", template: "%s · Orion" },
    description: `Orion — ${t("tagline")}. ${t("taglineLong")}`,
    applicationName: "Orion",
    openGraph: {
      title: "Orion",
      description: t("taglineLong"),
      siteName: "Orion",
      type: "website",
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: "Orion",
      description: t("taglineLong"),
    },
  };
}

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Root layout for all locale-prefixed routes.
 *
 * Provider order matters:
 *   ThemeProvider              ← controls .dark on <html>
 *   > NextIntlClientProvider   ← exposes useTranslations()
 *     > QueryProvider          ← TanStack Query client
 *       > AuthProvider         ← Firebase auth + dev-bypass user
 *         > CompanyProvider    ← selected tenant id, can clear queries
 *           > children
 *
 * AuthProvider sits inside QueryProvider because CompanyProvider's
 * setCompanyId calls queryClient.clear() — both providers must see the
 * same QueryClient instance.
 */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as never)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning className={fontVariableClasses}>
      <body className="antialiased">
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <AuthProvider>
                <CompanyProvider>{children}</CompanyProvider>
              </AuthProvider>
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
