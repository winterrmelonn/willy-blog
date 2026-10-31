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
});
    
        return instance;
    }