import { redirect } from "next/navigation";

// Sign in lives on /profile now; keep old links working.
export default function SignIn() {
  redirect("/profile");
}
