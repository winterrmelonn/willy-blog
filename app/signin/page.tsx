"use client";

import { authClient } from "@/lib/auth-client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";

interface UserType {
    email: string;
    name: string;
    password: string;
    signUp: boolean;
}

function Page() {
    const [user, setUser] = useState<UserType>({
        email: "",
        name: "",
        password: "",
        signUp: false,
    });
    const router = useRouter();

    async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (user.signUp) {
            await authClient.signUp.email(
                { ...user },
                { onSuccess: () => router.push("/") },
            );
        }else {
            await authClient.signIn.email(
                { email: user.email, password: user.password },
                { onSuccess: () => router.push("/post") },
            );
        };
    } 
    return (
        <form onSubmit={handleSignIn}>
            <h1>Sign In</h1>
            <input
                placeholder="Email"
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
            />
            {user.signUp && (
                <input
                    placeholder="Name"
                    value={user.name}
                    onChange={(e) => setUser({ ...user, name: e.target.value })}
                />
            )}
            <input
                placeholder="Password"
                type="password"
                value={user.password}
                onChange={(e) => setUser({ ...user, password: e.target.value })}
            />
            <label>
                <input
                    type="checkbox"
                    checked={user.signUp}
                    onChange={(e) => setUser({ ...user, signUp: e.target.checked })}
                />
                Sign Up
            </label>
            <button type="submit">Submit</button>
        </form>
    );
} 

export default Page;