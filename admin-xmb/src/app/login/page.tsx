"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth";

function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10) + 1;
  const num2 = Math.floor(Math.random() * 10) + 1;
  return { num1, num2, answer: num1 + num2 };
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, answer: 0 });
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const router = useRouter();

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setWarning("");

    const result = await loginAction(
      email,
      password,
      parseInt(captchaInput, 10),
      captcha.answer
    );

    setLoading(false);
    refreshCaptcha();

    if (result.success) {
      router.push("/dashboard");
      router.refresh();
    } else {
      if (result.locked) {
        setIsLocked(true);
        setError(result.message);
      } else {
        setError(result.message);
        if (result.remainingAttempts !== undefined && result.remainingAttempts <= 2) {
          setWarning(`Noch ${result.remainingAttempts} Versuche übrig`);
        }
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md p-8 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">XMB Admin</h1>
        <p className="text-zinc-500 mb-8">Melde dich an, um fortzufahren</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-2">
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              placeholder="E-Mail oder Benutzername"
              disabled={isLocked}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-2">
              Passwort
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              disabled={isLocked}
              required
            />
          </div>

          <div>
            <label htmlFor="captcha" className="block text-sm font-medium text-zinc-400 mb-2">
              Sicherheitscode
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg select-none">
                <span className="text-xl font-mono text-amber-400 tracking-widest">
                  {captcha.num1} + {captcha.num2} = ?
                </span>
              </div>
              <input
                id="captcha"
                type="number"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="w-24 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-center"
                placeholder="?"
                disabled={isLocked}
                required
              />
              <button
                type="button"
                onClick={refreshCaptcha}
                className="p-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                title="Neuer Code"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {warning && (
            <div className="p-3 bg-amber-900/30 border border-amber-800 rounded-lg text-amber-400 text-sm">
              ⚠️ {warning}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-colors duration-200"
          >
            {loading ? "Anmelden..." : isLocked ? "Konto gesperrt" : "Anmelden"}
          </button>
        </form>
      </div>
    </div>
  );
}
