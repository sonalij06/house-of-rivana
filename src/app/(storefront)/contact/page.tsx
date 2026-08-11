import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ContactForm } from "@/components/layout/contact-form";
import { Reveal } from "@/components/motion/primitives";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Questions about a piece, a size, or a commission? Write to House of Rivana and a person who has held the piece will reply.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSettings();
  const whatsapp = settings.whatsappNumber.replace(/[^\d]/g, "");

  return (
    <div className="container-site py-12 md:py-16">
      <PageHeader
        eyebrow="Talk to us"
        title="We answer our own email"
        description="No ticket numbers and no scripts. Tell us what you need and someone who has actually held the piece will reply, usually within one business day."
        crumbs={[{ label: "Contact" }]}
      />

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_18rem] lg:gap-16">
        <ContactForm />

        <aside className="space-y-7 lg:border-l lg:border-hairline lg:pl-10">
          <Reveal distance={14}>
            <ContactRow
              icon={<Mail className="size-4" strokeWidth={1.6} />}
              label="Email"
              value={settings.supportEmail}
              href={`mailto:${settings.supportEmail}`}
            />
          </Reveal>

          {settings.supportPhone ? (
            <Reveal distance={14} delay={0.05}>
              <ContactRow
                icon={<Phone className="size-4" strokeWidth={1.6} />}
                label="Phone"
                value={settings.supportPhone}
                href={`tel:${settings.supportPhone.replace(/\s/g, "")}`}
                note="Mon–Sat, 10am to 6pm IST"
              />
            </Reveal>
          ) : null}

          {whatsapp ? (
            <Reveal distance={14} delay={0.1}>
              <ContactRow
                icon={<MessageCircle className="size-4" strokeWidth={1.6} />}
                label="WhatsApp"
                value={settings.whatsappNumber}
                href={`https://wa.me/${whatsapp}`}
                note="Fastest for sizing and order questions"
              />
            </Reveal>
          ) : null}

          {settings.addressText ? (
            <Reveal distance={14} delay={0.15}>
              <ContactRow
                icon={<MapPin className="size-4" strokeWidth={1.6} />}
                label="Studio"
                value={settings.addressText}
                note="Visits by appointment only"
              />
            </Reveal>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  note?: string;
}) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 shrink-0 text-gold">{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.625rem] uppercase tracking-[0.16em] text-muted-light">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            className="mt-1 block break-words text-sm text-ink underline-offset-4 transition-colors hover:text-gold hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{value}</p>
        )}
        {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
      </div>
    </div>
  );
}
