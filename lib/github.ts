// Read-only GitHub access. Kentucky Merge never writes anything.

export const targetRepo = (): string | null => process.env.TARGET_REPO ?? null;

export async function ghGet<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path.split("?")[0]}`);
  return (await res.json()) as T;
}

export interface GhUser {
  login: string;
  avatar_url: string;
  type: string;
}

export interface GhPull {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  draft?: boolean;
  merged_at: string | null;
  user: GhUser;
  head: { sha: string };
}

export interface GhComment {
  body: string;
  user: GhUser;
}
