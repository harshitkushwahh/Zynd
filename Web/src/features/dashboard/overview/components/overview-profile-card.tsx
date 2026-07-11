"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { overviewContent } from "@/features/dashboard/config/dashboard-content";
import { useAuth } from "@/contexts/auth-context";
import { DEFAULT_COUNTRY } from "@/lib/input-rules";

export function OverviewProfileCard() {
  const { user, displayName } = useAuth();
  const { profile } = overviewContent;

  if (!user) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{profile.title}</CardTitle>
        <CardDescription>{profile.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-compact text-muted-foreground">
        <p>
          <span className="text-foreground">Name:</span> {displayName || "—"}
        </p>
        <p>
          <span className="text-foreground">Email:</span> {user.email}
        </p>
        <p>
          <span className="text-foreground">Mobile:</span>{" "}
          {user.phone ? `${DEFAULT_COUNTRY.dialCode} ${user.phone}` : "—"}
        </p>
        <p>
          <span className="text-foreground">Country:</span> {DEFAULT_COUNTRY.label}
        </p>
      </CardContent>
    </Card>
  );
}
