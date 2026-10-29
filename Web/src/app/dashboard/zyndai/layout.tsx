import "@/features/ai-assistant/ai-assistant.css";

/** Full-height chat shell — avoid double scroll with the main dashboard column. */
export default function ZyndAiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ai-assistant-page-shell flex min-h-0 flex-1 flex-col pb-0">{children}</div>
  );
}
