import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Prose } from "@/components/layout/prose";
import { POLICIES, findPolicy } from "@/content/policies";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Params = { slug: string };

export function generateStaticParams() {
  return POLICIES.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const policy = findPolicy(slug);
  if (!policy) return { title: "Policy not found" };
  return {
    title: policy.title,
    description: policy.summary,
    alternates: { canonical: `/policies/${policy.slug}` },
  };
}

export default async function PolicyPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const policy = findPolicy(slug);
  if (!policy) notFound();

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Policies"
        title={policy.title}
        description={policy.summary}
        crumbs={[{ label: policy.title }]}
      />

      <div className="mt-10 grid gap-12 lg:grid-cols-[13rem_1fr] lg:gap-16">
        <nav aria-label="Policies" className="lg:sticky lg:top-28 lg:self-start">
          <ul className="space-y-2.5">
            {POLICIES.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/policies/${entry.slug}`}
                  aria-current={entry.slug === policy.slug ? "page" : undefined}
                  className={cn(
                    "rule-wipe text-sm transition-colors",
                    entry.slug === policy.slug
                      ? "font-medium text-gold"
                      : "text-muted hover:text-ink",
                  )}
                  data-active={entry.slug === policy.slug}
                >
                  {entry.title}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-[0.625rem] uppercase tracking-[0.14em] text-muted-light">
            Updated {formatDate(policy.updated)}
          </p>
        </nav>

        <Prose blocks={policy.blocks} />
      </div>
    </div>
  );
}
