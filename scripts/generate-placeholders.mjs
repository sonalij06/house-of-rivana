/**
 * Generates the placeholder photography used by the seed data.
 *
 * Real product shots are uploaded through /admin/products, but the seeded catalog
 * needs images that are guaranteed to exist offline. These are minimal line-art
 * SVGs in the brand palette so a fresh install still looks composed.
 *
 *   node scripts/generate-placeholders.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "placeholders");

const PALETTES = {
  cream: { bg1: "#faf8f5", bg2: "#efe7db", line: "#8b6914", accent: "#c9a962" },
  blush: { bg1: "#f7ece9", bg2: "#e9d9d4", line: "#8a5a49", accent: "#c9a962" },
  sage: { bg1: "#f0f2ec", bg2: "#dde2d6", line: "#5c6b52", accent: "#a8a06a" },
  ink: { bg1: "#22201d", bg2: "#3b3733", line: "#e3d3ac", accent: "#c9a962" },
  champagne: { bg1: "#f6efe2", bg2: "#e6d6b4", line: "#7a5c14", accent: "#8b6914" },
  // Dark palettes for collection covers and heroes, where cream copy sits on top.
  graphite: { bg1: "#1f1e1c", bg2: "#332f2b", line: "#d8c69b", accent: "#c9a962" },
  umber: { bg1: "#2a211a", bg2: "#3f3226", line: "#e0cda4", accent: "#c9a962" },
  forest: { bg1: "#1e251f", bg2: "#333d33", line: "#cfd6b8", accent: "#c9a962" },
  aubergine: { bg1: "#271f26", bg2: "#3b2f39", line: "#e2cdd6", accent: "#c9a962" },
};

/** Line-art motifs, drawn inside a 0 0 400 400 viewport. */
const MOTIFS = {
  ring: `
    <ellipse cx="200" cy="235" rx="74" ry="76" />
    <ellipse cx="200" cy="235" rx="58" ry="60" />
    <path d="M200 130 l26 32 -26 30 -26-30z" class="accent" />
    <path d="M174 162 h52" class="accent" />`,
  solitaire: `
    <ellipse cx="200" cy="250" rx="70" ry="72" />
    <ellipse cx="200" cy="250" rx="55" ry="57" />
    <path d="M160 140 h80 l-40 56z" class="accent" />
    <path d="M160 140 l40 20 40-20" class="accent" />`,
  necklace: `
    <path d="M96 108 C 96 236, 200 300, 200 300 C 200 300, 304 236, 304 108" />
    <circle cx="200" cy="322" r="26" class="accent" />
    <circle cx="200" cy="322" r="12" />`,
  pendant: `
    <path d="M112 100 C 120 210, 200 262, 200 262 C 200 262, 280 210, 288 100" />
    <path d="M200 268 l30 42 -30 44 -30-44z" class="accent" />`,
  earrings: `
    <circle cx="140" cy="118" r="11" />
    <path d="M140 129 C 140 176, 112 186, 112 220 a28 28 0 0 0 56 0 C 168 186, 140 176, 140 129z" class="accent" />
    <circle cx="260" cy="118" r="11" />
    <path d="M260 129 C 260 176, 232 186, 232 220 a28 28 0 0 0 56 0 C 288 186, 260 176, 260 129z" class="accent" />`,
  studs: `
    <circle cx="146" cy="200" r="46" />
    <circle cx="146" cy="200" r="20" class="accent" />
    <circle cx="254" cy="200" r="46" />
    <circle cx="254" cy="200" r="20" class="accent" />`,
  bracelet: `
    <ellipse cx="200" cy="200" rx="112" ry="70" />
    <ellipse cx="200" cy="200" rx="88" ry="50" />
    <circle cx="88" cy="200" r="13" class="accent" />
    <circle cx="312" cy="200" r="13" class="accent" />`,
  bangle: `
    <circle cx="200" cy="200" r="106" />
    <circle cx="200" cy="200" r="88" />
    <circle cx="200" cy="94" r="14" class="accent" />`,
  chain: `
    <ellipse cx="200" cy="118" rx="22" ry="30" />
    <ellipse cx="200" cy="172" rx="22" ry="30" />
    <ellipse cx="200" cy="226" rx="22" ry="30" />
    <ellipse cx="200" cy="280" rx="22" ry="30" class="accent" />`,
  anklet: `
    <path d="M84 168 C 130 250, 270 250, 316 168" />
    <circle cx="150" cy="228" r="10" class="accent" />
    <circle cx="200" cy="240" r="10" class="accent" />
    <circle cx="250" cy="228" r="10" class="accent" />`,
  brooch: `
    <circle cx="200" cy="196" r="70" />
    <path d="M200 126 l20 70 -20 70 -20-70z" class="accent" />
    <path d="M130 196 l70 -20 70 20 -70 20z" class="accent" />`,
  hero: `
    <circle cx="200" cy="196" r="118" />
    <circle cx="200" cy="196" r="86" class="accent" />
    <path d="M200 78 l34 118 -34 118 -34-118z" />`,
};

const DARK_PALETTES = new Set(["ink", "graphite", "umber", "forest", "aubergine"]);

function svg({ motif, palette, seed = 0, ratio = "square" }) {
  const p = PALETTES[palette] ?? PALETTES.cream;
  const [w, h] = ratio === "wide" ? [1600, 900] : ratio === "tall" ? [900, 1200] : [1000, 1000];
  const rotation = (seed % 5) * 4 - 8;
  const scale = 1 + ((seed % 3) - 1) * 0.06;
  // A bright bloom reads as studio lighting on cream, but muddies dark palettes.
  const glow = DARK_PALETTES.has(palette) ? 0.14 : 0.55;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.bg1}"/>
      <stop offset="100%" stop-color="${p.bg2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="${glow}"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <rect x="24" y="24" width="${w - 48}" height="${h - 48}" fill="none" stroke="${p.accent}" stroke-opacity="0.35" stroke-width="1.5"/>
  <g transform="translate(${w / 2} ${h / 2}) rotate(${rotation}) scale(${(Math.min(w, h) / 400) * 0.62 * scale}) translate(-200 -200)"
     fill="none" stroke="${p.line}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.82">
    <style>.accent{stroke:${p.accent};stroke-opacity:0.95}</style>
    ${motif}
  </g>
</svg>
`;
}

/** 4x4 flat gradient encoded inline — used as next/image blurDataUrl. */
export function blurFor(palette) {
  const p = PALETTES[palette] ?? PALETTES.cream;
  const tiny = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="${p.bg1}"/><circle cx="4" cy="4" r="3" fill="${p.bg2}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(tiny).toString("base64")}`;
}

const FILES = [
  // Product photography — two tones per motif so the hover crossfade has something to do.
  ["ring-a", { motif: MOTIFS.ring, palette: "cream", seed: 1 }],
  ["ring-b", { motif: MOTIFS.ring, palette: "champagne", seed: 3 }],
  ["solitaire-a", { motif: MOTIFS.solitaire, palette: "cream", seed: 2 }],
  ["solitaire-b", { motif: MOTIFS.solitaire, palette: "blush", seed: 4 }],
  ["necklace-a", { motif: MOTIFS.necklace, palette: "cream", seed: 0 }],
  ["necklace-b", { motif: MOTIFS.necklace, palette: "sage", seed: 2 }],
  ["pendant-a", { motif: MOTIFS.pendant, palette: "champagne", seed: 1 }],
  ["pendant-b", { motif: MOTIFS.pendant, palette: "cream", seed: 4 }],
  ["earrings-a", { motif: MOTIFS.earrings, palette: "blush", seed: 3 }],
  ["earrings-b", { motif: MOTIFS.earrings, palette: "cream", seed: 1 }],
  ["studs-a", { motif: MOTIFS.studs, palette: "cream", seed: 2 }],
  ["studs-b", { motif: MOTIFS.studs, palette: "champagne", seed: 0 }],
  ["bracelet-a", { motif: MOTIFS.bracelet, palette: "cream", seed: 4 }],
  ["bracelet-b", { motif: MOTIFS.bracelet, palette: "blush", seed: 2 }],
  ["bangle-a", { motif: MOTIFS.bangle, palette: "champagne", seed: 3 }],
  ["bangle-b", { motif: MOTIFS.bangle, palette: "cream", seed: 1 }],
  ["chain-a", { motif: MOTIFS.chain, palette: "cream", seed: 0 }],
  ["chain-b", { motif: MOTIFS.chain, palette: "sage", seed: 3 }],
  ["anklet-a", { motif: MOTIFS.anklet, palette: "blush", seed: 1 }],
  ["anklet-b", { motif: MOTIFS.anklet, palette: "cream", seed: 4 }],
  ["brooch-a", { motif: MOTIFS.brooch, palette: "champagne", seed: 2 }],
  ["brooch-b", { motif: MOTIFS.brooch, palette: "cream", seed: 0 }],

  // Editorial / hero art.
  ["hero-1", { motif: MOTIFS.hero, palette: "ink", seed: 1, ratio: "wide" }],
  ["hero-2", { motif: MOTIFS.necklace, palette: "champagne", seed: 2, ratio: "wide" }],
  ["hero-3", { motif: MOTIFS.solitaire, palette: "blush", seed: 3, ratio: "wide" }],
  ["editorial-1", { motif: MOTIFS.bangle, palette: "sage", seed: 4, ratio: "tall" }],
  ["editorial-2", { motif: MOTIFS.earrings, palette: "cream", seed: 0, ratio: "tall" }],

  // Collection covers are always dark: cream copy and a corner button sit over
  // them, and a pale cover leaves that text unreadable.
  ["collection-rings", { motif: MOTIFS.ring, palette: "umber", seed: 2, ratio: "tall" }],
  ["collection-necklaces", { motif: MOTIFS.necklace, palette: "ink", seed: 1, ratio: "tall" }],
  ["collection-earrings", { motif: MOTIFS.earrings, palette: "aubergine", seed: 3, ratio: "tall" }],
  ["collection-bracelets", { motif: MOTIFS.bracelet, palette: "forest", seed: 0, ratio: "tall" }],
  ["collection-bridal", { motif: MOTIFS.solitaire, palette: "graphite", seed: 4, ratio: "tall" }],
  ["collection-everyday", { motif: MOTIFS.chain, palette: "umber", seed: 2, ratio: "tall" }],

  // Generic fallback for images that fail to load at runtime.
  ["fallback", { motif: MOTIFS.hero, palette: "cream", seed: 0 }],
];

await mkdir(outDir, { recursive: true });
await Promise.all(
  FILES.map(([name, opts]) => writeFile(join(outDir, `${name}.svg`), svg(opts), "utf8")),
);

console.log(`Wrote ${FILES.length} placeholder images to public/placeholders`);
