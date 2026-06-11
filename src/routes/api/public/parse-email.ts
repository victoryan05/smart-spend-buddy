import { createFileRoute } from "@tanstack/react-router";

// POST { text?: string, html?: string, subject?: string, from?: string }
// Returns:
// {
//   kind: "receipt" | "giftcard" | "unknown",
//   receipt?: { merchant, purchased_at, total, items: [{name, qty, price}] },
//   giftcard?: { brand, balance, currency, code, pin, expires_at, kind: "gift"|"credit"|"code" }
// }
export const Route = createFileRoute("/api/public/parse-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "AI not configured" }, { status: 500 });

        let body: { text?: string; html?: string; subject?: string; from?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const raw = (body.text || body.html || "").trim();
        if (!raw || raw.length < 10 || raw.length > 200_000) {
          return Response.json({ error: "Missing or invalid email body" }, { status: 400 });
        }

        // Strip HTML to text-ish so the model focuses on content (cheap, OK if already text)
        const text = raw
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/\s+/g, " ")
          .slice(0, 40_000);

        const prompt = `You are an inbox parser for a gift-card wallet app. You receive ONE forwarded email. Decide if it is:
  - "giftcard": an e-gift card / store credit / promo code (Coles eGift, JB Hi-Fi eGift, Mecca credit, ASOS discount code, etc.)
  - "receipt": a purchase receipt / order confirmation with totals and line items
  - "unknown": anything else

Return ONLY valid JSON with this exact shape:
{
  "kind": "giftcard" | "receipt" | "unknown",
  "giftcard": null | {
    "brand": string,
    "balance": number,
    "currency": string,         // "$", "AUD", etc — pick "$" if unsure
    "code": string,             // card number / pin / activation code; combine if both present
    "pin": string | null,
    "expires_at": string | null,// ISO-8601 date if printed
    "kind": "gift" | "credit" | "code"
  },
  "receipt": null | {
    "merchant": string | null,
    "purchased_at": string | null,
    "total": number | null,
    "items": [{ "name": string, "qty": number | null, "price": number | null }]
  }
}

Rules:
- Use the printed date/time for purchased_at (ISO-8601 if possible).
- Numbers only for prices/balance (no currency symbols).
- Skip subtotals, GST/tax, shipping, totals from "items".
- If unsure of a field, use null.
- Only populate giftcard OR receipt — the other must be null.
- Return JSON only — no markdown, no commentary.

Email metadata:
Subject: ${body.subject ?? ""}
From: ${body.from ?? ""}

Email body:
${text}`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (!aiRes.ok) {
          const detail = await aiRes.text();
          return Response.json(
            { error: "AI request failed", detail: detail.slice(0, 500) },
            { status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502 },
          );
        }
        const aiJson = (await aiRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const content = aiJson.choices?.[0]?.message?.content ?? "{}";
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          const m = content.match(/\{[\s\S]*\}/);
          parsed = m ? JSON.parse(m[0]) : {};
        }
        return Response.json(parsed);
      },
    },
  },
});
