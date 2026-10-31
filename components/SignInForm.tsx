"use client";

import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";

interface UserType {
    email: string;
    name: string;
    password: string;
    signUp: boolean;
}

const field = "w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2";

// Sign in / sign up, shown on /profile when nobody is signed in.
function SignInForm() {
    const [user, setUser] = useState<UserType>({
        email: "",
        name: "",
        password: "",
        signUp: false,
    });
    const [error, setError] = useState("");
    const router = useRouter();

    async function handleSignIn(e: React.SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");
        const callbacks = {
            onSuccess: () => router.refresh(), // re-render /profile, which now shows the welcome
            onError: (ctx: { error: { message: string } }) => setError(ctx.error.message),
        };
        if (user.signUp) {
            await authClient.signUp.email({ ...user }, callbacks);
        } else {
            // rememberMe keeps the login after the browser closes
            await authClient.signIn.email({ email: user.email, password: user.password, rememberMe: true }, callbacks);
        }
    }

    return (
            <form onSubmit={handleSignIn} className="max-w-sm mx-auto flex flex-col gap-3">
                <h1 className="mt-10 mb-3 text-4xl font-bold">{user.signUp ? "Sign up" : "Sign in"}</h1>
                <input
                    type="email"
                    placeholder="Email"
                    aria-label="Email"
                    autoComplete="email"
                    className={field}
                    value={user.email}
                    onChange={(e) => setUser({ ...user, email: e.target.value })}
                />
                {user.signUp && (
                    <input
                        placeholder="Name"
                        aria-label="Name"
                        className={field}
                        value={user.name}
                        onChange={(e) => setUser({ ...user, name: e.target.value })}
                    />
                )}
                <PasswordInput
                    placeholder="Password"
                    className={field}
                    value={user.password}
                    onChange={(password) => setUser({ ...user, password })}
                />
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <button
                    type="submit"
                    className="rounded-full px-5 py-2 bg-black dark:bg-white text-white dark:text-black hover:opacity-80"
                >
                    {user.signUp ? "Create account" : "Sign in"}
                </button>
                <button
                    type="button"
                    className="text-sm text-zinc-500 hover:underline"
                    onClick={() => setUser({ ...user, signUp: !user.signUp })}
                >
                    {user.signUp ? "Have an account? Sign in" : "Need an account? Sign up"}
                </button>
            </form>
    );
}

export default SignInForm;
