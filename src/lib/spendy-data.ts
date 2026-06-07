export type CardKind = "gift" | "credit" | "code";

export interface SpendyCard {
  id: string;
  brand: string;
  emoji: string;
  kind: CardKind;
  balance: number;
  starting: number;
  currency: string;
  code: string;
  expiresAt: string; // ISO
  color: string; // gradient css
  note?: string;
}

const today = new Date();
const addDays = (d: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() + d);
  return x.toISOString();
};

export const SEED_CARDS: SpendyCard[] = [
  {
    id: "c1", brand: "Sephora", emoji: "💄", kind: "gift",
    balance: 48, starting: 75, currency: "$",
    code: "SEPH-4821-9930-1142", expiresAt: addDays(14),
    color: "linear-gradient(135deg,#1a1a1a 0%,#3a1f1f 100%)",
  },
  {
    id: "c2", brand: "Starbucks", emoji: "☕", kind: "gift",
    balance: 12.40, starting: 25, currency: "$",
    code: "SBX-7712-0098", expiresAt: addDays(60),
    color: "linear-gradient(135deg,#0b6b3a 0%,#06502b 100%)",
  },
  {
    id: "c3", brand: "IKEA", emoji: "🛋️", kind: "credit",
    balance: 200, starting: 200, currency: "$",
    code: "IKEA-REFUND-552210", expiresAt: addDays(220),
    color: "linear-gradient(135deg,#0058A3 0%,#003e75 100%)",
  },
  {
    id: "c4", brand: "Uniqlo", emoji: "👕", kind: "gift",
    balance: 25, starting: 50, currency: "$",
    code: "UNI-1100-2255-9087", expiresAt: addDays(30),
    color: "linear-gradient(135deg,#bf0000 0%,#7a0000 100%)",
  },
  {
    id: "c5", brand: "Apple", emoji: "🍎", kind: "gift",
    balance: 110, starting: 110, currency: "$",
    code: "APL-XX99-AA12-BB34", expiresAt: addDays(400),
    color: "linear-gradient(135deg,#2c2c2e 0%,#000 100%)",
  },
  {
    id: "c6", brand: "Mecca", emoji: "✨", kind: "credit",
    balance: 32, starting: 50, currency: "$",
    code: "MECCA-RETURN-8821", expiresAt: addDays(45),
    color: "linear-gradient(135deg,#d4a3b2 0%,#a36a7d 100%)",
  },
  {
    id: "c7", brand: "ASOS", emoji: "👗", kind: "code",
    balance: 20, starting: 20, currency: "$",
    code: "WELCOME20", expiresAt: addDays(7),
    color: "linear-gradient(135deg,#111 0%,#333 100%)",
    note: "Discount code — min spend $80",
  },
  {
    id: "c8", brand: "Coles", emoji: "🛒", kind: "gift",
    balance: 40, starting: 50, currency: "$",
    code: "COLES-0099-2231", expiresAt: addDays(120),
    color: "linear-gradient(135deg,#e01a22 0%,#9a0e14 100%)",
  },
];

const KEY = "spendy.cards.v1";

export function loadCards(): SpendyCard[] {
  if (typeof window === "undefined") return SEED_CARDS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED_CARDS;
    return JSON.parse(raw) as SpendyCard[];
  } catch {
    return SEED_CARDS;
  }
}

export function saveCards(cards: SpendyCard[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cards));
}

export function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function formatMoney(n: number, currency = "$") {
  return `${currency}${n.toFixed(2).replace(/\.00$/, "")}`;
}
