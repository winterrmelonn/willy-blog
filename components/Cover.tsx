// A cover image with the title and date in its top left, like a class card on Canvas. Without an image,
// just the title and date.
export default function Cover({ image, title, sub, big = false, className = "" }: {
    image?: string; title: React.ReactNode; sub?: string; big?: boolean; className?: string;
}) {
    if (!image) return (
        <div className={`flex flex-wrap items-baseline gap-x-2 ${className}`}>
            <div className={big ? "text-4xl font-bold" : "text-xl font-bold"}>{title}</div>
            {sub && <span className="text-sm text-zinc-500">{sub}</span>}
        </div>
    );
    return (
        <div className={`relative overflow-hidden bg-zinc-200 dark:bg-zinc-800 ${big ? "aspect-[5/2] rounded-2xl" : "aspect-[3/1]"} ${className}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/images/${image}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {/* a soft shade behind the words so they read on any photo */}
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgb(0_0_0/0.55),rgb(0_0_0/0.15)_45%,transparent_70%)]" />
            <div className={`absolute left-4 top-3 right-14 text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.5)] ${big ? "left-6 top-5" : ""}`}>
                <div className={big ? "text-4xl font-bold" : "text-xl font-bold"}>{title}</div>
                {sub && <div className="text-sm opacity-90">{sub}</div>}
            </div>
        </div>
    );
}
