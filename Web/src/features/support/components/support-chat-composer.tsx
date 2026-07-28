"use client";

import {
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { ImagePlus, SendHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SupportImageAttachment } from "@/features/support/lib/support-types";
import { cn } from "@/lib/utils";
import { copy } from "@/shared/config/copy";

const TEXTAREA_MAX_HEIGHT_PX = 112;

type SupportChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  attachment: SupportImageAttachment | null;
  onAttachImage: (file: File | null) => void;
  onClearAttachment: () => void;
  disabled?: boolean;
  className?: string;
};

export function SupportChatComposer({
  value,
  onChange,
  onSend,
  attachment,
  onAttachImage,
  onClearAttachment,
  disabled = false,
  className,
}: SupportChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = (value.trim().length > 0 || Boolean(attachment)) && !disabled;

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (canSend) {
      onSend();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter inserts a new line. Cmd/Ctrl+Enter sends.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (canSend) {
        onSend();
      }
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    onAttachImage(file);
    event.target.value = "";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "border-t border-border bg-background/95 px-3 py-3",
        className,
      )}
    >
      {attachment ? (
        <div className="mb-2 flex items-start gap-2">
          <div className="relative overflow-hidden rounded-[var(--radius-control)] border border-border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img
              src={attachment.url}
              alt={attachment.name}
              className="h-16 w-16 object-cover"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="absolute top-1 right-1 size-5 rounded-full bg-background/90 shadow-zynd-low"
              aria-label={copy.support.removeImageAriaLabel}
              onClick={onClearAttachment}
              disabled={disabled}
            >
              <X className="size-3" />
            </Button>
          </div>
          <p className="min-w-0 flex-1 truncate pt-1 text-caption text-muted-foreground">
            {attachment.name}
          </p>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={copy.support.composerPlaceholder}
          aria-label={copy.support.composerAriaLabel}
          className={cn(
            "max-h-28 min-h-10 flex-1 resize-none overflow-y-auto rounded-[var(--radius-control)] border border-input bg-transparent px-3 py-2.5 text-compact outline-none",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
          )}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={handleFileChange}
        />

        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled}
          aria-label={copy.support.uploadImageAriaLabel}
          className="size-10 shrink-0 rounded-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
        </Button>

        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          aria-label={copy.support.sendAriaLabel}
          className="size-10 shrink-0 rounded-full"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </form>
  );
}
