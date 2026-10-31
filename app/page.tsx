import LilyBackground from "@/components/LilyBackground";
import HomeTitle from "@/components/HomeTitle";

export default function Home() {
  return (<main>
    <HomeTitle />
    {/* the background (lily field, Lily UI, or none) and its credit live here now */}
    <LilyBackground />
  </main>
);
}
