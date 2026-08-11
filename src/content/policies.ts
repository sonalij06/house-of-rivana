/**
 * Policy copy lives in code rather than the database: it changes rarely, needs
 * legal review when it does, and belongs in version control alongside the
 * checkout logic it describes.
 */

export type PolicyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] };

export type Policy = {
  slug: string;
  title: string;
  summary: string;
  updated: string;
  blocks: PolicyBlock[];
};

export const POLICIES: Policy[] = [
  {
    slug: "shipping",
    title: "Shipping",
    summary:
      "Insured delivery anywhere in India, dispatched within two working days of payment clearing.",
    updated: "2026-06-01",
    blocks: [
      {
        kind: "paragraph",
        text: "Every order ships insured for its full value and requires a signature on delivery. We ship within India only.",
      },
      { kind: "heading", text: "Dispatch times" },
      {
        kind: "list",
        items: [
          "In-stock pieces leave our Jaipur studio within two working days of payment being confirmed.",
          "Made-to-order or restock pieces carry a lead time shown on the product page when applicable.",
          "Orders placed on a Sunday or a public holiday are processed the next working day.",
        ],
      },
      { kind: "heading", text: "Charges" },
      {
        kind: "paragraph",
        text: "Shipping is free above the threshold shown at checkout. Below it, a flat insured rate applies regardless of order weight or destination.",
      },
      { kind: "heading", text: "Tracking" },
      {
        kind: "paragraph",
        text: "You will receive the courier name and AWB number by email and WhatsApp the moment the parcel is handed over. The same tracking is shown on your order page, so you never need to dig through your inbox.",
      },
      { kind: "heading", text: "If something goes wrong" },
      {
        kind: "paragraph",
        text: "If a parcel arrives damaged or the tamper seal is broken, refuse delivery and tell us the same day. Because every shipment is insured, we replace or refund without argument — but we cannot claim on a parcel that has already been accepted.",
      },
    ],
  },
  {
    slug: "returns",
    title: "Returns & Exchanges",
    summary:
      "Fifteen days to change your mind on unworn pieces. Custom-sized and engraved work is final sale.",
    updated: "2026-06-01",
    blocks: [
      {
        kind: "paragraph",
        text: "Jewellery is bought on feeling, and feeling sometimes changes once a piece is in your hand. You have fifteen days from delivery to return most pieces.",
      },
      { kind: "heading", text: "What we accept" },
      {
        kind: "list",
        items: [
          "Unworn pieces in their original box with tags and packaging intact.",
          "Exchanges for a different size in the same design, subject to availability.",
          "Any piece that arrived faulty, mis-set, or not as described — at any point, not just within fifteen days.",
        ],
      },
      { kind: "heading", text: "What we cannot accept" },
      {
        kind: "list",
        items: [
          "Personalised pieces that cannot be resold.",
          "Earrings that have been worn, for hygiene reasons.",
          "Pieces showing wear, scratches, bent findings, or altered by a third party.",
        ],
      },
      { kind: "heading", text: "How to start a return" },
      {
        kind: "paragraph",
        text: "Open the order in your account and request a return, or write to us with your order number. We arrange an insured pickup at our cost. Once the piece reaches our studio it is checked against the original photographs, which usually takes two working days.",
      },
      { kind: "heading", text: "Refunds" },
      {
        kind: "paragraph",
        text: "Approved refunds go back to the original payment method. UPI refunds typically settle within three working days; card refunds can take up to seven depending on your bank. We refund the full amount paid including the shipping charge if the piece was faulty.",
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    summary: "What we collect, why we collect it, and what we will never do with it.",
    updated: "2026-06-01",
    blocks: [
      {
        kind: "paragraph",
        text: "We collect the minimum needed to make and deliver your jewellery, and we do not sell or rent your data to anyone.",
      },
      { kind: "heading", text: "What we store" },
      {
        kind: "list",
        items: [
          "Your name, email, phone number and delivery addresses, so we can fulfil and support your orders.",
          "Your order history, including a snapshot of prices at the time of purchase.",
          "Payment references — a UPI transaction ID or a gateway payment ID. We never see or store your card number, UPI PIN, or bank credentials.",
          "Payment screenshots you upload for manual UPI verification, held in a private bucket and visible only to staff reviewing that order.",
        ],
      },
      { kind: "heading", text: "Who else sees it" },
      {
        kind: "paragraph",
        text: "Only the processors we need: our payment gateway, our courier, and our email and WhatsApp providers. Each receives only the fields required to do its job — the courier gets an address, not your order value beyond what insurance requires.",
      },
      { kind: "heading", text: "Marketing" },
      {
        kind: "paragraph",
        text: "We email about new collections only if you have asked us to. Every message carries a one-click unsubscribe, and unsubscribing never affects order notifications.",
      },
      { kind: "heading", text: "Your rights" },
      {
        kind: "paragraph",
        text: "Write to us at any time to see, correct, or delete what we hold. We keep order and tax records for as long as Indian law requires, and delete everything else on request.",
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Sale",
    summary: "The commercial terms that apply when you place an order with us.",
    updated: "2026-06-01",
    blocks: [
      {
        kind: "paragraph",
        text: "These terms apply to every order placed on this site. Placing an order is an offer to buy; our confirmation email is our acceptance of it.",
      },
      { kind: "heading", text: "Pricing" },
      {
        kind: "paragraph",
        text: "All prices are in Indian rupees and include GST. We recompute every total on our own server from our own prices before taking payment, so a stale page or a modified cart cannot change what you are charged. If a genuine pricing error occurs, we will contact you before dispatch and you may cancel for a full refund.",
      },
      { kind: "heading", text: "Stock and cancellation" },
      {
        kind: "paragraph",
        text: "Stock is held for you for a short window while you complete payment, after which it returns to general availability. We may cancel an order and refund in full if a piece turns out to be unavailable or if we cannot verify the payment.",
      },
      { kind: "heading", text: "Materials" },
      {
        kind: "paragraph",
        text: "House of Rivana sells artificial / fashion jewellery. Finishes are plated or tone-matched base metals unless a product page says otherwise. Stones are typically cubic zirconia (CZ), American diamond (AD), crystal or glass — not natural diamonds or precious gemstones. Plating and colour can vary slightly between batches and will wear with use; that is expected of fashion jewellery, not a defect.",
      },
      { kind: "heading", text: "Governing law" },
      {
        kind: "paragraph",
        text: "These terms are governed by Indian law, and the courts at Jaipur, Rajasthan have exclusive jurisdiction over any dispute arising from them.",
      },
    ],
  },
];

export function findPolicy(slug: string) {
  return POLICIES.find((policy) => policy.slug === slug);
}
