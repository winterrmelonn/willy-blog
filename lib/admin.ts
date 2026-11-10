import { headers } from "next/headers";
import { initAuth, ADMIN_EMAILS } from "./auth";

// The signed-in admin's session, or null for everyone else
export async function adminSession() {
    const session = await (await initAuth()).api.getSession({ headers: await headers() });
    return session && ADMIN_EMAILS.includes(session.user.email) ? session : null;
}
