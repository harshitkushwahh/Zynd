"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Paperclip, SendHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TEXTAREA_MIN_HEIGHT_PX = 60;
const TEXTAREA_MAX_HEIGHT_PX = 112;

type ComposerMode = "reply" | "internal";

type SupportTicketChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  className?: string;
};

export function SupportTicketChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  className,
}: SupportTicketChatComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("reply");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = value.trim().length > 0 && !disabled;

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT_PX);
    textarea.style.height = `${Math.max(TEXTAREA_MIN_HEIGHT_PX, nextHeight)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSend) onSend();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  const placeholder =
    mode === "reply"
      ? "Type your reply to the customer…"
      : "Add an internal note (not visible to customer)…";

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "shrink-0 rounded-b-[var(--radius-card)] border-t border-border bg-card px-4 py-3",
        className,
      )}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={2}
          placeholder={placeholder}
          aria-label={mode === "reply" ? "Ticket reply" : "Internal note"}
          className={cn(
            "max-h-28 min-h-[3.75rem] flex-1 resize-none overflow-y-auto rounded-[var(--radius-control)] border border-input bg-white px-3 py-2.5 text-compact leading-snug text-foreground outline-none",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
            mode === "internal" && "border-warning/30 bg-warning/5 dark:bg-warning/10",
          )}
        />
        <div
          className="flex h-10 shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/20 p-0.5"
          role="group"
          aria-label="Message type"
        >
          {(
            [
              ["reply", "Reply"],
              ["internal", "Internal note"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={cn(
                "h-full rounded-full px-3 text-caption font-medium transition-colors whitespace-nowrap",
                mode === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <Button type="button" variant="outline" size="icon" disabled className="size-10 shrink-0 rounded-full" aria-label="Attach file">
          <Paperclip className="size-4" strokeWidth={2.25} />
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!canSend}
          className="h-10 shrink-0 gap-1.5 rounded-full px-4"
        >
          Send
          <SendHorizontal className="size-4" strokeWidth={2.25} aria-hidden />
        </Button>
      </div>
    </form>
  );
}
