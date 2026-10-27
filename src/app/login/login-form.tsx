"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export function LoginForm({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        signup ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
            ...(signup ? { confirmPassword: form.get("confirmPassword") } : {}),
          }),
          cache: "no-store",
        },
      );
      if (!response.ok) {
        if (response.status === 429) {
          const seconds = Number(response.headers.get("Retry-After"));
          setError(
            `Too many attempts. Please try again in ${Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds / 60) : 15} minutes.`,
          );
        } else if (response.status === 409)
          setError(
            "An account could not be created with these details. Try signing in.",
          );
        else if (response.status === 401)
          setError("The email or password is incorrect.");
        else if (response.status === 400)
          setError(
            signup
              ? "Use a valid email and matching passwords of 12–128 characters."
              : "Enter a valid email address and password.",
          );
        else
          setError(
            signup
              ? "Account creation is temporarily unavailable. Please try again later."
              : "Sign-in is temporarily unavailable. Please try again later.",
          );
        return;
      }
      router.replace(signup ? "/login?created=1" : "/workspace");
      router.refresh();
    } catch {
      setError("We couldn’t connect. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={styles.form} onSubmit={submit} aria-busy={busy}>
      {error && (
        <div className={styles.error} role="alert" id="login-error">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="Enter your email address"
          required
          maxLength={254}
          disabled={busy}
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <div className={styles.passwordField}>
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={signup ? 12 : undefined}
            placeholder="Enter your password"
            required
            maxLength={128}
            disabled={busy}
            aria-describedby={error ? "login-error" : undefined}
          />
          <button
            type="button"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      {signup && (
        <div>
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            disabled={busy}
          />
          <p>
            Use 12–128 characters. After creating your account, sign in to
            continue.
          </p>
        </div>
      )}
      <button className={styles.submit} type="submit" disabled={busy}>
        {busy
          ? signup
            ? "Creating account…"
            : "Signing in…"
          : signup
            ? "Create account"
            : "Sign in"}
      </button>
      <p className={styles.sharedNote}>
        You and your partner share this workspace.
      </p>
    </form>
  );
}
