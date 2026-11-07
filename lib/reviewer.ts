// Optional integration with a reviewer bot such as Sir Nitpicksalot. The reviewer leaves hidden
// markers in its PR comments: <!-- nitpick:BASE64URL(JSON) --> ("monster:" is the pre-1.0 prefix). Kentucky Merge reads them to replay
// reviews on the projector. Only comments written by REVIEWER_LOGIN are trusted. Any bot that
// writes the same markers shows up here too.

export const reviewerLogin = (): string | null => process.env.REVIEWER_LOGIN || null;

export type HoldKind = "tiny" | "cooldown" | "forbidden" | "conflict" | "gates" | "over";

/** The subset of the marker format Kentucky Merge cares about. */
export type Marker =
  | { k: "review"; pr: number; sha: string; demands?: { text: string }[]; complaints?: string[] }
  | { k: "eval"; pr: number; sha: string }
  | { k: "approve"; pr: number; sha: string; verdict: string }
  | { k: HoldKind; pr: number; sha: string };

export function decodeMarker(body: string): Marker | null {
  const m = body.match(/<!-- (?:nitpick|monster):([A-Za-z0-9+/=_-]+) -->/);
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[1], "base64url").toString("utf8")) as Marker;
  } catch {
    return null;
  }
}

const PREFIXES = ["Sir", "Lady", "Duke", "Duchess", "Baron", "Countess", "Lord", "Dame", "Prince", "Marquess"];
const NOUNS = ["Galahoof", "Neighville", "Whinnysworth", "Trotsworth", "Canterbury", "Gallopad", "Maneington", "Hoofington", "Stirrup", "Bridleton", "Saddlebury", "Fetlock"];
const SUFFIXES = ["the Swift", "of Mergeshire", "III", "the Unmergeable", "Esq.", "of House Commit", "the Rebased", "von Pullrequest", "the Squashed", "of the Fast-Forward"];

/** Deterministic horse name per login. Same algorithm as Sir Nitpicksalot, so they agree. */
export function horseName(login: string): string {
  let h = 2166136261;
  for (const ch of `horse:${login.toLowerCase()}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  return `${pick(PREFIXES)} ${pick(NOUNS)} ${pick(SUFFIXES)}`;
}

export const REVIEWER_NAME = "Sir Nitpicksalot";

export const REVIEWER_TITLE = "Knight Grand Cross of the Most Pedantic Order of the Code Review";

export const ORDERS = [
  "Order of the Semicolon",
  "Keeper of the Sacred Tabs",
  "Grand Master of PEP-8",
  "Baron of the Linting Marches",
  "Warden of the Trailing Whitespace",
  "Royal Inspector of Indentation",
];
