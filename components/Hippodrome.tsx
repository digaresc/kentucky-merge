"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Hacker, Merge, OpenPr, RaceState } from "@/lib/race";
import { ORDERS, REVIEWER_NAME, REVIEWER_TITLE } from "@/lib/reviewer";
import { HORSE_FRAMES, HORSE_WIDTH_CH, KNIGHT_FRAMES } from "./ascii";

const POLL_MS = 8_000;


const HOLD_LABEL: Record<NonNullable<OpenPr["hold"]>, string> = {
  tiny: "🔍 too small",
  cooldown: "⏳ cooldown",
  forbidden: "🚫 touched .github",
  conflict: "⚔ conflict",
  gates: "🚧 gates closed",
  over: "🏁 too late",
  changes: "🔧 changes requested",
};

function hue(login: string) {
  let h = 0;
  for (const c of login) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function useRaceState(initial: RaceState, query: string) {
  const [state, setState] = useState(initial);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/race${query}`, { cache: "no-store" });
        if (res.ok && alive) setState(await res.json());
      } catch {
        // Keep showing the last good state; the projector must never go blank.
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [query]);
  return state;
}

function useNow(serverNow: string) {
  const skew = useMemo(() => new Date(serverNow).getTime() - Date.now(), [serverNow]);
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + skew), 250);
    return () => clearInterval(id);
  }, [skew]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");
function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function Countdown({ state }: { state: RaceState }) {
  const now = useNow(state.now);
  if (!state.eventStart || !state.eventEnd) {
    return (
      <div className="countdown standby">
        <span className="label">STANDBY</span>
        <span className="clock">01:20:00</span>
      </div>
    );
  }
  const start = new Date(state.eventStart).getTime();
  const end = new Date(state.eventEnd).getTime();
  if (now < start) {
    return (
      <div className="countdown">
        <span className="label">GATES OPEN IN</span>
        <span className="clock">{hms(start - now)}</span>
      </div>
    );
  }
  if (now >= end) {
    return (
      <div className="countdown over">
        <span className="label">RACE OVER</span>
        <span className="clock">00:00:00</span>
      </div>
    );
  }
  const left = end - now;
  return (
    <div className={`countdown ${left < 5 * 60_000 ? "final" : ""}`}>
      <span className="label">TIME LEFT</span>
      <span className="clock">{hms(left)}</span>
    </div>
  );
}

function Lane({ hacker, rank, trackLength, galloping }: { hacker: Hacker; rank: number; trackLength: number; galloping: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!galloping) return;
    const id = setInterval(() => setFrame((f) => 1 - f), 140);
    return () => clearInterval(id);
  }, [galloping]);

  const progress = Math.min(hacker.merged, trackLength) / trackLength;
  const finished = hacker.merged >= trackLength;
  return (
    <div className={`lane ${galloping ? "galloping" : ""} ${finished ? "finished" : ""}`} style={{ "--h": hue(hacker.login) } as React.CSSProperties}>
      <div className="lane-label">
        <span className="rank">{rank}</span>
        <span className="who">@{hacker.login}</span>
        <span className="horse-name">{hacker.horseName}</span>
        <span className="steps">{hacker.merged}</span>
      </div>
      <div className="lane-track">
        <div className="ticks" aria-hidden>
          {Array.from({ length: trackLength + 1 }, (_, i) => (
            <span key={i} style={{ left: `calc((100% - ${HORSE_WIDTH_CH}ch) * ${i / trackLength} + ${HORSE_WIDTH_CH - 2}ch)` }}>
              {i === trackLength ? "🏁" : "┆"}
            </span>
          ))}
        </div>
        <pre className="horse" style={{ left: `calc((100% - ${HORSE_WIDTH_CH}ch) * ${progress})` }}>
          {HORSE_FRAMES[galloping ? frame : 0].join("\n")}
          {finished && <span className="crown">👑</span>}
        </pre>
      </div>
    </div>
  );
}

function Leaderboard({ hackers }: { hackers: Hacker[] }) {
  const max = Math.max(1, ...hackers.map((h) => h.merged));
  return (
    <section className="panel leaderboard">
      <h2>LEADERBOARD</h2>
      {hackers.length === 0 && <p className="muted">No riders yet. Open a PR to enter the race!</p>}
      <ol>
        {hackers.slice(0, 8).map((h, i) => (
          <li key={h.login} style={{ "--h": hue(h.login) } as React.CSSProperties}>
            <span className="pos">{["🥇", "🥈", "🥉"][i] ?? i + 1}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.avatarUrl} alt="" width={28} height={28} />
            <span className="who">@{h.login}</span>
            <span className="bar">
              <span style={{ width: `${(h.merged / max) * 100}%` }} />
            </span>
            <span className="count">{h.merged}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (n >= text.length) {
      done.current?.();
      return;
    }
    const id = setTimeout(() => setN((x) => x + 1), 22);
    return () => clearTimeout(id);
  }, [n, text]);
  return <>{text.slice(0, n)}<span className="caret">▌</span></>;
}

// With a reviewer bot, the knight acts out each review; without one, this is a plain "latest merge" card.
function Monster({ merge, live, reviewer, onFinished }: { merge: Merge | null; live: boolean; reviewer: boolean; onFinished: () => void }) {
  // stage: index of the complaint being typed; complaints.length = verdict; +1 = stamped
  const [stage, setStage] = useState(live ? 0 : Infinity);
  const [mouth, setMouth] = useState(false);
  const total = merge ? merge.complaints.length : 0;
  const talking = live && stage <= total;

  useEffect(() => {
    if (!talking) return;
    const id = setInterval(() => setMouth((m) => !m), 160);
    return () => clearInterval(id);
  }, [talking]);

  useEffect(() => {
    if (live && stage === total + 1) {
      const id = setTimeout(onFinished, 6_000);
      return () => clearTimeout(id);
    }
  }, [live, stage, total, onFinished]);

  const frame = talking ? (mouth ? KNIGHT_FRAMES.talkA : KNIGHT_FRAMES.talkB) : KNIGHT_FRAMES.idle;
  const next = () => setStage((s) => s + 1);

  return (
    <section className={`panel monster ${talking ? "talking" : ""}`}>
      <h2>{reviewer ? "CODE REVIEW" : "LATEST MERGE"}</h2>
      {reviewer && (
        <div className="monster-head">
          <pre className="monster-art">{frame.join("\n")}</pre>
          <div>
            <div className="monster-name">{REVIEWER_NAME}</div>
            <div className="monster-title">{REVIEWER_TITLE}</div>
            <div className="certs">
              {ORDERS.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      )}
      {merge ? (
        <div className="bubble">
          <div className="pr">
            #{merge.number} by <b>@{merge.author}</b> — {merge.title}
          </div>
          <ul>
            {merge.complaints.map((c, i) =>
              i < stage ? (
                <li key={i}>{c}</li>
              ) : i === stage ? (
                <li key={i}>
                  <Typewriter text={c} onDone={next} />
                </li>
              ) : null,
            )}
          </ul>
          {stage >= total && (
            <p className="verdict">
              {stage === total ? <Typewriter text={merge.verdict} onDone={next} /> : merge.verdict}
            </p>
          )}
          {stage > total && <div className="stamp">{reviewer ? "BY ROYAL DECREE" : "MERGED"}</div>}
        </div>
      ) : (
        <div className="bubble muted">{reviewer ? "Awaiting thy pull requests, milord…" : "Waiting for the first merge…"}</div>
      )}
    </section>
  );
}

function ago(iso: string, now: string) {
  const s = Math.max(0, Math.round((new Date(now).getTime() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
}

// The three most recent reviews on an endless vertical reel; a new merge restarts it with the fresh one on top.
function ReviewFeed({ merges, now }: { merges: Merge[]; now: string }) {
  const items = merges.slice(0, 3);
  if (items.length === 0) return null;
  const reel = items.length > 1 ? [...items, ...items] : items;
  return (
    <section className="panel feed">
      <h2>LATEST REVIEWS</h2>
      <div className="feed-window">
        <div key={items.map((m) => m.number).join()} className={`feed-reel ${items.length > 1 ? "rolling" : ""}`}>
          {reel.map((m, i) => (
            <article key={`${m.number}-${i}`} className={i === 0 ? "fresh" : ""} style={{ "--h": hue(m.author) } as React.CSSProperties}>
              <header>
                <span>#{m.number}</span> <b>@{m.author}</b> <time>{ago(m.mergedAt, now)}</time>
              </header>
              <p className="feed-title">{m.title}</p>
              {m.complaints[0] && <p className="feed-complaint">“{m.complaints[0]}”</p>}
              <p className="feed-verdict">✔ {m.verdict}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Hippodrome({ initial, query }: { initial: RaceState; query: string }) {
  const state = useRaceState(initial, query);

  // Merges seen so far; anything new is queued for the review panel and makes its horse gallop.
  const seen = useRef(new Set(initial.merges.map((m) => m.number)));
  const [queue, setQueue] = useState<Merge[]>([]);
  const [current, setCurrent] = useState<{ merge: Merge | null; live: boolean }>({
    merge: initial.merges[0] ?? null,
    live: false,
  });
  const [galloping, setGalloping] = useState<Record<string, number>>({});

  useEffect(() => {
    const fresh = state.merges.filter((m) => !seen.current.has(m.number)).reverse();
    if (fresh.length === 0) return;
    fresh.forEach((m) => seen.current.add(m.number));
    setQueue((q) => [...q, ...fresh]);
    const until = Date.now() + 4_000;
    setGalloping((g) => ({ ...g, ...Object.fromEntries(fresh.map((m) => [m.author, until])) }));
  }, [state.merges]);

  useEffect(() => {
    const id = setInterval(() => {
      setGalloping((g) => {
        const live = Object.fromEntries(Object.entries(g).filter(([, until]) => until > Date.now()));
        return Object.keys(live).length === Object.keys(g).length ? g : live;
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Feed the review panel one PR at a time.
  useEffect(() => {
    if (queue.length > 0 && !current.live) {
      setCurrent({ merge: queue[0], live: true });
      setQueue((q) => q.slice(1));
    }
  }, [queue, current.live]);

  const finishReview = useMemo(() => () => setCurrent((c) => ({ ...c, live: false })), []);

  const totalMerged = state.hackers.reduce((n, h) => n + h.merged, 0);
  const lanes = state.hackers.slice(0, 14);

  return (
    <main className="hippo" style={{ "--lanes": Math.max(lanes.length, 4) } as React.CSSProperties}>
      <header className="hippo-header">
        <div>
          <h1 className="marquee">{state.title}</h1>
          <p className="tagline">
            ★ every merged PR = one step ★{" "}
            {state.repo && <code>github.com/{state.repo}</code>}
            {state.demo && <span className="demo">DEMO MODE</span>}
            {state.error && <span className="err" title={state.error}>⚠ SIGNAL LOST — RECONNECTING</span>}
          </p>
        </div>
        <div className="stats">
          <span>
            <b>{state.hackers.length}</b> riders
          </span>
          <span>
            <b>{totalMerged}</b> merged
          </span>
          <span>
            <b>{state.openPrs.length}</b> in review
          </span>
        </div>
        <Countdown state={state} />
      </header>

      <section className="track">
        {lanes.length === 0 && (
          <div className="empty">
            <pre>{HORSE_FRAMES[0].join("\n")}</pre>
            <p>The ring awaits its first rider…</p>
          </div>
        )}
        {lanes.map((h, i) => (
          <Lane key={h.login} hacker={h} rank={i + 1} trackLength={state.trackLength} galloping={!!galloping[h.login]} />
        ))}
        {state.hackers.length > lanes.length && <p className="muted more">+{state.hackers.length - lanes.length} more riders in the stables</p>}
      </section>

      <aside className="side">
        <Leaderboard hackers={state.hackers} />
        <Monster key={`${current.merge?.number}-${current.live}`} merge={current.merge} live={current.live} reviewer={state.reviewer} onFinished={finishReview} />
        <ReviewFeed merges={state.merges} now={state.now} />
      </aside>

      <footer className="ticker">
        <span className="ticker-label">LIVE</span>
        <div className="ticker-track">
          <div className="ticker-content">
            {state.ticker && (
              <>
                <b className="announce">{state.ticker}</b> ✦{" "}
              </>
            )}
            {state.openPrs.length === 0
              ? "No open PRs. The track is quiet… for now. 🐎 ".repeat(2)
              : state.openPrs.map((p, i) => (
                  <span key={i}>
                    #{p.number} @{p.author} “{p.title}”{p.hold && <b className="hold"> {HOLD_LABEL[p.hold]}</b>} ✦{" "}
                  </span>
                ))}
            {state.ticker && <b className="announce">{state.ticker}</b>}
          </div>
        </div>
      </footer>
    </main>
  );
}
