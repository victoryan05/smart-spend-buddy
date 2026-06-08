export interface Transaction {
  id: string;
  cardId: string;
  brand: string;
  amount: number;
  currency: string;
  note?: string;
  createdAt: string; // ISO
  receiptDataUrl?: string; // base64 image — acts as our "database" for returns/refunds
  location?: string;
}

const KEY = "spendy.transactions.v1";

export function loadTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Transaction[]) : [];
  } catch {
    return [];
  }
}

export function saveTransactions(txs: Transaction[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(txs));
  } catch {
    // localStorage quota — drop oldest receipt blobs and retry
    const trimmed = txs.map((t, i) => (i < txs.length - 20 ? { ...t, receiptDataUrl: undefined } : t));
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  }
}

export function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 7 * day) return d.toLocaleDateString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
