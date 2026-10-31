import { ViewTransition } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { tasksByDay } from "@/lib/todoist";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The old month slides out and fades while the new one slides in from the side you moved toward
// (animations in globals.css). Other navigations, like the browser's back button, just swap.
const SLIDE = {
  enter: { "month-next": "month-next", "month-prev": "month-prev", default: "none" },
  exit: { "month-next": "month-next", "month-prev": "month-prev", default: "none" },
  default: "none",
} as const;

// ‹ / › in the top right. Only last month, this month and next month are reachable.
// The arrow tags its navigation "month-next" or "month-prev" so the month slides the right way.
function MonthArrow({ to, label, path, type }: { to: number | null; label: string; path: string; type: string }) {
  const look = "flex h-7 w-7 items-center justify-center rounded-full";
  const icon = (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return to === null ? (
    <span aria-hidden className={`${look} text-zinc-300 dark:text-zinc-700`}>{icon}</span>
  ) : (
    <Link
      href={to === 0 ? "/calendar" : `/calendar?month=${to}`}
      aria-label={label}
      transitionTypes={[type]}
      className={`${look} text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100`}
    >
      {icon}
    </Link>
  );
}

export default async function Calendar({ searchParams }: PageProps<"/calendar">) {
  await connection(); // render on every visit, so "today" and the Todoist tasks are always current
  const tasks = await tasksByDay(); // public: everyone sees the tasks

  // ?month=-1 is last month, ?month=1 is next month; anything else is this month
  const asked = Number((await searchParams).month);
  const offset = asked === -1 || asked === 1 ? asked : 0;

  const today = new Date();
  const shown = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const firstDay = shown.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isToday = (day: number) => offset === 0 && day === today.getDate();

  // blanks before the 1st so it lands under the right weekday, and after the last day to finish the week
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const key = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return (<main className="flex-1 flex flex-col px-4 pb-4">
          <div className="mt-3 mb-2 flex items-center justify-between">
            <ViewTransition key={offset} {...SLIDE}>
              <h1 className="text-2xl font-bold">
                {shown.toLocaleString("en-US", { month: "long" })} {year}
              </h1>
            </ViewTransition>
            <div className="flex items-center gap-1">
              <MonthArrow to={offset > -1 ? offset - 1 : null} label="Previous month" path="M10 3 5 8l5 5" type="month-prev" />
              <MonthArrow to={offset < 1 ? offset + 1 : null} label="Next month" path="M6 3l5 5-5 5" type="month-next" />
            </div>
          </div>
          {/* fills the rest of the screen: one row for weekday names, then equal-height weeks */}
          <ViewTransition key={offset} {...SLIDE}>
          <div
            className="flex-1 grid grid-cols-7 gap-1 text-sm"
            style={{ gridTemplateRows: `auto repeat(${cells.length / 7}, minmax(0, 1fr))` }}
          >
            {DAYS.map((d) => (
              <div key={d} className="px-1.5 pb-1 text-xs text-zinc-500">{d}</div>
            ))}
            {cells.map((day, i) => (
              <div
                key={i}
                className={day ? `min-h-0 overflow-hidden rounded-lg border p-1.5 ${isToday(day) ? "border-black dark:border-white" : "border-zinc-200 dark:border-zinc-800"}` : ""}
              >
                {day && (<>
                  <div className={`text-xs ${isToday(day) ? "font-bold" : "text-zinc-500"}`}>{day}</div>
                  <ul className="mt-0.5 flex flex-col gap-0.5 text-xs leading-snug">
                    {(tasks.get(key(day)) ?? []).map((task, j) => (
                      // the bullet is its own dot, so cutting long tasks off with "…" can't hide it
                      <li key={j} className="flex items-baseline gap-1.5">
                        <span aria-hidden className="h-1 w-1 shrink-0 translate-y-[-0.15em] rounded-full bg-current" />
                        <span className="truncate">{task}</span>
                      </li>
                    ))}
                  </ul>
                </>)}
              </div>
            ))}
          </div>
          </ViewTransition>
  </main>
);
}
