import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import dbConnect from "./mongoose";

export const ADMIN_EMAILS = ["willvtran@gmail.com", "asherwandenreich@gmail.com"];

export async function initAuth() {
    const mongooseInstance = await dbConnect();
    const client = mongooseInstance.connection.getClient();
    const instance = betterAuth({
        database: mongodbAdapter(client.db()),
        emailAndPassword: { enabled: true },
        // stay signed in on this browser for 30 days, renewed whenever you visit
        session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
        // Admin is decided by email and emails aren't verified, so nobody may sign up with an admin's email:
        // otherwise whoever registers it first becomes an admin. To add an admin, have them sign up first,
        // then put their email in ADMIN_EMAILS.
        databaseHooks: {
            user: { create: { before: async (user) => { if (ADMIN_EMAILS.includes(user.email.toLowerCase())) return false; } } },
        },
});
    
        return instance;
    }