import { createFileRoute } from "@tanstack/react-router";

// POST { imageBase64: "data:image/...;base64,...." }
// Returns: { merchant, purchased_at (ISO|null), total (number|null), items: [{name, qty, price}] }
export const Route = createFileRoute("/api/public/parse-receipt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "AI not configured" }, { status: 500 });
        }
        let body: { imageBase64?: string };
        try {
          body = (await request.json()) as { imageBase64?: string };
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const img = body.imageBase64;
        if (!img || typeof img !== "string" || img.length < 64 || img.length > 12_000_000) {
          return Response.json({ error: "Missing or invalid image" }, { status: 400 });
        }
        const dataUrl = img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;

        const prompt = `You are a receipt OCR assistant. Read this receipt image and return ONLY valid JSON with this exact shape:
{
  "merchant": string | null,
  "purchased_at": ISO-8601 string | null,
  "total": number | null,
  "items": [{ "name": string, "qty": number | null, "price": number | null }]
}
Rules:
- Use the printed date/time on the receipt for purchased_at (include the time if present).
- Prices in the same currency printed on the receipt; numbers only (no symbols).
- Skip subtotals, GST/tax, totals, change, eftpos fees from items.
- If unsure of a field, use null.
Return JSON only — no markdown, no commentary.`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });

        if (!aiRes.ok) {
          const text = await aiRes.text();
          return Response.json(
            { error: "AI request failed", detail: text.slice(0, 500) },
            { status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 502 },
          );
        }
        const aiJson = (await aiRes.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = aiJson.choices?.[0]?.message?.content ?? "{}";
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch {
          // Best-effort: pull first {...} block out of the response.
          const m = content.match(/\{[\s\S]*\}/);
          parsed = m ? JSON.parse(m[0]) : {};
        }
        return Response.json(parsed);
      },
    },
  },
});
