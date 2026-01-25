"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { resetPasswordWithToken, getResetTokenInfo } from "@/actions/password-reset";
import { Lock } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Kein Token angegeben");
        setValidating(false);
        return;
      }

      const info = await getResetTokenInfo(token);
      
      if (!info) {
        setError("Ungültiger oder abgelaufener Token");
        setIsValid(false);
      } else if (info.token.usedAt) {
        setError("Dieser Token wurde bereits verwendet");
        setIsValid(false);
      } else if (new Date() > info.token.expiresAt) {
        setError("Dieser Token ist abgelaufen");
        setIsValid(false);
      } else {
        setIsValid(true);
      }
      
      setValidating(false);
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }

    if (!token) {
      setError("Kein Token angegeben");
      return;
    }

    setLoading(true);
    setError("");

    const result = await resetPasswordWithToken(token, password);
    setLoading(false);

    if (result.success) {
      alert("Passwort erfolgreich zurückgesetzt! Du wirst zum Login weitergeleitet.");
      router.push("/login");
    } else {
      setError(result.message);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-500">Token wird validiert...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
              Ungültiger Token
            </h1>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20 mb-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <Button 
              className="w-full" 
              onClick={() => router.push("/forgot-password")}
            >
              Neuen Reset-Link anfordern
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500">
              <Lock className="h-6 w-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-900 dark:text-white">
            Neues Passwort setzen
          </h1>
          <p className="text-center text-slate-500 dark:text-slate-400 mt-2">
            Bitte gib dein neues Passwort ein
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Neues Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                required
                disabled={loading}
              />
            </div>
            
            <div>
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Passwort wiederholen"
                required
                disabled={loading}
              />
            </div>
            
            {error && (
              <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black" disabled={loading}>
              {loading ? "Wird gespeichert..." : "Passwort zurücksetzen"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Lädt...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

