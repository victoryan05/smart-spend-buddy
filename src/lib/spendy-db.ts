import { supabase } from "@/integrations/supabase/client";

const DEVICE_KEY = "spendy.device-id.v1";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// Stable, shareable forwarding address derived from the device id.
// Real implementation would route through Mailgun Routes → webhook → DB lookup.
export function getForwardingAddress(domain = "in.spendy.app"): string {
  const id = getDeviceId().replace(/-/g, "").slice(0, 10);
  return `u_${id}@${domain}`;
}

function __unused_keep_format() {
  const id = "";
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export interface DbReceiptItem {
  id: string;
  transaction_id: string;
  name: string;
  qty: number | null;
  price: number | null;
}

export interface DbTransaction {
  id: string;
  device_id: string;
  card_id: string;
  brand: string;
  amount: number;
  currency: string;
  note: string | null;
  location: string | null;
  receipt_path: string | null;
  merchant: string | null;
  purchased_at: string | null;
  created_at: string;
  items?: DbReceiptItem[];
}

export interface ParsedReceipt {
  merchant: string | null;
  purchased_at: string | null;
  total: number | null;
  items: Array<{ name: string; qty: number | null; price: number | null }>;
}

export async function fetchTransactions(): Promise<DbTransaction[]> {
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, items:receipt_items(*)")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchTransactions", error);
    return [];
  }
  return (data ?? []) as unknown as DbTransaction[];
}

export async function uploadReceipt(file: Blob, ext = "jpg"): Promise<string | null> {
  const deviceId = getDeviceId();
  const path = `${deviceId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) {
    console.error("uploadReceipt", error);
    return null;
  }
  return path;
}

export async function getReceiptSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 60 * 60);
  if (error) {
    console.error("getReceiptSignedUrl", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

export async function parseReceipt(imageBase64: string): Promise<ParsedReceipt | null> {
  try {
    const res = await fetch("/api/public/parse-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });
    if (!res.ok) {
      console.error("parseReceipt failed", res.status, await res.text());
      return null;
    }
    return (await res.json()) as ParsedReceipt;
  } catch (e) {
    console.error("parseReceipt error", e);
    return null;
  }
}

export async function insertTransaction(input: {
  cardId: string;
  brand: string;
  amount: number;
  currency: string;
  note?: string | null;
  location?: string | null;
  receipt_path?: string | null;
  merchant?: string | null;
  purchased_at?: string | null;
  items?: Array<{ name: string; qty: number | null; price: number | null }>;
}): Promise<DbTransaction | null> {
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      device_id: deviceId,
      card_id: input.cardId,
      brand: input.brand,
      amount: input.amount,
      currency: input.currency,
      note: input.note ?? null,
      location: input.location ?? null,
      receipt_path: input.receipt_path ?? null,
      merchant: input.merchant ?? null,
      purchased_at: input.purchased_at ?? null,
    })
    .select()
    .single();
  if (error || !data) {
    console.error("insertTransaction", error);
    return null;
  }
  const tx = data as unknown as DbTransaction;
  if (input.items && input.items.length) {
    const rows = input.items.map((it) => ({
      transaction_id: tx.id,
      name: it.name,
      qty: it.qty,
      price: it.price,
    }));
    const { data: items, error: itemErr } = await supabase
      .from("receipt_items")
      .insert(rows)
      .select();
    if (itemErr) console.error("insertItems", itemErr);
    tx.items = (items ?? []) as DbReceiptItem[];
  } else {
    tx.items = [];
  }
  return tx;
}

export async function deleteTransaction(id: string, receiptPath?: string | null) {
  if (receiptPath) {
    await supabase.storage.from("receipts").remove([receiptPath]);
  }
  await supabase.from("transactions").delete().eq("id", id);
}

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
