// Australian retailers / brands for the gift-card picker.
// `color` is used as the logo tile background; `fg` is the text/initial color.
// `mono` shows a short word-mark inside the tile (e.g. "IKEA", "BP").

export interface Brand {
  name: string;
  mono: string;          // short label rendered inside the tile
  color: string;         // tile bg (solid or gradient)
  fg: string;            // text color on the tile
  emoji: string;         // used on the card list view
  cardGradient: string;  // full-card gradient for the wallet item
  popular?: boolean;
}

export const BRANDS: Brand[] = [
  { name: "Priceline Pharmacy", mono: "priceline", color: "#ffffff", fg: "#e6007e", emoji: "💊",
    cardGradient: "linear-gradient(135deg,#ff4ea1,#c8005f)", popular: true },
  { name: "Dan Murphy's", mono: "Dan\nMurphy's", color: "#0e3b1f", fg: "#f5f1d6", emoji: "🍷",
    cardGradient: "linear-gradient(135deg,#0e3b1f,#06210f)", popular: true },
  { name: "Supercheap Auto", mono: "SUPER\nCHEAP", color: "#d11b1b", fg: "#fff200", emoji: "🚗",
    cardGradient: "linear-gradient(135deg,#d11b1b,#7a0d0d)", popular: true },
  { name: "BP", mono: "BP", color: "#ffffff", fg: "#009a44", emoji: "⛽",
    cardGradient: "linear-gradient(135deg,#009a44,#ffe900)", popular: true },
  { name: "RACV", mono: "RACV", color: "#0091da", fg: "#ffffff", emoji: "🛣️",
    cardGradient: "linear-gradient(135deg,#0091da,#005f8f)", popular: true },
  { name: "RAC", mono: "RAC", color: "#ffd400", fg: "#003a70", emoji: "🛞",
    cardGradient: "linear-gradient(135deg,#ffd400,#b89a00)", popular: true },
  { name: "IKEA Family", mono: "IKEA", color: "#0058a3", fg: "#ffcc00", emoji: "🛋️",
    cardGradient: "linear-gradient(135deg,#0058a3,#003e75)", popular: true },
  { name: "RACQ", mono: "RACQ", color: "#ffd400", fg: "#002a5c", emoji: "🚙",
    cardGradient: "linear-gradient(135deg,#ffd400,#b89a00)", popular: true },
  { name: "BCF", mono: "BCF", color: "#ffffff", fg: "#0066b3", emoji: "🎣",
    cardGradient: "linear-gradient(135deg,#0066b3,#003f70)", popular: true },
  { name: "Coles", mono: "Coles", color: "#e01a22", fg: "#ffffff", emoji: "🛒",
    cardGradient: "linear-gradient(135deg,#e01a22,#9a0e14)" },
  { name: "Woolworths", mono: "WOOL\nWORTHS", color: "#178b3c", fg: "#ffffff", emoji: "🥦",
    cardGradient: "linear-gradient(135deg,#178b3c,#0a5a25)" },
  { name: "Bunnings", mono: "Bunnings", color: "#0d5c3e", fg: "#ffffff", emoji: "🔨",
    cardGradient: "linear-gradient(135deg,#0d5c3e,#073624)" },
  { name: "Kmart", mono: "Kmart", color: "#e3000e", fg: "#ffffff", emoji: "🏷️",
    cardGradient: "linear-gradient(135deg,#e3000e,#8a0008)" },
  { name: "Target Australia", mono: "TARGET", color: "#cc0000", fg: "#ffffff", emoji: "🎯",
    cardGradient: "linear-gradient(135deg,#cc0000,#7a0000)" },
  { name: "Big W", mono: "BIG W", color: "#0066ff", fg: "#ffffff", emoji: "🅱️",
    cardGradient: "linear-gradient(135deg,#0066ff,#003f99)" },
  { name: "JB Hi-Fi", mono: "JB Hi-Fi", color: "#ffe000", fg: "#000000", emoji: "🎧",
    cardGradient: "linear-gradient(135deg,#ffe000,#b89c00)" },
  { name: "Harvey Norman", mono: "Harvey\nNorman", color: "#ffd500", fg: "#000000", emoji: "🛏️",
    cardGradient: "linear-gradient(135deg,#ffd500,#b89a00)" },
  { name: "Officeworks", mono: "Office\nworks", color: "#0067a5", fg: "#ffffff", emoji: "🖇️",
    cardGradient: "linear-gradient(135deg,#0067a5,#003f6b)" },
  { name: "Chemist Warehouse", mono: "Chemist\nWarehouse", color: "#ffd500", fg: "#cc0000", emoji: "💊",
    cardGradient: "linear-gradient(135deg,#ffd500,#cc0000)" },
  { name: "Mecca", mono: "MECCA", color: "#000000", fg: "#ffffff", emoji: "✨",
    cardGradient: "linear-gradient(135deg,#000000,#3a1f1f)" },
  { name: "Sephora", mono: "SEPHORA", color: "#000000", fg: "#ffffff", emoji: "💄",
    cardGradient: "linear-gradient(135deg,#1a1a1a,#3a1f1f)" },
  { name: "Country Road", mono: "COUNTRY\nROAD", color: "#1a1a1a", fg: "#ffffff", emoji: "👖",
    cardGradient: "linear-gradient(135deg,#1a1a1a,#000000)" },
  { name: "Cotton On", mono: "COTTON:ON", color: "#000000", fg: "#ffffff", emoji: "👕",
    cardGradient: "linear-gradient(135deg,#000000,#333333)" },
  { name: "Uniqlo", mono: "UNIQLO", color: "#bf0000", fg: "#ffffff", emoji: "👕",
    cardGradient: "linear-gradient(135deg,#bf0000,#7a0000)" },
  { name: "Myer", mono: "MYER", color: "#000000", fg: "#ffffff", emoji: "🛍️",
    cardGradient: "linear-gradient(135deg,#000000,#222222)" },
  { name: "David Jones", mono: "DAVID\nJONES", color: "#000000", fg: "#ffffff", emoji: "👜",
    cardGradient: "linear-gradient(135deg,#000000,#1a1a1a)" },
  { name: "Apple", mono: "", color: "#1a1a1a", fg: "#ffffff", emoji: "🍎",
    cardGradient: "linear-gradient(135deg,#2c2c2e,#000)" },
  { name: "Starbucks", mono: "STAR\nBUCKS", color: "#006241", fg: "#ffffff", emoji: "☕",
    cardGradient: "linear-gradient(135deg,#006241,#003f29)" },
  { name: "Uber", mono: "Uber", color: "#000000", fg: "#ffffff", emoji: "🚕",
    cardGradient: "linear-gradient(135deg,#000000,#222)" },
  { name: "Netflix", mono: "NETFLIX", color: "#000000", fg: "#e50914", emoji: "🎬",
    cardGradient: "linear-gradient(135deg,#000000,#3a0006)" },
];

export interface Catalogue {
  brand: string;
  title: string;
  endsLabel: string;
  badge?: "New" | "Sponsored";
  gradient: string;
  emoji: string;
}

export const CATALOGUES: Catalogue[] = [
  { brand: "TerryWhite Chemmart", title: "CareClinic — extra care for your vaccination needs",
    endsLabel: "Ends 17 Jun", badge: "New", emoji: "💊",
    gradient: "linear-gradient(135deg,#16a34a,#0f7a37)" },
  { brand: "Aldi", title: "Special buys — Game on. 65\" 4K TV $549",
    endsLabel: "Ends 10 Jun", badge: "New", emoji: "📺",
    gradient: "linear-gradient(135deg,#00549a,#ff7a00)" },
  { brand: "Bunnings Warehouse", title: "Everyday comforts — warm your home from the ground up",
    endsLabel: "Ends 01 Jul", badge: "New", emoji: "🛋️",
    gradient: "linear-gradient(135deg,#0d5c3e,#073624)" },
  { brand: "Chemist Warehouse", title: "Winter Blowout — up to 1/2 price off",
    endsLabel: "Ends 10 Jun", badge: "Sponsored", emoji: "❄️",
    gradient: "linear-gradient(135deg,#ffd500,#cc0000)" },
  { brand: "Coles", title: "Weekly half-price specials — fresh & pantry",
    endsLabel: "Ends 13 Jun", emoji: "🛒",
    gradient: "linear-gradient(135deg,#e01a22,#9a0e14)" },
  { brand: "BCF", title: "Boating, camping, fishing — winter sale",
    endsLabel: "Ends 22 Jun", badge: "Sponsored", emoji: "🎣",
    gradient: "linear-gradient(135deg,#0066b3,#003f70)" },
];
