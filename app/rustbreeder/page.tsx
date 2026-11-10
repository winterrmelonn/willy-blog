import type { Metadata } from "next";
import Rustbreeder from "@/components/Rustbreeder";

export const metadata: Metadata = { title: "Rustbreeder · willy.work" };

export default function RustbreederPage() {
    return <Rustbreeder />;
}
