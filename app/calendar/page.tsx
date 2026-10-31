import { connection } from "next/server";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function Calendar() {
  await connection(); // otherwise "today" gets frozen at build time
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // blanks before the 1st so it lands under the right weekday
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (<main>
    <div className="max-w-2xl mx-auto">
          <h1 className="mt-3 text-4xl font-bold">
          {today.toLocaleString("en-US", { month: "long" })} {year}
        </h1>
          <div className="my-3 grid grid-cols-7 gap-1 text-center text-sm">
            {DAYS.map((d) => (
              <div key={d} className="py-1 text-zinc-500">{d}</div>
            ))}
            {cells.map((day, i) => (
              <div
                key={i}
                className={day ? `rounded-lg border py-3 ${day === today.getDate() ? "border-black dark:border-white font-bold" : "border-zinc-200 dark:border-zinc-800"}` : ""}
              >
                {day}
              </div>
            ))}
          </div>
    </div>
  </main>
);
}
