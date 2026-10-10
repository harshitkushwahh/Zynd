"use client";

import { Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function SupportUsersPanel() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-h3 font-semibold text-foreground">Users</h1>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Users className="size-10 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-body font-medium text-foreground">No user records</p>
        </CardContent>
      </Card>
    </div>
  );
}
