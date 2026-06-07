import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SpendyLogo } from "@/components/SpendyLogo";
import {
  loadCards, saveCards, daysUntil, formatMoney,
  type SpendyCard, type CardKind,
} from "@/lib/spendy-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spendy — Use what you already have" },
      { name: "description", content: "MVP prototype: every gift card, store credit and code in one place. Live balances, expiry nudges, two-tap checkout." },
      { property: "og:title", content: "Spendy" },
      { property: "og:description", content: "The easiest way to use what you already have." },
    ],
  }),
  component: Index,
});

type Screen =
  | { name: "home" }
  | { name: "detail"; id: string }
  | { name: "add" }
  | { name: "expiring" };

function Index() {
  const [cards, setCards] = useState<SpendyCard[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  useEffect(() => { setCards(loadCards()); }, []);
  useEffect(() => { if (cards.length) saveCards(cards); }, [cards]);

  const update = (next: SpendyCard[] | ((p: SpendyCard[]) => SpendyCard[])) =>
    setCards(typeof next === "function" ? (next as any) : next);

  return (
    <main className="min-h-screen w-full flex flex-col items-center px-4 py-6 md:py-10">
      {/* Top tagline only on desktop */}
      <header className="hidden md:flex w-full max-w-5xl items-center justify-between mb-8">
        <SpendyLogo />
        <p className="text-sm text-muted-foreground">
          MVP prototype — the easiest way to use what you already have.
        </p>
      </header>

      <Phone>
        {screen.name === "home" && (
          <Home
            cards={cards}
            onOpen={(id) => setScreen({ name: "detail", id })}
            onAdd={() => setScreen({ name: "add" })}
            onExpiring={() => setScreen({ name: "expiring" })}
            nudgeDismissed={nudgeDismissed}
            onDismissNudge={() => setNudgeDismissed(true)}
          />
        )}
        {screen.name === "detail" && (() => {
          const card = cards.find((c) => c.id === screen.id);
          if (!card) { setScreen({ name: "home" }); return null; }
          return (
            <Detail
              card={card}
              onBack={() => setScreen({ name: "home" })}
              onSpend={(amount) =>
                update((cs) => cs.map((c) =>
                  c.id === card.id
                    ? { ...c, balance: Math.max(0, +(c.balance - amount).toFixed(2)) }
                    : c
                ))
              }
              onDelete={() => {
                update((cs) => cs.filter((c) => c.id !== card.id));
                setScreen({ name: "home" });
              }}
            />
          );
        })()}
        {screen.name === "add" && (
          <AddCard
            onCancel={() => setScreen({ name: "home" })}
            onSave={(c) => { update((cs) => [c, ...cs]); setScreen({ name: "home" }); }}
          />
        )}
        {screen.name === "expiring" && (
          <Expiring
            cards={cards}
            onBack={() => setScreen({ name: "home" })}
            onOpen={(id) => setScreen({ name: "detail", id })}
          />
        )}
      </Phone>

      <footer className="mt-8 text-xs text-muted-foreground text-center max-w-sm">
        Tap a card to see the code & spend. Your data is stored on this device only.
      </footer>
    </main>
  );
}

/* ---------- Phone frame ---------- */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full max-w-[400px] aspect-[9/19.5] md:aspect-auto md:h-[820px]">
      <div className="absolute inset-0 rounded-[3rem] bg-black/90 p-[6px] shadow-card">
        <div className="relative h-full w-full rounded-[2.7rem] overflow-hidden bg-background">
          {/* notch */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-6 w-28 rounded-full bg-black z-30" />
          <div className="h-full w-full overflow-y-auto overflow-x-hidden pt-10 pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Home ---------- */
function Home({
  cards, onOpen, onAdd, onExpiring, nudgeDismissed, onDismissNudge,
}: {
  cards: SpendyCard[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  onExpiring: () => void;
  nudgeDismissed: boolean;
  onDismissNudge: () => void;
}) {
  const total = cards.reduce((s, c) => s + c.balance, 0);
  const expiringSoon = cards.filter((c) => daysUntil(c.expiresAt) <= 30 && c.balance > 0);
  const nudgeCard = cards.find((c) => c.brand === "Sephora" && c.balance > 0);

  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <SpendyLogo size={24} />
        <button
          onClick={onAdd}
          className="h-10 w-10 grid place-items-center rounded-full gradient-peach text-white shadow-soft active:scale-95 transition"
          aria-label="Add card"
        >
          <Plus />
        </button>
      </div>

      {/* Balance hero */}
      <section className="mt-6 rounded-3xl gradient-peach text-white p-6 shadow-soft relative overflow-hidden">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/15 blur-xl" />
        <p className="text-sm/none opacity-90">Hi, Mia — you have</p>
        <p className="font-display text-[3.2rem] leading-none mt-2">
          {formatMoney(total)}
        </p>
        <p className="text-sm opacity-90 mt-2">
          across {cards.length} card{cards.length === 1 ? "" : "s"} & codes
        </p>
      </section>

      {/* Nudge */}
      {!nudgeDismissed && nudgeCard && (
        <button
          onClick={() => onOpen(nudgeCard.id)}
          className="mt-4 w-full text-left rounded-2xl bg-card border border-border p-4 flex gap-3 items-start shadow-soft active:scale-[.99] transition"
        >
          <div className="h-9 w-9 rounded-full bg-accent/60 grid place-items-center text-lg shrink-0">📍</div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold">You're near Sephora</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
              {formatMoney(nudgeCard.balance)} in unused credit — open until 9pm.
            </p>
          </div>
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onDismissNudge(); }}
            className="text-muted-foreground text-xs px-1 py-0.5"
          >✕</span>
        </button>
      )}

      {/* Expiring strip */}
      {expiringSoon.length > 0 && (
        <button
          onClick={onExpiring}
          className="mt-4 w-full flex items-center justify-between rounded-2xl bg-secondary/70 px-4 py-3 active:scale-[.99] transition"
        >
          <span className="text-sm">
            <span className="font-semibold">{expiringSoon.length} expiring</span>{" "}
            <span className="text-muted-foreground">in the next 30 days</span>
          </span>
          <span className="text-coral text-sm">→</span>
        </button>
      )}

      {/* Cards */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-2xl">Your cards</h2>
          <span className="text-xs text-muted-foreground">{cards.length} total</span>
        </div>

        {cards.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          <ul className="space-y-3">
            {cards.map((c) => (
              <li key={c.id}>
                <CardRow card={c} onClick={() => onOpen(c.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CardRow({ card, onClick }: { card: SpendyCard; onClick: () => void }) {
  const days = daysUntil(card.expiresAt);
  const empty = card.balance <= 0;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border shadow-soft active:scale-[.99] transition text-left"
    >
      <div
        className="h-12 w-16 rounded-xl shrink-0 grid place-items-center text-xl shadow-inner"
        style={{ background: card.color }}
      >
        <span>{card.emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold truncate">{card.brand}</p>
          <p className={`font-display text-lg ${empty ? "text-muted-foreground line-through" : ""}`}>
            {formatMoney(card.balance, card.currency)}
          </p>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
          <span className="capitalize">{card.kind === "code" ? "Promo code" : card.kind === "credit" ? "Store credit" : "Gift card"}</span>
          <ExpiryPill days={days} />
        </div>
      </div>
    </button>
  );
}

function ExpiryPill({ days }: { days: number }) {
  if (days <= 0) return <span className="text-destructive">Expired</span>;
  if (days <= 14) return <span className="text-coral">Expires in {days}d</span>;
  if (days <= 60) return <span>Expires in {days}d</span>;
  return <span>Valid {days}d</span>;
}

/* ---------- Detail ---------- */
function Detail({
  card, onBack, onSpend, onDelete,
}: {
  card: SpendyCard;
  onBack: () => void;
  onSpend: (n: number) => void;
  onDelete: () => void;
}) {
  const days = daysUntil(card.expiresAt);
  const [amount, setAmount] = useState("");
  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground active:opacity-70">← Back</button>
        <button onClick={onDelete} className="text-xs text-muted-foreground active:opacity-70">Delete</button>
      </div>

      <div
        className="mt-4 rounded-3xl p-6 text-white shadow-card relative overflow-hidden aspect-[1.6/1] flex flex-col justify-between"
        style={{ background: card.color }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs opacity-80 uppercase tracking-wider">{card.kind === "code" ? "Promo code" : card.kind === "credit" ? "Store credit" : "Gift card"}</p>
            <p className="font-display text-3xl mt-1">{card.brand}</p>
          </div>
          <span className="text-2xl">{card.emoji}</span>
        </div>
        <div>
          <p className="text-xs opacity-80">Balance</p>
          <p className="font-display text-4xl leading-none">{formatMoney(card.balance, card.currency)}</p>
          <p className="text-[11px] opacity-80 mt-2">
            of {formatMoney(card.starting, card.currency)} starting • {days > 0 ? `expires in ${days}d` : "expired"}
          </p>
        </div>
      </div>

      {/* Barcode-ish */}
      <div className="mt-5 rounded-2xl bg-card border border-border p-4 shadow-soft">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Show at checkout</p>
        <FauxBarcode value={card.code} />
        <p className="text-center font-mono text-sm mt-2 select-all">{card.code}</p>
        <button
          onClick={() => navigator.clipboard?.writeText(card.code)}
          className="mt-3 w-full h-10 rounded-xl bg-secondary text-sm font-medium active:scale-[.99]"
        >
          Copy code
        </button>
      </div>

      {/* Spend */}
      <div className="mt-5 rounded-2xl bg-card border border-border p-4 shadow-soft">
        <p className="text-sm font-semibold mb-2">Log a purchase</p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center rounded-xl bg-secondary px-3">
            <span className="text-muted-foreground mr-1">{card.currency}</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="bg-transparent h-11 w-full outline-none text-base"
            />
          </div>
          <button
            disabled={!amount || +amount <= 0}
            onClick={() => { onSpend(+amount); setAmount(""); }}
            className="h-11 px-5 rounded-xl gradient-peach text-white text-sm font-semibold disabled:opacity-40 active:scale-[.99]"
          >
            Spend
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {[5, 10, 25].map((q) => (
            <button
              key={q}
              onClick={() => setAmount(String(q))}
              className="flex-1 h-9 rounded-lg bg-secondary text-xs"
            >${q}</button>
          ))}
        </div>
        {card.note && <p className="text-[11px] text-muted-foreground mt-3">{card.note}</p>}
      </div>
    </div>
  );
}

function FauxBarcode({ value }: { value: string }) {
  // Generate deterministic-ish bar widths from value
  const bars = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < value.length * 2 + 12; i++) {
      const code = value.charCodeAt(i % value.length) || 7;
      arr.push(((code * 31 + i * 17) % 5) + 1);
    }
    return arr;
  }, [value]);
  return (
    <div className="mt-3 flex items-end gap-[2px] h-16">
      {bars.map((w, i) => (
        <span
          key={i}
          className="bg-ink"
          style={{ width: w, height: i % 7 === 0 ? "100%" : "92%" }}
        />
      ))}
    </div>
  );
}

/* ---------- Add card ---------- */
function AddCard({
  onCancel, onSave,
}: { onCancel: () => void; onSave: (c: SpendyCard) => void }) {
  const [brand, setBrand] = useState("");
  const [balance, setBalance] = useState("");
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<CardKind>("gift");
  const [days, setDays] = useState("90");

  const palette = [
    "linear-gradient(135deg,#ff8a5c,#e85a32)",
    "linear-gradient(135deg,#2c2c2e,#000)",
    "linear-gradient(135deg,#0b6b3a,#06502b)",
    "linear-gradient(135deg,#bf0000,#7a0000)",
    "linear-gradient(135deg,#0058A3,#003e75)",
    "linear-gradient(135deg,#d4a3b2,#a36a7d)",
  ];
  const [color, setColor] = useState(palette[0]);
  const emojis = ["🎁", "💄", "☕", "🛒", "👗", "👕", "🍎", "🛋️", "✨", "🎟️"];
  const [emoji, setEmoji] = useState("🎁");

  const valid = brand.trim() && +balance > 0;

  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="text-sm text-muted-foreground">← Cancel</button>
        <p className="font-display text-xl">Add card</p>
        <span className="w-10" />
      </div>

      {/* Capture options — visual only */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          { icon: "📷", label: "Snap" },
          { icon: "🔢", label: "Scan code" },
          { icon: "✉️", label: "Forward" },
        ].map((opt) => (
          <button
            key={opt.label}
            className="rounded-2xl bg-card border border-border p-3 text-center shadow-soft active:scale-95 transition"
          >
            <div className="text-xl">{opt.icon}</div>
            <div className="text-[11px] mt-1 text-muted-foreground">{opt.label}</div>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        Or enter the details manually below
      </p>

      <div className="mt-5 space-y-3">
        <Field label="Brand">
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Sephora"
            className="bg-transparent h-11 w-full outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Balance">
            <div className="flex items-center w-full">
              <span className="text-muted-foreground mr-1">$</span>
              <input
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="bg-transparent h-11 w-full outline-none"
              />
            </div>
          </Field>
          <Field label="Expires in">
            <div className="flex items-center w-full">
              <input
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))}
                className="bg-transparent h-11 w-full outline-none"
              />
              <span className="text-muted-foreground ml-1 text-sm">days</span>
            </div>
          </Field>
        </div>

        <Field label="Code / number">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABC-1234-5678"
            className="bg-transparent h-11 w-full outline-none font-mono text-sm"
          />
        </Field>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Type</p>
          <div className="grid grid-cols-3 gap-2">
            {(["gift", "credit", "code"] as CardKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`h-10 rounded-xl text-sm capitalize border transition ${
                  kind === k
                    ? "gradient-peach text-white border-transparent"
                    : "bg-card border-border text-foreground"
                }`}
              >
                {k === "credit" ? "Credit" : k === "code" ? "Code" : "Gift"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Look</p>
          <div className="flex gap-2 flex-wrap">
            {palette.map((p) => (
              <button
                key={p}
                onClick={() => setColor(p)}
                className={`h-9 w-9 rounded-xl border-2 transition ${color === p ? "border-coral" : "border-transparent"}`}
                style={{ background: p }}
                aria-label="color"
              />
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap mt-3">
            {emojis.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`h-9 w-9 rounded-xl text-lg transition ${emoji === e ? "bg-accent" : "bg-secondary"}`}
              >{e}</button>
            ))}
          </div>
        </div>
      </div>

      <button
        disabled={!valid}
        onClick={() =>
          onSave({
            id: crypto.randomUUID(),
            brand: brand.trim(),
            emoji,
            kind,
            balance: +balance,
            starting: +balance,
            currency: "$",
            code: code || "—",
            expiresAt: new Date(Date.now() + (+days || 90) * 86400000).toISOString(),
            color,
          })
        }
        className="mt-6 w-full h-12 rounded-2xl gradient-peach text-white font-semibold shadow-soft disabled:opacity-40 active:scale-[.99]"
      >
        Save card
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center rounded-xl bg-secondary px-3">{children}</div>
    </label>
  );
}

/* ---------- Expiring ---------- */
function Expiring({
  cards, onBack, onOpen,
}: { cards: SpendyCard[]; onBack: () => void; onOpen: (id: string) => void }) {
  const items = [...cards]
    .filter((c) => c.balance > 0)
    .sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt));
  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground">← Back</button>
        <p className="font-display text-xl">Expiring</p>
        <span className="w-10" />
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        Use these before they vanish.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((c) => (
          <li key={c.id}>
            <CardRow card={c} onClick={() => onOpen(c.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Misc ---------- */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="font-display text-xl">Nothing here yet</p>
      <p className="text-sm text-muted-foreground mt-1">
        Add your first gift card or code — takes under a minute.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 h-10 px-5 rounded-xl gradient-peach text-white text-sm font-semibold shadow-soft"
      >
        Add a card
      </button>
    </div>
  );
}

function Plus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}
