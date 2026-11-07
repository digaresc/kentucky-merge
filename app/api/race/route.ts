import { after } from "next/server";
import { getRaceState } from "@/lib/race";

// URL overrides (?start=, ?demo=1) only work off production, so nobody can fiddle with the projector.
const devOnly = process.env.VERCEL_ENV !== "production";

// Projector polls double as the reviewer's clock (e.g. Sir Nitpicksalot's /api/tick).
let lastTick = 0;
function tickReviewer() {
  const url = process.env.REVIEWER_TICK_URL;
  if (!url || Date.now() - lastTick < 20_000) return;
  lastTick = Date.now();
  after(() => fetch(url, { method: "POST", cache: "no-store" }).catch(() => {}));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const demo = devOnly && params.get("demo") === "1";
  const state = await getRaceState({ start: devOnly ? params.get("start") : null, demo });
  if (!demo) tickReviewer();
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
