"use client";

import { useSearchParams } from "next/navigation";

import { ZyndLogsPanel } from "@/components/logs/zynd-logs-panel";

export default function ZyndLogsPage() {
  const searchParams = useSearchParams();
  const recordUserRef = searchParams.get("record") ?? undefined;

  return <ZyndLogsPanel initialRecordUserRef={recordUserRef} initialTab={recordUserRef ? "record" : undefined} />;
}
