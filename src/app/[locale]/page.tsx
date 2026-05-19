import { setRequestLocale } from "next-intl/server";
import { SiteNav } from "@/components/sections/nav";
import { Hero } from "@/components/sections/hero";
import { ProblemPromise } from "@/components/sections/problem-promise";
import { Method } from "@/components/sections/method";
import { Program } from "@/components/sections/program";
import { Author } from "@/components/sections/author";
import { Faq } from "@/components/sections/faq";
import { LeadForm } from "@/components/sections/lead-form";
import { Footer } from "@/components/sections/footer";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <ProblemPromise />
        <Method />
        <Program />
        <Author />
        <Faq />
        <LeadForm />
      </main>
      <Footer />
    </>
  );
}
