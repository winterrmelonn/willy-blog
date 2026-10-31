// Reads tasks from Todoist (API v1) with the token in TODOIST_API_TOKEN. Server-only: never import this
// from a "use client" file, or the token would be sent to the browser.

type Task = { content: string; due: { date: string } | null };
type Page = { results: Task[]; next_cursor: string | null };

// Turns Todoist's markdown links "[text](url)" into just "text".
const plain = (content: string) => content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

// Every active task that has a due date, grouped by day ("YYYY-MM-DD").
// ponytail: fetched fresh on every visit; add caching if the page gets real traffic (Todoist allows ~1000 requests / 15 min).
export async function tasksByDay(): Promise<Map<string, string[]>> {
    const days = new Map<string, string[]>();
    const token = process.env.TODOIST_API_TOKEN;
    if (!token) return days;

    try {
        let cursor: string | null = null;
        do {
            const url = new URL("https://api.todoist.com/api/v1/tasks");
            url.searchParams.set("limit", "200");
            if (cursor) url.searchParams.set("cursor", cursor);
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(`Todoist answered ${res.status}`);
            const page: Page = await res.json();
            for (const task of page.results) {
                if (!task.due) continue;
                const day = task.due.date.slice(0, 10); // "2026-11-03" or "2026-11-03T15:00:00" → the day
                days.set(day, [...(days.get(day) ?? []), plain(task.content)]);
            }
            cursor = page.next_cursor;
        } while (cursor);
    } catch (error) {
        console.error("Couldn't load Todoist tasks:", error); // the calendar still shows, just without tasks
    }
    return days;
}
