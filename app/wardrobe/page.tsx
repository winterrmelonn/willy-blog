import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import Wardrobe from "@/components/Wardrobe";
import { loadWardrobe } from "./actions";
import "./wardrobe.css";

// Archivo's width axis gives the wide display type (font-stretch: 125%)
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--ri-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--ri-mono" });

export const metadata: Metadata = { title: "Rudimentary Intelligence · willy.work" };

// Rudimentary Intelligence: Willy's wardrobe inventory. Anyone can open the page, but only an admin
// (ADMIN_EMAILS in lib/auth.ts) gets past its login; signing in there is the same as on /profile.
export default async function WardrobePage() {
    const initial = await loadWardrobe(); // null unless an admin is already signed in
    return <Wardrobe className={`${archivo.variable} ${mono.variable}`} initial={initial} />;
}
