"use client";

/**
 * Connection bar: lets the user point the app at an API gateway URL and
 * authenticate (sign in for a token, or paste one). All calls to protected
 * endpoints need a Bearer token, so this must be set before running anything.
 */

import { useEffect, useState } from "react";
import { getBaseUrl, hasToken, login, setBaseUrl, setToken } from "@/lib/api";

export default function ConnectionBar({ onChange }: { onChange: () => void }) {
  const [url, setUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"login" | "token">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUrl(getBaseUrl());
    setConnected(hasToken());
  }, []);

  const saveUrl = (v: string) => {
    setUrl(v);
    setBaseUrl(v);
  };

  const doLogin = async () => {
    setBusy(true);
    setError("");
    try {
      await login(email.trim(), password);
      setConnected(true);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const saveTokenValue = () => {
    setToken(tokenInput.trim());
    setConnected(hasToken());
    setError("");
    onChange();
  };

  const disconnect = () => {
    setToken("");
    setConnected(false);
    onChange();
  };

  const inputCls =
    "rounded-md border border-border bg-background px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-primary focus:outline-none";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${connected ? "bg-success" : "bg-warning"}`}
          />
          <span className="text-sm text-slate-300">
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>
        <label className="flex flex-1 items-center gap-2 text-sm text-slate-400">
          API URL
          <input
            className={`${inputCls} min-w-[220px] flex-1`}
            value={url}
            onChange={(e) => saveUrl(e.target.value)}
            placeholder="http://localhost:3001"
          />
        </label>
        {connected && (
          <button
            type="button"
            onClick={disconnect}
            className="rounded-md border border-border px-3 py-2 text-sm text-slate-300 hover:bg-elevated"
          >
            Sign out
          </button>
        )}
      </div>

      {!connected && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="mb-2 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={mode === "login" ? "font-medium text-primary" : "text-slate-400"}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("token")}
              className={mode === "token" ? "font-medium text-primary" : "text-slate-400"}
            >
              Paste token
            </button>
          </div>

          {mode === "login" ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
              />
              <input
                className={inputCls}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
              />
              <button
                type="button"
                onClick={doLogin}
                disabled={busy || !email || !password}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputCls} min-w-[320px] flex-1`}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="paste access token (JWT)"
              />
              <button
                type="button"
                onClick={saveTokenValue}
                disabled={!tokenInput.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Use token
              </button>
            </div>
          )}

          {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
