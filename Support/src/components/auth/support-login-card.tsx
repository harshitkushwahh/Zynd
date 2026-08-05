"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSupportAuth } from "@/contexts/support-auth-context";
import { SUPPORT_DEMO_AGENTS } from "@/lib/support-agents";

export function SupportLoginCard() {
  const router = useRouter();
  const { user, loading, signIn } = useSupportAuth();
  const [email, setEmail] = useState(SUPPORT_DEMO_AGENTS[0]!.email);
  const [password, setPassword] = useState(SUPPORT_DEMO_AGENTS[0]!.password);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError("");
    try {
      await signIn(email, password);
      router.push("/dashboard");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-zynd-mid">
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="ZYND" width={44} height={44} className="size-11" priority />
          <div>
            <h1 className="font-heading text-h3 font-semibold text-foreground">ZYND Support</h1>
            <p className="mt-1 text-caption text-muted-foreground">
              Contact team console — frontend demo with dummy data
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="support-email">Email</FieldLabel>
              <Input
                id="support-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="aanya@zynd.support"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="support-password">Password</FieldLabel>
              <Input
                id="support-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </FieldGroup>

          {formError ? <FieldError>{formError}</FieldError> : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="rounded-[var(--radius-card)] border border-border bg-muted/30 px-3 py-3">
          <p className="text-caption font-medium text-foreground">Demo accounts</p>
          <ul className="mt-2 space-y-1.5 text-caption text-muted-foreground">
            {SUPPORT_DEMO_AGENTS.map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  className="text-left hover:text-foreground"
                  onClick={() => {
                    setEmail(agent.email);
                    setPassword(agent.password);
                  }}
                >
                  {agent.email} · {agent.password}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
