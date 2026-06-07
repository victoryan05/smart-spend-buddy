import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { SpendyLogo } from "@/components/SpendyLogo";
import { BrandLogo } from "@/components/BrandLogo";
import { BRANDS, CATALOGUES, type Brand } from "@/lib/spendy-brands";
import {
  loadCards, saveCards, daysUntil, formatMoney,
  type SpendyCard, type CardKind,
} from "@/lib/spendy-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spendy — Use what you already have" },
      { name: "description", content: "MVP prototype: every gift card, store credit and code in one place. Live balances, expiry nudges, two-tap checkout." },
    ],
  }),
  component: Index,
});

type Tab = "home" | "catalogues" | "wallet" | "more";

type Screen =
  | { name: "tab"; tab: Tab }
  | { name: "detail"; id: string }
  | { name: "pick" }                       // choose-brand list
  | { name: "scan"; brand: Brand }         // camera viewfinder
  | { name: "add"; brand?: Brand; code?: string }
  | { name: "expiring" };

function Index() {
  const [cards, setCards] = useState<SpendyCard[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "tab", tab: "home" });
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  useEffect(() => { setCards(loadCards()); }, []);
  useEffect(() => { if (cards.length) saveCards(cards); }, [cards]);

  const update = (next: SpendyCard[] | ((p: SpendyCard[]) => SpendyCard[])) =>
    setCards(typeof next === "function" ? (next as any) : next);

  const currentTab: Tab | null = screen.name === "tab" ? screen.tab : null;

  const goTab = (tab: Tab) => setScreen({ name: "tab", tab });
  const openAdd = () => setScreen({ name: "pick" });

  return (
    <main className="min-h-screen w-full flex flex-col items-center px-4 py-6 md:py-10">
      <header className="hidden md:flex w-full max-w-5xl items-center justify-between mb-8">
        <SpendyLogo />
        <p className="text-sm text-muted-foreground">
          MVP prototype — the easiest way to use what you already have.
        </p>
      </header>

      <Phone>
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
            {screen.name === "tab" && screen.tab === "home" && (
              <Home
                cards={cards}
                onOpen={(id) => setScreen({ name: "detail", id })}
                onAdd={openAdd}
                onExpiring={() => setScreen({ name: "expiring" })}
                onCatalogues={() => goTab("catalogues")}
                nudgeDismissed={nudgeDismissed}
                onDismissNudge={() => setNudgeDismissed(true)}
              />
            )}
            {screen.name === "tab" && screen.tab === "wallet" && (
              <Wallet
                cards={cards}
                onOpen={(id) => setScreen({ name: "detail", id })}
                onAdd={openAdd}
              />
            )}
            {screen.name === "tab" && screen.tab === "catalogues" && (
              <Catalogues />
            )}
            {screen.name === "tab" && screen.tab === "more" && <More />}

            {screen.name === "detail" && (() => {
              const card = cards.find((c) => c.id === screen.id);
              if (!card) { setScreen({ name: "tab", tab: "home" }); return null; }
              return (
                <Detail
                  card={card}
                  onBack={() => setScreen({ name: "tab", tab: "wallet" })}
                  onSpend={(amount) =>
                    update((cs) => cs.map((c) =>
                      c.id === card.id
                        ? { ...c, balance: Math.max(0, +(c.balance - amount).toFixed(2)) }
                        : c
                    ))
                  }
                  onDelete={() => {
                    update((cs) => cs.filter((c) => c.id !== card.id));
                    setScreen({ name: "tab", tab: "wallet" });
                  }}
                />
              );
            })()}

            {screen.name === "pick" && (
              <PickBrand
                onCancel={() => setScreen({ name: "tab", tab: "home" })}
                onPick={(brand) => setScreen({ name: "scan", brand })}
                onManual={() => setScreen({ name: "add" })}
              />
            )}

            {screen.name === "scan" && (
              <Scan
                brand={screen.brand}
                onCancel={() => setScreen({ name: "pick" })}
                onScanned={(code) => setScreen({ name: "add", brand: screen.brand, code })}
                onManual={() => setScreen({ name: "add", brand: screen.brand })}
              />
            )}

            {screen.name === "add" && (
              <AddCard
                presetBrand={screen.brand}
                presetCode={screen.code}
                onCancel={() => setScreen({ name: "pick" })}
                onSave={(c) => { update((cs) => [c, ...cs]); setScreen({ name: "tab", tab: "wallet" }); }}
              />
            )}

            {screen.name === "expiring" && (
              <Expiring
                cards={cards}
                onBack={() => setScreen({ name: "tab", tab: "home" })}
                onOpen={(id) => setScreen({ name: "detail", id })}
              />
            )}
          </div>

          <BottomNav
            current={currentTab}
            onTab={goTab}
            onAdd={openAdd}
            hidden={screen.name === "scan"}
          />
        </div>
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
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-6 w-28 rounded-full bg-black z-30" />
          <div className="h-full w-full pt-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bottom nav ---------- */
function BottomNav({
  current, onTab, onAdd, hidden,
}: {
  current: Tab | null;
  onTab: (t: Tab) => void;
  onAdd: () => void;
  hidden?: boolean;
}) {
  if (hidden) return null;
  const items: { tab: Tab; label: string; icon: React.ReactNode }[] = [
    { tab: "home", label: "Home", icon: <IconHome /> },
    { tab: "catalogues", label: "Catalogues", icon: <IconBook /> },
    { tab: "wallet", label: "Wallet", icon: <IconWallet /> },
    { tab: "more", label: "More", icon: <IconUser /> },
  ];
  return (
    <div className="absolute left-0 right-0 bottom-0 px-4 pb-3 z-20">
      <div className="relative mx-auto max-w-[340px] rounded-full bg-card/95 backdrop-blur border border-border shadow-card flex items-center justify-between px-2 py-1.5">
        {items.slice(0, 2).map((it) => (
          <NavBtn key={it.tab} active={current === it.tab} onClick={() => onTab(it.tab)} {...it} />
        ))}
        <button
          onClick={onAdd}
          aria-label="Add card"
          className="h-12 w-12 -mt-6 rounded-full gradient-peach text-white grid place-items-center shadow-soft active:scale-95 transition border-4 border-background"
        >
          <Plus />
        </button>
        {items.slice(2).map((it) => (
          <NavBtn key={it.tab} active={current === it.tab} onClick={() => onTab(it.tab)} {...it} />
        ))}
      </div>
    </div>
  );
}

function NavBtn({
  active, onClick, label, icon,
}: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[10px] transition ${
        active ? "text-coral" : "text-muted-foreground"
      }`}
    >
      <span className="h-5 grid place-items-center">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

/* ---------- Home ---------- */
function Home({
  cards, onOpen, onAdd, onExpiring, onCatalogues, nudgeDismissed, onDismissNudge,
}: {
  cards: SpendyCard[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  onExpiring: () => void;
  onCatalogues: () => void;
  nudgeDismissed: boolean;
  onDismissNudge: () => void;
}) {
  const total = cards.reduce((s, c) => s + c.balance, 0);
  const expiringSoon = cards.filter((c) => daysUntil(c.expiresAt) <= 30 && c.balance > 0);
  const nudgeCard = cards.find((c) => c.brand === "Sephora" && c.balance > 0);
  const featured = CATALOGUES.slice(0, 4);

  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <SpendyLogo size={24} />
        <button
          onClick={onAdd}
          className="h-9 px-3 rounded-full bg-card border border-border text-xs font-semibold flex items-center gap-1 active:scale-95 transition"
        >
          <Plus /> Add
        </button>
      </div>

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

      {/* Catalogues teaser */}
      <section className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-2xl">Offers</h2>
          <button onClick={onCatalogues} className="text-xs text-coral font-semibold">See all →</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {featured.map((c) => (
            <CatalogueTile key={c.brand} c={c} />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-2xl">Your cards</h2>
          <span className="text-xs text-muted-foreground">{cards.length} total</span>
        </div>

        {cards.length === 0 ? (
          <EmptyState onAdd={onAdd} />
        ) : (
          <ul className="space-y-3">
            {cards.slice(0, 4).map((c) => (
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

/* ---------- Wallet tab ---------- */
function Wallet({
  cards, onOpen, onAdd,
}: { cards: SpendyCard[]; onOpen: (id: string) => void; onAdd: () => void }) {
  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Wallet</h1>
        <button
          onClick={onAdd}
          className="h-9 px-3 rounded-full bg-card border border-border text-xs font-semibold flex items-center gap-1"
        >
          <Plus /> Add
        </button>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {cards.length} card{cards.length === 1 ? "" : "s"} & codes
      </p>

      {cards.length === 0 ? (
        <div className="mt-6"><EmptyState onAdd={onAdd} /></div>
      ) : (
        <ul className="mt-5 space-y-3">
          {cards.map((c) => (
            <li key={c.id}>
              <CardRow card={c} onClick={() => onOpen(c.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Catalogues tab ---------- */
function Catalogues() {
  return (
    <div className="px-5">
      <h1 className="font-display text-3xl">Catalogues</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Weekly offers from our partner brands.
      </p>

      <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/50 p-4 text-[12px] text-muted-foreground">
        Spot reserved for partner corporates — brands can publish promotions, catalogues and
        sponsored placements here.
      </div>

      <h2 className="font-display text-xl mt-6 mb-3">This week</h2>
      <div className="grid grid-cols-2 gap-3">
        {CATALOGUES.map((c) => (
          <CatalogueTile key={c.brand} c={c} />
        ))}
      </div>
    </div>
  );
}

function CatalogueTile({ c }: { c: typeof CATALOGUES[number] }) {
  return (
    <button className="text-left rounded-2xl overflow-hidden border border-border bg-card shadow-soft active:scale-[.99] transition">
      <div
        className="aspect-square w-full grid place-items-center text-4xl relative"
        style={{ background: c.gradient }}
      >
        <span className="drop-shadow-md">{c.emoji}</span>
        {c.badge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-semibold text-ink">
            {c.badge}
          </span>
        )}
        <span className="absolute top-0 right-0 w-8 h-8 bg-white/80"
              style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />
      </div>
      <div className="p-2.5">
        <p className="text-[13px] font-semibold leading-tight truncate">{c.brand}</p>
        <p className="text-[11px] text-muted-foreground">{c.endsLabel}</p>
      </div>
    </button>
  );
}

/* ---------- More tab ---------- */
function More() {
  const items = [
    { icon: "🔔", label: "Notifications & nudges" },
    { icon: "📍", label: "Location reminders" },
    { icon: "🤝", label: "Partner with Spendy", note: "For corporates" },
    { icon: "🔒", label: "Privacy" },
    { icon: "❓", label: "Help & support" },
  ];
  return (
    <div className="px-5">
      <h1 className="font-display text-3xl">More</h1>
      <ul className="mt-5 rounded-2xl bg-card border border-border overflow-hidden">
        {items.map((i, idx) => (
          <li key={i.label}
              className={`flex items-center gap-3 px-4 py-3 ${idx ? "border-t border-border" : ""}`}>
            <span className="text-xl">{i.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{i.label}</p>
              {i.note && <p className="text-[11px] text-muted-foreground">{i.note}</p>}
            </div>
            <span className="text-muted-foreground">›</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Card row ---------- */
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

/* ---------- Brand picker ---------- */
function PickBrand({
  onCancel, onPick, onManual,
}: {
  onCancel: () => void;
  onPick: (b: Brand) => void;
  onManual: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return BRANDS.filter((b) => b.name.toLowerCase().includes(s));
  }, [q]);
  const popular = BRANDS.filter((b) => b.popular);
  const others = BRANDS.filter((b) => !b.popular);

  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <span className="w-6" />
        <p className="font-display text-xl">Choose card</p>
        <button onClick={onCancel} className="text-xl text-muted-foreground active:opacity-70" aria-label="Close">✕</button>
      </div>

      <div className="mt-4 flex items-center rounded-full bg-secondary px-4 h-11">
        <span className="text-muted-foreground mr-2">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name"
          className="bg-transparent w-full outline-none text-sm"
        />
      </div>

      {filtered ? (
        <BrandList brands={filtered} onPick={onPick} title="Results" />
      ) : (
        <>
          <BrandList brands={popular} onPick={onPick} title="Popular cards" />
          <BrandList brands={others} onPick={onPick} title="More brands" />
        </>
      )}

      <button
        onClick={onManual}
        className="mt-6 mb-2 w-full h-11 rounded-xl bg-card border border-dashed border-border text-sm text-muted-foreground"
      >
        Can't find it? Add manually
      </button>
    </div>
  );
}

function BrandList({
  brands, onPick, title,
}: { brands: Brand[]; onPick: (b: Brand) => void; title: string }) {
  if (!brands.length) return null;
  return (
    <>
      <h2 className="font-display text-2xl mt-5 mb-2">{title}</h2>
      <ul className="rounded-2xl bg-card border border-border overflow-hidden">
        {brands.map((b, i) => (
          <li key={b.name}>
            <button
              onClick={() => onPick(b)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-secondary/70 transition ${
                i ? "border-t border-border" : ""
              }`}
            >
              <BrandLogo brand={b} />
              <span className="flex-1 font-medium text-[15px]">{b.name}</span>
              <span className="text-muted-foreground">›</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Scan (camera viewfinder) ---------- */
function Scan({
  brand, onCancel, onScanned, onManual,
}: {
  brand: Brand;
  onCancel: () => void;
  onScanned: (code: string) => void;
  onManual: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "denied" | "unsupported" | "scanning">("starting");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported"); return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
      } catch {
        setStatus("denied");
      }
    };
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Simulated scan — after a short delay, auto-detect a barcode for the brand.
  useEffect(() => {
    if (status !== "ready") return;
    setStatus("scanning");
    const id = setTimeout(() => {
      const prefix = brand.name.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase() || "GIFT";
      const code = `${prefix}-${rand(4)}-${rand(4)}-${rand(4)}`;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onScanned(code);
    }, 2400);
    return () => clearTimeout(id);
  }, [status, brand, onScanned]);

  const message =
    status === "starting" ? "Starting camera…" :
    status === "denied" ? "Camera permission denied" :
    status === "unsupported" ? "Camera not available on this device" :
    "Hold the barcode inside the frame";

  return (
    <div className="relative h-full bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover opacity-90"
      />
      {/* Fallback gradient if no video */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-zinc-800 to-black" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-2">
        <button onClick={onCancel} className="text-sm bg-black/40 backdrop-blur rounded-full px-3 py-1.5">← Back</button>
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur rounded-full px-3 py-1.5">
          <BrandLogo brand={brand} size={22} />
          <span className="text-xs font-semibold">{brand.name}</span>
        </div>
        <span className="w-12" />
      </div>

      {/* Viewfinder */}
      <div className="relative z-10 mt-10 mx-auto w-[78%] aspect-[1.6/1]">
        <div className="absolute inset-0 rounded-2xl border-2 border-white/80" />
        {/* Corner brackets */}
        {["top-0 left-0 border-l-4 border-t-4 rounded-tl-2xl",
          "top-0 right-0 border-r-4 border-t-4 rounded-tr-2xl",
          "bottom-0 left-0 border-l-4 border-b-4 rounded-bl-2xl",
          "bottom-0 right-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
          <span key={c} className={`absolute h-8 w-8 border-coral ${c}`} />
        ))}
        {/* Scanning line */}
        <span className="absolute left-3 right-3 top-1/2 h-[2px] bg-coral shadow-[0_0_12px_2px_var(--coral)] animate-pulse" />
      </div>

      <p className="relative z-10 text-center text-sm mt-6 px-8 text-white/90">
        {message}
      </p>
      {status === "scanning" && (
        <p className="relative z-10 text-center text-[11px] text-white/60 mt-1">Auto-detecting barcode…</p>
      )}

      <div className="absolute left-0 right-0 bottom-6 z-10 px-6 flex flex-col items-center gap-3">
        {(status === "denied" || status === "unsupported") && (
          <button
            onClick={() => onScanned(`${brand.name.replace(/[^A-Z]/gi, "").slice(0,4).toUpperCase() || "GIFT"}-${rand(4)}-${rand(4)}-${rand(4)}`)}
            className="w-full max-w-[260px] h-11 rounded-full gradient-peach text-white text-sm font-semibold"
          >
            Use demo barcode
          </button>
        )}
        <button onClick={onManual} className="text-xs text-white/70 underline underline-offset-2">
          Enter code manually
        </button>
      </div>
    </div>
  );
}

function rand(n: number) {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, n).toUpperCase().padEnd(n, "0");
}

/* ---------- Add card ---------- */
function AddCard({
  onCancel, onSave, presetBrand, presetCode,
}: {
  onCancel: () => void;
  onSave: (c: SpendyCard) => void;
  presetBrand?: Brand;
  presetCode?: string;
}) {
  const [brand, setBrand] = useState(presetBrand?.name ?? "");
  const [balance, setBalance] = useState("");
  const [code, setCode] = useState(presetCode ?? "");
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
  const [color, setColor] = useState(presetBrand?.cardGradient ?? palette[0]);
  const emojis = ["🎁", "💄", "☕", "🛒", "👗", "👕", "🍎", "🛋️", "✨", "🎟️"];
  const [emoji, setEmoji] = useState(presetBrand?.emoji ?? "🎁");

  const valid = brand.trim() && +balance > 0;

  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="text-sm text-muted-foreground">← Back</button>
        <p className="font-display text-xl">Add card</p>
        <span className="w-10" />
      </div>

      {presetBrand && (
        <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
          <BrandLogo brand={presetBrand} />
          <div className="flex-1">
            <p className="font-semibold text-sm">{presetBrand.name}</p>
            {presetCode ? (
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                Scanned · {presetCode}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">Manual entry</p>
            )}
          </div>
          {presetCode && <span className="text-coral text-lg">✓</span>}
        </div>
      )}

      {!presetBrand && (
        <>
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
        </>
      )}

      <div className="mt-5 space-y-3">
        {!presetBrand && (
          <Field label="Brand">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Sephora"
              className="bg-transparent h-11 w-full outline-none"
            />
          </Field>
        )}

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

        {!presetBrand && (
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
        )}
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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

/* ---------- Nav icons ---------- */
const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
function IconHome() {
  return (<svg width="20" height="20" viewBox="0 0 24 24"><path {...stroke} d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z"/></svg>);
}
function IconBook() {
  return (<svg width="20" height="20" viewBox="0 0 24 24"><path {...stroke} d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5z"/><path {...stroke} d="M8 7h6M8 11h6"/></svg>);
}
function IconWallet() {
  return (<svg width="20" height="20" viewBox="0 0 24 24"><path {...stroke} d="M3 7a2 2 0 012-2h12a2 2 0 012 2v2H5a2 2 0 00-2 2V7z"/><path {...stroke} d="M3 11a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z"/><circle {...stroke} cx="17" cy="14" r="1.3"/></svg>);
}
function IconUser() {
  return (<svg width="20" height="20" viewBox="0 0 24 24"><circle {...stroke} cx="12" cy="8" r="3.5"/><path {...stroke} d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5"/></svg>);
}
