import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import Rustbreeder from "@/components/Rustbreeder";
import "./rustbreeder.css";

// same type as the wardrobe: Archivo's width axis for the wide display, JetBrains Mono for the terminal text
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--rb-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--rb-mono" });

export const metadata: Metadata = { title: "Rudimentary Intelligence – Rustbreeder · willy.work" };

export default function RustbreederPage() {
    return <Rustbreeder className={`${archivo.variable} ${mono.variable}`} />;
}
