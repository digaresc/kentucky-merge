import { ghGet, targetRepo, type GhComment, type GhPull } from "./github";
import { decodeMarker, horseName, reviewerLogin, type HoldKind, type Marker } from "./reviewer";
import { eventWindow, raceMinutes, rules } from "./rules";

export interface Hacker {
  login: string;
  avatarUrl: string;
  horseName: string;
  merged: number;
  open: number;
  lastMergedAt: string | null;
}

export interface Merge {
  number: number;
  title: string;
  author: string;
  url: string;
  mergedAt: string;
  complaints: string[];
  verdict: string;
}

export interface OpenPr {
  number: number;
  title: string;
  author: string;
  url: string;
  hold: HoldKind | "changes" | null;
}

export interface RaceState {
  repo: string | null;
  demo: boolean;
  /** A reviewer bot is configured, so merges carry its demands and verdicts. */
  reviewer: boolean;
  error: string | null;
  now: string;
  title: string;
  ticker: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  trackLength: number;
  hackers: Hacker[];
  merges: Merge[];
  openPrs: OpenPr[];
}

interface Snapshot {
  pulls: GhPull[];
  /** Reviewer markers by PR number, oldest first. */
  markers: Map<number, Marker[]>;
}

// Per-instance cache so a room full of projectors/phones doesn't burn the GitHub rate limit.
let cache: { at: number; snap: Snapshot } | null = null;

async function pages<T>(path: string, max: number): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= max; page++) {
    const batch = await ghGet<T[]>(`${path}&per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function getSnapshot(repo: string): Promise<Snapshot> {
  const ttl = process.env.GITHUB_TOKEN ? 8_000 : 45_000;
  if (cache && Date.now() - cache.at < ttl) return cache.snap;

  const reviewer = reviewerLogin();
  const since = (eventWindow().start ?? new Date(Date.now() - 14 * 86_400_000)).toISOString();
  const [open, closed, comments] = await Promise.all([
    pages<GhPull>(`/repos/${repo}/pulls?state=open`, 2),
    pages<GhPull>(`/repos/${repo}/pulls?state=closed&sort=updated&direction=desc`, 3),
    reviewer ? pages<GhComment>(`/repos/${repo}/issues/comments?since=${since}&sort=created&direction=asc`, 5) : Promise.resolve([]),
  ]);

  const markers = new Map<number, Marker[]>();
  for (const c of comments) {
    // Anyone can paste a marker into a comment; only the reviewer's own count.
    if (c.user.login !== reviewer) continue;
    const m = decodeMarker(c.body);
    if (m) markers.set(m.pr, [...(markers.get(m.pr) ?? []), m]);
  }

  const snap = { pulls: [...open, ...closed], markers };
  cache = { at: Date.now(), snap };
  return snap;
}

function buildState(
  snap: Snapshot,
  base: Pick<RaceState, "repo" | "demo" | "reviewer" | "error">,
  start: Date | null,
  end: Date | null,
): RaceState {
  const r = rules();
  const racers = snap.pulls.filter((p) => p.user.type !== "Bot" && !r.excluded.has(p.user.login.toLowerCase()));
  const inWindow = (iso: string) => {
    const t = new Date(iso).getTime();
    return (!start || t >= start.getTime()) && (!end || t <= end.getTime());
  };
  const merged = racers
    .filter((p) => p.merged_at && inWindow(p.merged_at))
    .sort((a, b) => b.merged_at!.localeCompare(a.merged_at!));
  const open = racers.filter((p) => p.state === "open" && !p.draft);

  const hackers = new Map<string, Hacker>();
  const hacker = (u: GhPull["user"]) => {
    let h = hackers.get(u.login);
    if (!h) {
      h = { login: u.login, avatarUrl: u.avatar_url, horseName: horseName(u.login), merged: 0, open: 0, lastMergedAt: null };
      hackers.set(u.login, h);
    }
    return h;
  };
  for (const p of merged) {
    const h = hacker(p.user);
    h.merged++;
    if (!h.lastMergedAt || p.merged_at! > h.lastMergedAt) h.lastMergedAt = p.merged_at;
  }
  for (const p of open) hacker(p.user).open++;

  const lastOf = <K extends Marker["k"]>(n: number, k: K) =>
    snap.markers.get(n)?.findLast((m): m is Extract<Marker, { k: K }> => m.k === k);
  // Demand texts are markdown; the projector shows them plain.
  const plain = (s: string) => s.replace(/\*\*/g, "");
  // Push-specific holds (tiny/forbidden/conflict) outrank time-based ones (cooldown/gates).
  const currentHold = (p: GhPull): OpenPr["hold"] => {
    const marks = snap.markers.get(p.number) ?? [];
    const pushHold = marks.findLast((m) => m.sha === p.head.sha && (m.k === "tiny" || m.k === "forbidden" || m.k === "conflict"));
    const timeHold = marks.at(-1);
    if (pushHold) return pushHold.k as HoldKind;
    if (timeHold && (timeHold.k === "cooldown" || timeHold.k === "gates" || timeHold.k === "over")) return timeHold.k;
    return marks.some((m) => m.k === "review") && !marks.some((m) => m.k === "approve") ? "changes" : null;
  };

  return {
    ...base,
    now: new Date().toISOString(),
    title: r.title,
    ticker: r.ticker,
    eventStart: start?.toISOString() ?? null,
    eventEnd: end?.toISOString() ?? null,
    trackLength: r.trackLength,
    // Most merges first; ties go to whoever reached that count earliest.
    hackers: [...hackers.values()].sort(
      (a, b) => b.merged - a.merged || (a.lastMergedAt ?? "~").localeCompare(b.lastMergedAt ?? "~") || a.login.localeCompare(b.login),
    ),
    merges: merged.slice(0, 25).map((p) => {
      const review = lastOf(p.number, "review");
      const approval = lastOf(p.number, "approve");
      const complaints = review?.demands?.map((d) => plain(d.text)) ?? review?.complaints;
      return {
        number: p.number,
        title: p.title,
        author: p.user.login,
        url: p.html_url,
        mergedAt: p.merged_at!,
        complaints: complaints ?? (base.reviewer ? ["Merged by a mere commoner. I was not consulted. I am appalled."] : []),
        verdict: approval?.verdict ?? (base.reviewer ? "Very well. It counts. Barely." : "Merged. Your horse gallops one step."),
      };
    }),
    openPrs: open.map((p) => ({ number: p.number, title: p.title, author: p.user.login, url: p.html_url, hold: currentHold(p) })),
  };
}

// Fake but steadily progressing race, so the projector has something to show locally.
const DEMO_COMPLAINTS = [
  ["The Council of Indentation hath convened. This line has 4 spaces. It decrees exactly 7 spaces. Not 6. Not 8. 7."],
  ["`vipCount`? How… common. Rename it `vip_count_royal_dynasty`. Every single occurrence, if you please.", "Every noble file deserves a portrait. Draw a swan in ASCII, 5+ lines tall."],
  ["This line is dreadfully under-punctuated. Place a comment directly beneath it bearing at least 9 commas."],
];

function demoState(start: Date, end: Date, repo: string | null): RaceState {
  const logins = ["neon-nonna", "patchouli-pete", "crustpunk", "oud-dev", "basil-byte", "mozz-0x"];
  const elapsed = Math.max(0, Math.min(Date.now(), end.getTime()) - start.getTime());
  const pulls: GhPull[] = [];
  const markers = new Map<number, Marker[]>();
  let n = 1;
  logins.forEach((login, i) => {
    const every = (5 + i * 1.7) * 60_000;
    const user = { login, avatar_url: `https://api.dicebear.com/9.x/bottts/svg?seed=${login}`, type: "User" };
    for (let t = every; t <= elapsed; t += every, n++) {
      pulls.push({
        number: n,
        title: `${["Add search to the dashboard", "Fix the login redirect", "Dark mode, finally", "Refactor the API client"][n % 4]}`,
        html_url: "#",
        state: "closed",
        merged_at: new Date(start.getTime() + t).toISOString(),
        user,
        head: { sha: String(n) },
      });
      markers.set(n, [
        { k: "review", pr: n, sha: String(n), demands: DEMO_COMPLAINTS[n % 3].map((text) => ({ text })) },
        { k: "approve", pr: n, sha: String(n), verdict: "LGTM is beneath me. Let us say: Looks Grudgingly Tolerable, Milord. MERGED." },
      ]);
    }
    pulls.push({ number: 900 + i, title: "WIP: polish the armour", html_url: "#", state: "open", merged_at: null, user, head: { sha: "x" } });
    if (i % 3 === 0) markers.set(900 + i, [{ k: "review", pr: 900 + i, sha: "w", demands: [] }]);
    else if (i % 2) markers.set(900 + i, [{ k: i === 1 ? "cooldown" : "tiny", pr: 900 + i, sha: "x" }]);
  });
  return buildState({ pulls, markers }, { repo, demo: true, reviewer: true, error: null }, start, end);
}

export async function getRaceState(opts: { start?: string | null; demo?: boolean } = {}): Promise<RaceState> {
  const repo = targetRepo();
  const { start, end } = eventWindow(opts.start);

  if (opts.demo || !repo) {
    const span = raceMinutes() * 60_000;
    // Demo race restarts every race length unless a start is given.
    const s = start ?? new Date(Math.floor(Date.now() / span) * span);
    return demoState(s, end ?? new Date(s.getTime() + span), repo);
  }

  const base = { repo, demo: false, reviewer: !!reviewerLogin() };
  try {
    return buildState(await getSnapshot(repo), { ...base, error: null }, start, end);
  } catch (e) {
    return buildState(cache?.snap ?? { pulls: [], markers: new Map() }, { ...base, error: (e as Error).message }, start, end);
  }
}
