"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import Project from "@/lib/ProjectModel";

export type ProjectType = { key: string; name: string; when: string; about: string; links: { label: string; href: string }[] };

const text = (s: unknown, max: number) => (typeof s === "string" ? s.slice(0, max) : "");
// only real web links: a "javascript:" link would run code for whoever clicks it
const webLink = (href: string) => { try { return ["http:", "https:"].includes(new URL(href).protocol); } catch { return false; } };

export async function saveProject(project: ProjectType) {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    if (!session || !ADMIN_EMAILS.includes(session.user.email)) throw new Error("Unauthorized");
    const key = text(project?.key, 100), name = text(project?.name, 200).trim();
    if (!key || !name) throw new Error("A project needs a name");
    const links = (Array.isArray(project.links) ? project.links : []).slice(0, 6)
        .map((l) => ({ label: text(l?.label, 60).trim(), href: text(l?.href, 500).trim() }))
        .filter((l) => l.label && l.href);
    if (links.some((l) => !webLink(l.href))) throw new Error("Links must start with http:// or https://");
    await dbConnect();
    await Project.findOneAndUpdate({ key }, { name, when: text(project.when, 200), about: text(project.about, 5000), links }, { upsert: true });
    revalidatePath("/projects");
}
