// Simulated Australian shopping-centre geofences for the MVP prototype.
// In production this would run via a native wrapper / service worker for
// background triggers; here we use the browser Geolocation + Notification APIs
// and expose a "simulate" hook so the prototype works on desktop too.

export interface ShoppingCentre {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

export const CENTRES: ShoppingCentre[] = [
  { name: "Westfield Sydney", lat: -33.8700, lng: 151.2094, radiusMeters: 250 },
  { name: "Westfield Bondi Junction", lat: -33.8918, lng: 151.2496, radiusMeters: 300 },
  { name: "Westfield Chatswood", lat: -33.7969, lng: 151.1830, radiusMeters: 250 },
  { name: "Westfield Parramatta", lat: -33.8170, lng: 151.0028, radiusMeters: 300 },
  { name: "Chadstone Shopping Centre", lat: -37.8884, lng: 145.0825, radiusMeters: 400 },
  { name: "Melbourne Central", lat: -37.8103, lng: 144.9633, radiusMeters: 200 },
  { name: "QV Melbourne", lat: -37.8108, lng: 144.9650, radiusMeters: 200 },
];

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function findCentre(coords: { lat: number; lng: number }): ShoppingCentre | null {
  for (const c of CENTRES) {
    if (distanceMeters(coords, c) <= c.radiusMeters) return c;
  }
  return null;
}

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try { return await Notification.requestPermission(); } catch { return "denied"; }
  }
  return Notification.permission;
}

export function showCentreNotification(centre: string, totalLabel: string, cardCount: number) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(`You're at ${centre}`, {
      body: `You've got ${totalLabel} to spend across ${cardCount} card${cardCount === 1 ? "" : "s"} — open Spendy.`,
      tag: "spendy-centre-nudge",
      icon: "/favicon.ico",
    });
  } catch {
    // Some browsers block constructor outside SW; ignore silently in prototype.
  }
}
