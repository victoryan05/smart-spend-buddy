import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpendyLogo } from "@/components/SpendyLogo";
import { BrandLogo } from "@/components/BrandLogo";
import { BRANDS, CATALOGUES, type Brand } from "@/lib/spendy-brands";
import {
  loadCards, saveCards, daysUntil, formatMoney,
  type SpendyCard, type CardKind,
} from "@/lib/spendy-data";
import {
  fetchTransactions, insertTransaction, uploadReceipt, parseReceipt, parseEmail,
  getReceiptSignedUrl, fileToBase64, deleteTransaction, getForwardingAddress,
  type DbTransaction, type ParsedReceipt,
} from "@/lib/spendy-db";
import {
  CENTRES, findCentre, ensureNotificationPermission, showCentreNotification,
  type ShoppingCentre,
} from "@/lib/spendy-location";


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
  | { name: "pick" }
  | { name: "scan"; brand: Brand }
  | { name: "add"; brand?: Brand; code?: string; preset?: Partial<SpendyCard> }
  | { name: "expiring" }
  | { name: "receipt" }
  | { name: "inbox" };

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 7 * day) return d.toLocaleDateString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Index() {
  const [cards, setCards] = useState<SpendyCard[]>([]);
  const [txs, setTxs] = useState<DbTransaction[]>([]);
  const [screen, setScreen] = useState<Screen>({ name: "tab", tab: "home" });
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [centre, setCentre] = useState<ShoppingCentre | null>(null);
  const [locStatus, setLocStatus] = useState<"off" | "watching" | "denied">("off");
  const lastNotifiedCentreRef = useRef<string | null>(null);

  const refreshTxs = useCallback(async () => {
    const data = await fetchTransactions();
    setTxs(data);
  }, []);

  useEffect(() => {
    setCards(loadCards());
    void refreshTxs();
  }, [refreshTxs]);
  useEffect(() => { if (cards.length) saveCards(cards); }, [cards]);

  const totalBalance = useMemo(() => cards.reduce((s, c) => s + c.balance, 0), [cards]);

  useEffect(() => {
    if (!centre) { lastNotifiedCentreRef.current = null; return; }
    if (lastNotifiedCentreRef.current === centre.name) return;
    lastNotifiedCentreRef.current = centre.name;
    showCentreNotification(centre.name, formatMoney(totalBalance), cards.length);
  }, [centre, totalBalance, cards.length]);

  const enableLocation = async () => {
    await ensureNotificationPermission();
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocStatus("denied"); return;
    }
    navigator.geolocation.watchPosition(
      (pos) => {
        setLocStatus("watching");
        const hit = findCentre({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCentre(hit);
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
    );
  };

  const simulateCentre = () => {
    const demo = CENTRES[0];
    setCentre(demo);
    setLocStatus("watching");
    void ensureNotificationPermission();
  };

  const logSimpleSpend = async (cardId: string, amount: number, note?: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || amount <= 0) return;
    setCards((cs) => cs.map((c) =>
      c.id === cardId ? { ...c, balance: Math.max(0, +(c.balance - amount).toFixed(2)) } : c
    ));
    await insertTransaction({
      cardId, brand: card.brand, amount, currency: card.currency,
      note, location: centre?.name ?? null,
    });
    await refreshTxs();
  };

  const logReceiptSpend = async (
    cardId: string,
    file: Blob,
    parsed: ParsedReceipt | null,
    amountOverride?: number,
  ) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    const amount = amountOverride ?? parsed?.total ?? 0;
    if (amount <= 0) return;
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = await uploadReceipt(file, ext);
    setCards((cs) => cs.map((c) =>
      c.id === cardId ? { ...c, balance: Math.max(0, +(c.balance - amount).toFixed(2)) } : c
    ));
    await insertTransaction({
      cardId, brand: card.brand, amount, currency: card.currency,
      location: centre?.name ?? null,
      receipt_path: path,
      merchant: parsed?.merchant ?? null,
      purchased_at: parsed?.purchased_at ?? null,
      items: parsed?.items ?? [],
    });
    await refreshTxs();
  };

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
                txs={txs}
                onOpen={(id) => setScreen({ name: "detail", id })}
                onAdd={openAdd}
                onExpiring={() => setScreen({ name: "expiring" })}
                onCatalogues={() => goTab("catalogues")}
                onSnapReceipt={() => setScreen({ name: "receipt" })}
                nudgeDismissed={nudgeDismissed}
                onDismissNudge={() => setNudgeDismissed(true)}
                centre={centre}
                locStatus={locStatus}
                onEnableLocation={enableLocation}
                onSimulateCentre={simulateCentre}
              />
            )}
            {screen.name === "tab" && screen.tab === "wallet" && (
              <Wallet
                cards={cards}
                txs={txs}
                onOpen={(id) => setScreen({ name: "detail", id })}
                onAdd={openAdd}
              />
            )}
            {screen.name === "tab" && screen.tab === "catalogues" && <Catalogues />}
            {screen.name === "tab" && screen.tab === "more" && (
              <More
                locStatus={locStatus}
                onEnableLocation={enableLocation}
                onSimulateCentre={simulateCentre}
              />
            )}

            {screen.name === "detail" && (() => {
              const card = cards.find((c) => c.id === screen.id);
              if (!card) { setScreen({ name: "tab", tab: "home" }); return null; }
              return (
                <Detail
                  card={card}
                  txs={txs.filter((t) => t.card_id === card.id)}
                  onBack={() => setScreen({ name: "tab", tab: "wallet" })}
                  onSpend={(amount, note) => logSimpleSpend(card.id, amount, note)}
                  onSnapReceipt={() => setScreen({ name: "receipt" })}
                  onDelete={() => {
                    setCards((cs) => cs.filter((c) => c.id !== card.id));
                    setScreen({ name: "tab", tab: "wallet" });
                  }}
                  onDeleteTx={async (tx) => {
                    await deleteTransaction(tx.id, tx.receipt_path);
                    // restore balance
                    setCards((cs) => cs.map((c) =>
                      c.id === tx.card_id ? { ...c, balance: +(c.balance + Number(tx.amount)).toFixed(2) } : c
                    ));
                    await refreshTxs();
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
                preset={screen.preset}
                onCancel={() => setScreen({ name: "pick" })}
                onSave={(c) => { setCards((cs) => [c, ...cs]); setScreen({ name: "tab", tab: "wallet" }); }}
              />
            )}

            {screen.name === "expiring" && (
              <Expiring
                cards={cards}
                onBack={() => setScreen({ name: "tab", tab: "home" })}
                onOpen={(id) => setScreen({ name: "detail", id })}
              />
            )}

            {screen.name === "receipt" && (
              <SnapReceipt
                cards={cards}
                onCancel={() => setScreen({ name: "tab", tab: "home" })}
                onDone={async (cardId, file, parsed, amountOverride) => {
                  await logReceiptSpend(cardId, file, parsed, amountOverride);
                  setScreen({ name: "tab", tab: "wallet" });
                }}
              />
            )}

            {screen.name === "inbox" && (
              <Inbox
                cards={cards}
                onCancel={() => setScreen({ name: "tab", tab: "home" })}
                onAddCard={(preset) => setScreen({ name: "add", preset })}
                onAddTx={async (cardId, parsed) => {
                  const card = cards.find((c) => c.id === cardId);
                  if (!card || !parsed?.total) return;
                  setCards((cs) => cs.map((c) =>
                    c.id === cardId ? { ...c, balance: Math.max(0, +(c.balance - (parsed.total ?? 0)).toFixed(2)) } : c,
                  ));
                  await insertTransaction({
                    cardId, brand: card.brand, amount: parsed.total, currency: card.currency,
                    location: centre?.name ?? null,
                    merchant: parsed.merchant ?? null,
                    purchased_at: parsed.purchased_at ?? null,
                    items: parsed.items ?? [],
                    note: "From forwarded email",
                  });
                  await refreshTxs();
                  setScreen({ name: "tab", tab: "wallet" });
                }}
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
        Tap a card to see the code & spend. Receipts are saved to your Spendy vault.
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
          <div className="h-full w-full pt-10">{children}</div>
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
  cards, txs, onOpen, onAdd, onExpiring, onCatalogues, onSnapReceipt,
  nudgeDismissed, onDismissNudge,
  centre, locStatus, onEnableLocation, onSimulateCentre,
}: {
  cards: SpendyCard[];
  txs: DbTransaction[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  onExpiring: () => void;
  onCatalogues: () => void;
  onSnapReceipt: () => void;
  nudgeDismissed: boolean;
  onDismissNudge: () => void;
  centre: ShoppingCentre | null;
  locStatus: "off" | "watching" | "denied";
  onEnableLocation: () => void;
  onSimulateCentre: () => void;
}) {
  const total = cards.reduce((s, c) => s + c.balance, 0);
  const expiringSoon = cards.filter((c) => daysUntil(c.expiresAt) <= 30 && c.balance > 0);
  const nudgeCard = cards.find((c) => c.brand === "Sephora" && c.balance > 0);
  const featured = CATALOGUES.slice(0, 4);
  const recent = txs.slice(0, 3);

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
        <p className="font-display text-[3.2rem] leading-none mt-2">{formatMoney(total)}</p>
        <p className="text-sm opacity-90 mt-2">
          across {cards.length} card{cards.length === 1 ? "" : "s"} & codes
        </p>
      </section>

      {centre ? (
        <div className="mt-4 rounded-2xl p-4 gradient-peach text-white shadow-soft">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-full bg-white/20 grid place-items-center text-lg shrink-0">📍</div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold">You're at {centre.name}</p>
              <p className="text-[12px] opacity-90 mt-0.5 leading-snug">
                {formatMoney(total)} to spend over {cards.length} card{cards.length === 1 ? "" : "s"}.
                Open Spendy at the till.
              </p>
            </div>
          </div>
        </div>
      ) : locStatus === "off" ? (
        <div className="mt-4 rounded-2xl bg-card border border-border p-4 shadow-soft">
          <p className="text-[13px] font-semibold">Get nudged at the shops</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Spendy will quietly remind you when you walk into Westfield or another centre with cards waiting.
          </p>
          <div className="flex gap-2 mt-3">
            <button onClick={onEnableLocation} className="flex-1 h-9 rounded-xl gradient-peach text-white text-xs font-semibold active:scale-[.99]">Enable location</button>
            <button onClick={onSimulateCentre} className="h-9 px-3 rounded-xl bg-secondary text-xs font-medium">Simulate</button>
          </div>
        </div>
      ) : locStatus === "denied" ? (
        <div className="mt-4 rounded-2xl bg-card border border-border p-4 shadow-soft">
          <p className="text-[13px] font-semibold">Location off</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Allow location in your browser/device settings to get centre nudges.
          </p>
          <button onClick={onSimulateCentre} className="mt-3 h-9 px-3 rounded-xl bg-secondary text-xs font-medium">Simulate Westfield</button>
        </div>
      ) : !nudgeDismissed && nudgeCard ? (
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
          <span role="button" onClick={(e) => { e.stopPropagation(); onDismissNudge(); }} className="text-muted-foreground text-xs px-1 py-0.5">✕</span>
        </button>
      ) : null}

      <button
        onClick={onSnapReceipt}
        className="mt-4 w-full flex items-center gap-3 rounded-2xl bg-card border border-border p-4 shadow-soft active:scale-[.99] transition text-left"
      >
        <div className="h-10 w-10 rounded-full bg-accent/60 grid place-items-center text-lg shrink-0">🧾</div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold">Just finished shopping?</p>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
            Snap your receipt — AI reads the items and we save it for returns.
          </p>
        </div>
        <span className="text-coral">→</span>
      </button>

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

      <section className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-2xl">Offers</h2>
          <button onClick={onCatalogues} className="text-xs text-coral font-semibold">See all →</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {featured.map((c) => <CatalogueTile key={c.brand} c={c} />)}
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
              <li key={c.id}><CardRow card={c} onClick={() => onOpen(c.id)} /></li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-2xl mb-3">Recent activity</h2>
          <ul className="space-y-2">
            {recent.map((t) => <TxRow key={t.id} tx={t} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------- Wallet tab ---------- */
function Wallet({
  cards, txs, onOpen, onAdd,
}: { cards: SpendyCard[]; txs: DbTransaction[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const [tab, setTab] = useState<"cards" | "activity">("cards");
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
        {cards.length} card{cards.length === 1 ? "" : "s"} · {txs.length} transaction{txs.length === 1 ? "" : "s"}
      </p>

      <div className="mt-4 flex bg-secondary rounded-full p-1 text-xs font-semibold">
        {(["cards", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 h-8 rounded-full capitalize transition ${
              tab === t ? "bg-card shadow-soft" : "text-muted-foreground"
            }`}
          >{t}</button>
        ))}
      </div>

      {tab === "cards" ? (
        cards.length === 0 ? (
          <div className="mt-6"><EmptyState onAdd={onAdd} /></div>
        ) : (
          <ul className="mt-5 space-y-3">
            {cards.map((c) => (
              <li key={c.id}><CardRow card={c} onClick={() => onOpen(c.id)} /></li>
            ))}
          </ul>
        )
      ) : txs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No transactions yet. Snap a receipt after your next shop.
        </div>
      ) : (
        <ul className="mt-5 space-y-2">
          {txs.map((t) => <TxRow key={t.id} tx={t} />)}
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
      <p className="text-sm text-muted-foreground mt-1">Weekly offers from our partner brands.</p>
      <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/50 p-4 text-[12px] text-muted-foreground">
        Spot reserved for partner corporates — brands can publish promotions, catalogues and
        sponsored placements here.
      </div>
      <h2 className="font-display text-xl mt-6 mb-3">This week</h2>
      <div className="grid grid-cols-2 gap-3">
        {CATALOGUES.map((c) => <CatalogueTile key={c.brand} c={c} />)}
      </div>
    </div>
  );
}

function CatalogueTile({ c }: { c: typeof CATALOGUES[number] }) {
  return (
    <button className="text-left rounded-2xl overflow-hidden border border-border bg-card shadow-soft active:scale-[.99] transition">
      <div className="aspect-square w-full grid place-items-center text-4xl relative" style={{ background: c.gradient }}>
        <span className="drop-shadow-md">{c.emoji}</span>
        {c.badge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-semibold text-ink">{c.badge}</span>
        )}
        <span className="absolute top-0 right-0 w-8 h-8 bg-white/80" style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />
      </div>
      <div className="p-2.5">
        <p className="text-[13px] font-semibold leading-tight truncate">{c.brand}</p>
        <p className="text-[11px] text-muted-foreground">{c.endsLabel}</p>
      </div>
    </button>
  );
}

/* ---------- More tab ---------- */
function More({
  locStatus, onEnableLocation, onSimulateCentre,
}: {
  locStatus: "off" | "watching" | "denied";
  onEnableLocation: () => void;
  onSimulateCentre: () => void;
}) {
  const statusLabel = locStatus === "watching" ? "On" : locStatus === "denied" ? "Blocked" : "Off";
  return (
    <div className="px-5">
      <h1 className="font-display text-3xl">More</h1>
      <div className="mt-5 rounded-2xl bg-card border border-border p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="text-xl">📍</span>
          <div className="flex-1">
            <p className="text-sm font-semibold">Location reminders</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
              Get notified at Westfield and other partner centres — even when Spendy is closed
              (requires a quick OS permission).
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={onEnableLocation} className="h-9 px-3 rounded-xl gradient-peach text-white text-xs font-semibold">Enable</button>
              <button onClick={onSimulateCentre} className="h-9 px-3 rounded-xl bg-secondary text-xs font-medium">Simulate Westfield</button>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">{statusLabel}</span>
        </div>
      </div>
      <ul className="mt-4 rounded-2xl bg-card border border-border overflow-hidden">
        {[
          { icon: "🔔", label: "Notifications & nudges" },
          { icon: "🧾", label: "Receipts vault", note: "Stored for returns & refunds" },
          { icon: "🤝", label: "Partner with Spendy", note: "For corporates" },
          { icon: "🔒", label: "Privacy" },
          { icon: "❓", label: "Help & support" },
        ].map((i, idx) => (
          <li key={i.label} className={`flex items-center gap-3 px-4 py-3 ${idx ? "border-t border-border" : ""}`}>
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
      <div className="h-12 w-16 rounded-xl shrink-0 grid place-items-center text-xl shadow-inner" style={{ background: card.color }}>
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
  card, txs, onBack, onSpend, onDelete, onDeleteTx, onSnapReceipt,
}: {
  card: SpendyCard;
  txs: DbTransaction[];
  onBack: () => void;
  onSpend: (amount: number, note?: string) => Promise<void> | void;
  onSnapReceipt: () => void;
  onDelete: () => void;
  onDeleteTx: (tx: DbTransaction) => Promise<void> | void;
}) {
  const days = daysUntil(card.expiresAt);
  const [amount, setAmount] = useState("");
  const [openTx, setOpenTx] = useState<DbTransaction | null>(null);

  const submit = async () => {
    const n = +amount;
    if (!n || n <= 0) return;
    await onSpend(n);
    setAmount("");
  };

  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground active:opacity-70">← Back</button>
        <button onClick={onDelete} className="text-xs text-muted-foreground active:opacity-70">Delete</button>
      </div>

      <div className="mt-4 rounded-3xl p-6 text-white shadow-card relative overflow-hidden aspect-[1.6/1] flex flex-col justify-between" style={{ background: card.color }}>
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
        <button onClick={() => navigator.clipboard?.writeText(card.code)} className="mt-3 w-full h-10 rounded-xl bg-secondary text-sm font-medium active:scale-[.99]">Copy code</button>
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
            onClick={submit}
            className="h-11 px-5 rounded-xl gradient-peach text-white text-sm font-semibold disabled:opacity-40 active:scale-[.99]"
          >Spend</button>
        </div>
        <div className="flex gap-2 mt-3">
          {[5, 10, 25].map((q) => (
            <button key={q} onClick={() => setAmount(String(q))} className="flex-1 h-9 rounded-lg bg-secondary text-xs">${q}</button>
          ))}
        </div>
        <button
          onClick={onSnapReceipt}
          className="mt-3 w-full h-10 rounded-xl bg-secondary text-sm font-medium flex items-center justify-center gap-2 active:scale-[.99]"
        >
          <span>📷</span> Snap receipt — AI logs the items
        </button>
        {card.note && <p className="text-[11px] text-muted-foreground mt-3">{card.note}</p>}
      </div>

      <div className="mt-5 rounded-2xl bg-card border border-border p-4 shadow-soft">
        <p className="text-sm font-semibold mb-2">Transactions</p>
        {txs.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">
            No purchases logged yet. Spend the card or snap a receipt — it'll show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {txs.map((t) => (
              <TxRow key={t.id} tx={t} onOpen={() => setOpenTx(t)} />
            ))}
          </ul>
        )}
      </div>

      {openTx && (
        <TxDetailModal
          tx={openTx}
          onClose={() => setOpenTx(null)}
          onDelete={async () => {
            const t = openTx;
            setOpenTx(null);
            await onDeleteTx(t);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Transaction row + detail modal ---------- */
function TxRow({ tx, onOpen }: { tx: DbTransaction; onOpen?: () => void }) {
  const itemCount = tx.items?.length ?? 0;
  return (
    <li>
      <button
        onClick={onOpen}
        disabled={!onOpen}
        className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border text-left disabled:cursor-default active:scale-[.99] transition"
      >
        <div className="h-10 w-10 rounded-lg bg-secondary grid place-items-center text-base shrink-0">
          {tx.receipt_path ? "🧾" : "💳"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">{tx.merchant || tx.brand}</p>
            <p className="font-display text-base">-{formatMoney(Number(tx.amount), tx.currency)}</p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
            <span className="truncate">
              {formatWhen(tx.purchased_at || tx.created_at)}
              {tx.location ? ` · ${tx.location}` : ""}
            </span>
            <span className="text-coral">
              {itemCount > 0 ? `${itemCount} items` : tx.receipt_path ? "Receipt" : ""}
            </span>
          </div>
        </div>
      </button>
    </li>
  );
}

function TxDetailModal({
  tx, onClose, onDelete,
}: { tx: DbTransaction; onClose: () => void; onDelete: () => void }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (tx.receipt_path) {
      void getReceiptSignedUrl(tx.receipt_path).then((u) => { if (alive) setImgUrl(u); });
    }
    return () => { alive = false; };
  }, [tx.receipt_path]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/70 grid place-items-end md:place-items-center p-0 md:p-6">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md bg-background rounded-t-3xl md:rounded-3xl max-h-[88%] overflow-y-auto shadow-card"
      >
        <div className="sticky top-0 bg-background flex items-center justify-between px-5 py-3 border-b border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground">Close</button>
          <p className="font-display text-lg">Transaction</p>
          <button onClick={onDelete} className="text-xs text-destructive">Delete</button>
        </div>
        <div className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{tx.brand}</p>
          <p className="font-display text-3xl mt-1">{tx.merchant || tx.brand}</p>
          <p className="font-display text-2xl text-coral mt-1">-{formatMoney(Number(tx.amount), tx.currency)}</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {new Date(tx.purchased_at || tx.created_at).toLocaleString()}
            {tx.location ? ` · ${tx.location}` : ""}
          </p>

          {tx.items && tx.items.length > 0 && (
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Items</p>
              <ul className="rounded-2xl border border-border overflow-hidden">
                {tx.items.map((it, i) => (
                  <li key={it.id} className={`flex items-center justify-between px-3 py-2.5 ${i ? "border-t border-border" : ""} bg-card`}>
                    <span className="text-sm truncate pr-3">
                      {it.name}
                      {it.qty && it.qty !== 1 ? <span className="text-muted-foreground"> × {it.qty}</span> : null}
                    </span>
                    <span className="font-mono text-sm">
                      {it.price != null ? formatMoney(Number(it.price), tx.currency) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tx.receipt_path && (
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Receipt</p>
              {imgUrl ? (
                <a href={imgUrl} target="_blank" rel="noopener" className="block rounded-2xl overflow-hidden border border-border">
                  <img src={imgUrl} alt="Receipt" className="w-full object-cover" />
                </a>
              ) : (
                <div className="h-40 rounded-2xl bg-secondary grid place-items-center text-xs text-muted-foreground">
                  Loading receipt…
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                Stored in your Spendy vault. Use for returns or refunds.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Snap receipt ---------- */
function SnapReceipt({
  cards, onCancel, onDone,
}: {
  cards: SpendyCard[];
  onCancel: () => void;
  onDone: (cardId: string, file: Blob, parsed: ParsedReceipt | null, amountOverride?: number) => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string>(cards[0]?.id ?? "");
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [status, setStatus] = useState<"idle" | "parsing" | "ready" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onPickFile = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setStatus("parsing");
    setError(null);
    setParsed(null);
    const dataUrl = await fileToBase64(f);
    setPreview(dataUrl);
    const result = await parseReceipt(dataUrl);
    if (!result || result.total == null) {
      setError("Couldn't read the total off this receipt. Try a clearer photo.");
      setStatus("error");
      return;
    }
    setParsed(result);
    setStatus("ready");
  };

  const effectiveAmount = parsed?.total ?? 0;
  const canSave = !!cardId && !!file && effectiveAmount > 0 && status === "ready";

  const submit = async () => {
    if (!file || !cardId) return;
    setStatus("saving");
    try {
      await onDone(cardId, file, parsed, undefined);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Couldn't save");
    }
  };

  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="text-sm text-muted-foreground">← Back</button>
        <p className="font-display text-xl">Snap receipt</p>
        <span className="w-10" />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPickFile(e.target.files?.[0])}
      />

      <button
        onClick={() => fileRef.current?.click()}
        className="mt-5 w-full aspect-[4/3] rounded-3xl bg-card border border-dashed border-border grid place-items-center text-center overflow-hidden shadow-soft active:scale-[.99] transition"
      >
        {preview ? (
          <img src={preview} alt="Receipt" className="h-full w-full object-cover" />
        ) : (
          <div>
            <div className="text-4xl">📷</div>
            <p className="text-sm font-semibold mt-2">Tap to capture receipt</p>
            <p className="text-[11px] text-muted-foreground mt-1 px-8">
              AI extracts every item, price, and the date — saved for returns.
            </p>
          </div>
        )}
      </button>

      {status === "parsing" && (
        <p className="mt-3 text-center text-xs text-muted-foreground animate-pulse">Reading receipt with AI…</p>
      )}
      {error && (
        <p className="mt-3 text-center text-xs text-destructive">{error}</p>
      )}

      {parsed && (
        <div className="mt-4 rounded-2xl bg-card border border-border p-3 shadow-soft">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold truncate">{parsed.merchant || "Receipt"}</p>
            <p className="font-display text-lg">{parsed.total != null ? formatMoney(parsed.total) : "—"}</p>
          </div>
          {parsed.purchased_at && (
            <p className="text-[11px] text-muted-foreground">{new Date(parsed.purchased_at).toLocaleString()}</p>
          )}
          {parsed.items?.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-[12px]">
              {parsed.items.slice(0, 8).map((it, i) => (
                <li key={i} className="flex justify-between py-0.5">
                  <span className="truncate pr-3">{it.name}</span>
                  <span className="font-mono">{it.price != null ? formatMoney(it.price) : ""}</span>
                </li>
              ))}
              {parsed.items.length > 8 && (
                <li className="text-muted-foreground">+ {parsed.items.length - 8} more</li>
              )}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Paid with</p>
          {cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a card first.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-44 overflow-y-auto">
              {cards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCardId(c.id)}
                  className={`flex items-center gap-3 p-2 rounded-xl border text-left transition ${
                    cardId === c.id ? "border-coral bg-accent/30" : "border-border bg-card"
                  }`}
                >
                  <div className="h-9 w-12 rounded-lg grid place-items-center text-base" style={{ background: c.color }}>
                    <span>{c.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{c.brand}</p>
                    <p className="text-[11px] text-muted-foreground">{formatMoney(c.balance, c.currency)} left</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {parsed?.total != null && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Amount (read from receipt)</p>
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 h-11">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-xl">{formatMoney(parsed.total)}</span>
            </div>
          </div>
        )}

      <button
        disabled={!canSave}
        onClick={submit}
        className="mt-6 w-full h-12 rounded-2xl gradient-peach text-white font-semibold shadow-soft disabled:opacity-40 active:scale-[.99]"
      >
        {status === "saving" ? "Saving…" : "Save transaction"}
      </button>
      <p className="text-[11px] text-muted-foreground mt-2 text-center">
        Receipt is uploaded to your Spendy vault for returns and refunds.
      </p>
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
        <span key={i} className="bg-ink" style={{ width: w, height: i % 7 === 0 ? "100%" : "92%" }} />
      ))}
    </div>
  );
}

/* ---------- Brand picker ---------- */
function PickBrand({
  onCancel, onPick, onManual,
}: { onCancel: () => void; onPick: (b: Brand) => void; onManual: () => void }) {
  const [q, setQ] = useState("");
  const sorted = useMemo(() => [...BRANDS].sort((a, b) => a.name.localeCompare(b.name)), []);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sorted;
    return sorted.filter((b) => b.name.toLowerCase().includes(s));
  }, [q, sorted]);

  // Group A-Z for a clean address-book feel.
  const groups = useMemo(() => {
    const g: Record<string, Brand[]> = {};
    for (const b of filtered) {
      const letter = b.name[0].toUpperCase();
      (g[letter] ||= []).push(b);
    }
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

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

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center mt-8">No matches.</p>
      ) : (
        groups.map(([letter, brands]) => (
          <div key={letter}>
            <h2 className="font-display text-xs uppercase tracking-wider text-muted-foreground mt-5 mb-1.5 px-1">{letter}</h2>
            <ul className="rounded-2xl bg-card border border-border overflow-hidden">
              {brands.map((b, i) => (
                <li key={b.name}>
                  <button
                    onClick={() => onPick(b)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-secondary/70 transition ${i ? "border-t border-border" : ""}`}
                  >
                    <BrandLogo brand={b} />
                    <span className="flex-1 font-medium text-[15px]">{b.name}</span>
                    <span className="text-muted-foreground">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
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

/* ---------- Scan (camera viewfinder matching reference) ---------- */
function Scan({
  brand, onCancel, onScanned, onManual,
}: {
  brand: Brand;
  onCancel: () => void;
  onScanned: (code: string) => void;
  onManual: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "ready" | "denied" | "unsupported">("starting");

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
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-detect demo barcode once the camera is up.
  useEffect(() => {
    if (status !== "ready") return;
    const id = setTimeout(() => {
      const prefix = brand.name.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase() || "GIFT";
      const code = `${prefix}-${rand(4)}-${rand(4)}-${rand(4)}`;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onScanned(code);
    }, 3200);
    return () => clearTimeout(id);
  }, [status, brand, onScanned]);

  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    // Demo: skip OCR, generate code from filename.
    const code = `${brand.name.replace(/[^A-Z]/gi, "").slice(0, 4).toUpperCase() || "GIFT"}-${rand(4)}-${rand(4)}-${rand(4)}`;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onScanned(code);
  };

  const message =
    status === "starting" ? "Starting camera…" :
    status === "denied" ? "Camera permission denied — use manual entry or upload below." :
    status === "unsupported" ? "Camera not available on this device." :
    null;

  return (
    <div className="px-5 pb-6">
      {/* Header */}
      <div className="relative flex items-center justify-center pt-1">
        <button
          onClick={onCancel}
          aria-label="Back"
          className="absolute left-0 top-0 h-9 w-9 grid place-items-center text-foreground active:opacity-70"
        >
          <ArrowLeft />
        </button>
        <div className="text-center">
          <p className="font-display text-xl leading-tight">{brand.name}</p>
          <p className="text-sm text-muted-foreground -mt-0.5">Scan Barcode</p>
        </div>
      </div>

      {/* Camera viewfinder — rounded square */}
      <div className="mt-4 relative w-full aspect-square rounded-[2rem] overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black -z-10" />

        {/* Barcode frame overlay (centered) */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="w-[68%] aspect-[2/1] rounded-2xl border-2 border-white/90 grid place-items-center">
            <FrameBars />
          </div>
        </div>

        {(status === "denied" || status === "unsupported") && (
          <div className="absolute inset-0 bg-black/60 grid place-items-center p-6 text-center">
            <div>
              <div className="text-3xl">📷</div>
              <p className="text-white text-sm mt-2">{message}</p>
            </div>
          </div>
        )}
        {status === "starting" && (
          <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
            Starting camera…
          </div>
        )}
      </div>

      {/* Two options */}
      <div className="mt-5 rounded-2xl border border-border bg-card/30 overflow-hidden">
        <button
          onClick={onManual}
          className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/40 transition text-left"
        >
          <PencilIcon />
          <span className="flex-1 text-[15px]">Enter card number manually</span>
          <span className="text-muted-foreground">›</span>
        </button>
        <div className="h-px bg-border/70 mx-4" />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-3 px-4 py-4 active:bg-secondary/40 transition text-left"
        >
          <ImageIcon />
          <span className="flex-1 text-[15px]">Upload image of card</span>
          <span className="text-muted-foreground">›</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPickImage(e.target.files?.[0])}
      />
    </div>
  );
}

function FrameBars() {
  // Stylised barcode lines (decorative)
  const widths = [2, 4, 1, 3, 1, 2, 5, 1, 2, 4, 1, 1, 3, 2, 1, 4, 2, 1, 3, 2, 1, 5, 2, 1, 3];
  return (
    <div className="flex items-end h-3/4 gap-[3px]">
      {widths.map((w, i) => (
        <span key={i} className="bg-white" style={{ width: w, height: "100%" }} />
      ))}
    </div>
  );
}

function rand(n: number) {
  return Math.random().toString(36).replace(/[^a-z0-9]/g, "").slice(0, n).toUpperCase().padEnd(n, "0");
}

/* ---------- Add card ---------- */
function AddCard({
  onCancel, onSave, presetBrand, presetCode, preset,
}: {
  onCancel: () => void;
  onSave: (c: SpendyCard) => void;
  presetBrand?: Brand;
  presetCode?: string;
  preset?: Partial<SpendyCard>;
}) {
  const defaultExpiry = useMemo(() => {
    const base = preset?.expiresAt ? new Date(preset.expiresAt) : new Date(Date.now() + 90 * 86400000);
    return base.toISOString().slice(0, 10);
  }, [preset?.expiresAt]);
  const [brand, setBrand] = useState(preset?.brand ?? presetBrand?.name ?? "");
  const [balance, setBalance] = useState(preset?.balance != null ? String(preset.balance) : "");
  const [code, setCode] = useState(preset?.code ?? presetCode ?? "");
  const [kind, setKind] = useState<CardKind>(preset?.kind ?? "gift");
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);

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
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Scanned · {presetCode}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-0.5">Manual entry</p>
            )}
          </div>
          {presetCode && <span className="text-coral text-lg">✓</span>}
        </div>
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
          <Field label="Expiry date">
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="bg-transparent h-11 w-full outline-none text-sm"
            />
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
                  kind === k ? "gradient-peach text-white border-transparent" : "bg-card border-border text-foreground"
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
            expiresAt: (expiryDate ? new Date(expiryDate) : new Date(Date.now() + 90 * 86400000)).toISOString(),
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
  const items = [...cards].filter((c) => c.balance > 0).sort((a, b) => daysUntil(a.expiresAt) - daysUntil(b.expiresAt));
  return (
    <div className="px-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-muted-foreground">← Back</button>
        <p className="font-display text-xl">Expiring</p>
        <span className="w-10" />
      </div>
      <p className="text-sm text-muted-foreground mt-2">Use these before they vanish.</p>
      <ul className="mt-4 space-y-3">
        {items.map((c) => (
          <li key={c.id}><CardRow card={c} onClick={() => onOpen(c.id)} /></li>
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
      <p className="text-sm text-muted-foreground mt-1">Add your first gift card or code — takes under a minute.</p>
      <button onClick={onAdd} className="mt-4 h-10 px-5 rounded-xl gradient-peach text-white text-sm font-semibold shadow-soft">
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

function ArrowLeft() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="9" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M4 17l5-4 4 3 3-2 4 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/* ---------- Nav icons ---------- */
const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
function IconHome() { return (<svg width="20" height="20" viewBox="0 0 24 24"><path {...stroke} d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z"/></svg>); }
function IconBook() { return (<svg width="20" height="20" viewBox="0 0 24 24"><path {...stroke} d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5z"/><path {...stroke} d="M8 7h6M8 11h6"/></svg>); }
function IconWallet() { return (<svg width="20" height="20" viewBox="0 0 24 24"><path {...stroke} d="M3 7a2 2 0 012-2h12a2 2 0 012 2v2H5a2 2 0 00-2 2V7z"/><path {...stroke} d="M3 11a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6z"/><circle {...stroke} cx="17" cy="14" r="1.3"/></svg>); }
function IconUser() { return (<svg width="20" height="20" viewBox="0 0 24 24"><circle {...stroke} cx="12" cy="8" r="3.5"/><path {...stroke} d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5"/></svg>); }
