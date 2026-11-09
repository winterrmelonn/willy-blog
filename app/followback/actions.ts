"use server";

import { headers } from "next/headers";
import { initAuth, ADMIN_EMAILS } from "@/lib/auth";
import dbConnect from "@/lib/mongoose";
import FollowSnapshot from "@/lib/FollowSnapshotModel";
import { USERNAME, type Snapshot } from "@/lib/followback";

async function isAdmin() {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    return !!session && ADMIN_EMAILS.includes(session.user.email);
}

// The follower list from the last export loaded, or null if there isn't one (or the visitor isn't an admin)
export async function loadSnapshot(): Promise<Snapshot | null> {
    if (!(await isAdmin())) return null;
    await dbConnect();
    const doc = await FollowSnapshot.findOne().lean<{ followers: string[]; updatedAt: Date }>();
    return doc && { date: new Date(doc.updatedAt).getTime(), followers: doc.followers };
}

// Replaces the saved follower list. Returns the new snapshot, or null when it wasn't saved.
export async function saveSnapshot(followers: unknown): Promise<Snapshot | null> {
    if (!(await isAdmin())) return null;
    if (!Array.isArray(followers) || followers.length > 200_000) return null;
    const clean = [...new Set(followers.filter((u): u is string => typeof u === "string" && USERNAME.test(u)))];
    await dbConnect();
    const doc = await FollowSnapshot.findOneAndUpdate({}, { followers: clean }, { upsert: true, new: true }).lean<{ updatedAt: Date }>();
    return { date: new Date(doc!.updatedAt).getTime(), followers: clean };
}
