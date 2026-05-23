"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const supabase = getBrowserSupabase();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (signUpError || !signUpData.user) {
      setLoading(false);
      setError(signUpError?.message ?? "Sign up failed.");
      return;
    }

    // If email confirmation is OFF, we have a session and can create the restaurant.
    if (signUpData.session) {
      const { error: rError } = await supabase
        .from("restaurants")
        .insert({
          name: restaurantName,
          owner_id: signUpData.user.id,
          booking_policy: "request",
        });
      if (rError) {
        setLoading(false);
        setError(rError.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } else {
      setLoading(false);
      setError(
        "Check your email to confirm your account. After confirming, sign in and we'll set up your restaurant.",
      );
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Create restaurant account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get your restaurant set up in minutes.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Your name">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Restaurant name">
            <input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input"
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create account"}
        </button>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--color-border);
          background: var(--color-background);
          padding: 0.5rem 0.75rem;
          outline: none;
        }
        .input:focus {
          box-shadow: 0 0 0 2px var(--color-primary);
        }
      `}</style>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
