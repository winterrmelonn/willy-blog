// Follow-back check (/followback): reads Instagram's "Followers and following" export and compares the lists.
// Plain functions so lib/followback.test.ts can run them without a browser.

export type Entry = [username: string, timestamp: number]; // timestamp in seconds, 0 if the export has none
export type Snapshot = { date: number; followers: string[] }; // the last export loaded, saved in MongoDB

// Instagram usernames: letters, digits, periods and underscores, up to 30 characters
export const USERNAME = /^[a-z0-9._]{1,30}$/;

// followers_1.json, followers_2.json... and following.json (or the .html versions)
export const kindOf = (path: string) =>
    /(^|\/)followers(_\d+)?\.(json|html?)$/i.test(path) ? "followers"
    : /(^|\/)following\.(json|html?)$/i.test(path) ? "following" : null;

// Usernames and timestamps from one export file. JSON entries carry the name in `title` (newer exports) or
// string_list_data[0].value (older ones), with the profile link as a fallback.
export function parseExport(name: string, text: string): Map<string, number> {
    const out = new Map<string, number>();
    const tail = (href = "") => href.split("?")[0].split("/").filter(Boolean).pop() ?? "";
    const add = (u: string | undefined, t?: number) => {
        u = (u ?? "").trim().toLowerCase();
        if (USERNAME.test(u) && u !== "_u") out.set(u, t || out.get(u) || 0);
    };
    if (/\.html?$/i.test(name)) {
        const doc = new DOMParser().parseFromString(text, "text/html");
        doc.querySelectorAll<HTMLAnchorElement>('a[href*="instagram.com/"]').forEach((a) => add(a.textContent || tail(a.href)));
        return out;
    }
    type Item = { title?: string; string_list_data?: { href?: string; value?: string; timestamp?: number }[] };
    const data: unknown = JSON.parse(text);
    const list = (Array.isArray(data) ? data : Object.values(data as object).find(Array.isArray) ?? []) as Item[];
    for (const e of list) {
        const s = e.string_list_data?.[0] ?? {};
        add(e.title || s.value || tail(s.href), s.timestamp);
    }
    return out;
}

const byNewest = (a: Entry, b: Entry) => b[1] - a[1] || a[0].localeCompare(b[0]);

export function compare(followers: Map<string, number>, following: Map<string, number>, prev: Snapshot | null) {
    const was = new Set(prev?.followers);
    return {
        followers: followers.size,
        following: following.size,
        mutual: [...following.keys()].filter((u) => followers.has(u)).length,
        notBack: [...following].filter(([u]) => !followers.has(u)).sort(byNewest),
        fans: [...followers].filter(([u]) => !following.has(u)).sort(byNewest),
        lost: prev ? prev.followers.filter((u) => !followers.has(u)).sort().map((u): Entry => [u, 0]) : null,
        gained: prev ? [...followers].filter(([u]) => !was.has(u)).sort(byNewest) : null,
    };
}
export type Result = ReturnType<typeof compare>;
