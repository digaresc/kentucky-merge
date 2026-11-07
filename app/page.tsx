import Hippodrome from "@/components/Hippodrome";
import { getRaceState } from "@/lib/race";

// URL overrides (?start=, ?demo=1) only work off production, so nobody can fiddle with the projector.
const devOnly = process.env.VERCEL_ENV !== "production";

// Always render at request time: without this, production (which ignores the URL) would be
// prerendered at build time and the projector would start from a stale or demo snapshot.
export const dynamic = "force-dynamic";

export default async function RacePage({ searchParams }: PageProps<"/">) {
  const params = devOnly ? await searchParams : {};
  const start = typeof params.start === "string" ? params.start : null;
  const demo = params.demo === "1";
  const query = new URLSearchParams({ ...(start && { start }), ...(demo && { demo: "1" }) }).toString();
  const initial = await getRaceState({ start, demo });
  return <Hippodrome initial={initial} query={query ? `?${query}` : ""} />;
}
