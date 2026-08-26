"use client";

import { Loader2, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { MfFundAmcAvatar } from "@/features/invest/components/mf-fund-search-ui";
import { useMfFundScreenerSelection } from "@/features/invest/contexts/mf-fund-screener-selection-context";
import { useMfScreenerCartDrop } from "@/features/invest/hooks/use-mf-screener-cart-drop";
import { useMfCartQuery } from "@/features/invest/hooks/use-mf-cart-query";
import {
  isMfCartFull,
  remainingMfCartSlots,
} from "@/features/invest/lib/mf-cart-limits";
import {
  getActiveMfFundScreenerDragPayload,
  hasMfFundScreenerDragType,
  isMfFundScreenerDragActive,
  parseMfFundScreenerDragPayload,
} from "@/features/invest/lib/mf-fund-screener-drag";
import {
  screenerCartBlockedMessage,
  screenerQueueRejectMessage,
} from "@/features/invest/lib/mf-screener-queue-messages";
import { SupportFabButton } from "@/features/support/components/support-fab-button";
import { copy } from "@/shared/config/copy";
import { ZYND_3XL_RADIUS_CLASS } from "@/shared/config/ui-classes";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_LOGOS = 4;
const PROXIMITY_PX = 56;

function isPointerNearRect(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  padding: number,
) {
  return (
    clientX >= rect.left - padding &&
    clientX <= rect.right + padding &&
    clientY >= rect.top - padding &&
    clientY <= rect.bottom + padding
  );
}

export function MfFundScreenerDock() {
  const {
    selectedFunds,
    addFund,
    clearSelection,
    isSelectionFull,
    maxSelectableFunds,
    selectionCount,
  } = useMfFundScreenerSelection();
  const { addFundsToCart, adding } = useMfScreenerCartDrop();
  const { data: cart } = useMfCartQuery(true);
  const [dragNear, setDragNear] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);
  const autoQueuedProductIdRef = useRef<string | null>(null);
  const queueRejectToastRef = useRef<string | null>(null);
  const selectionCountRef = useRef(selectionCount);

  const visibleFunds = selectedFunds.slice(0, MAX_VISIBLE_LOGOS);
  const overflowCount = Math.max(selectedFunds.length - MAX_VISIBLE_LOGOS, 0);
  const hasSelection = selectedFunds.length > 0;
  const cartFull = cart ? isMfCartFull(cart, "lumpsum") : false;
  const cartRemainingSlots = cart ? remainingMfCartSlots(cart, "lumpsum") : maxSelectableFunds;
  const queueDropDisabled = isSelectionFull;
  const addToCartDisabled = adding || !hasSelection || cartRemainingSlots === 0;

  useEffect(() => {
    selectionCountRef.current = selectionCount;
  }, [selectionCount]);

  const notifyQueueReject = useCallback(
    (count: number) => {
      const message = screenerQueueRejectMessage(count, maxSelectableFunds);
      if (queueRejectToastRef.current === message) return;
      queueRejectToastRef.current = message;
      toast.error(message);
    },
    [maxSelectableFunds],
  );

  useEffect(() => {
    function handleDocumentDragOver(event: DragEvent) {
      if (!isMfFundScreenerDragActive()) return;
      if (!event.dataTransfer || !hasMfFundScreenerDragType(event.dataTransfer)) return;

      const rect = trayRef.current?.getBoundingClientRect();
      if (!rect) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = queueDropDisabled ? "none" : "copy";

      const near = isPointerNearRect(rect, event.clientX, event.clientY, PROXIMITY_PX);
      setDragNear(near && !queueDropDisabled);

      if (!near || queueDropDisabled) {
        if (near && queueDropDisabled) {
          notifyQueueReject(selectionCountRef.current);
        }
        return;
      }

      const payload = getActiveMfFundScreenerDragPayload();
      if (!payload) return;
      if (autoQueuedProductIdRef.current === payload.product_id) return;

      const result = addFund(payload);
      if (result === "added") {
        autoQueuedProductIdRef.current = payload.product_id;
        selectionCountRef.current += 1;
        return;
      }
      if (result === "duplicate") {
        autoQueuedProductIdRef.current = payload.product_id;
        return;
      }

      notifyQueueReject(selectionCountRef.current);
    }

    function handleDocumentDragEnd() {
      autoQueuedProductIdRef.current = null;
      queueRejectToastRef.current = null;
      setDragNear(false);
    }

    document.addEventListener("dragover", handleDocumentDragOver);
    document.addEventListener("dragend", handleDocumentDragEnd);
    return () => {
      document.removeEventListener("dragover", handleDocumentDragOver);
      document.removeEventListener("dragend", handleDocumentDragEnd);
    };
  }, [addFund, notifyQueueReject, queueDropDisabled]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragNear(false);
      autoQueuedProductIdRef.current = null;

      if (queueDropDisabled) {
        notifyQueueReject(selectionCount);
        return;
      }

      const payload =
        getActiveMfFundScreenerDragPayload() ||
        parseMfFundScreenerDragPayload(event.dataTransfer);
      if (!payload) return;

      const result = addFund(payload);
      if (result === "full") {
        notifyQueueReject(selectionCount);
      }
    },
    [addFund, notifyQueueReject, queueDropDisabled, selectionCount],
  );

  async function handleAddAllToCart() {
    if (addToCartDisabled) {
      if (cart && cartRemainingSlots === 0) {
        toast.error(screenerCartBlockedMessage(cart.lumpsum_item_count, cart.max_items));
      }
      return;
    }
    const nextCart = await addFundsToCart(selectedFunds);
    if (nextCart) clearSelection();
  }

  function handleTrayClick() {
    if (addToCartDisabled || dragNear) return;
    void handleAddAllToCart();
  }

  function handleTrayKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (addToCartDisabled) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void handleAddAllToCart();
  }

  const trayDisabled = queueDropDisabled && !hasSelection;
  const showQueueFullState = queueDropDisabled && hasSelection;

  return (
    <div
      className={cn(
        "fixed z-50",
        "bottom-[4.75rem] right-3 md:bottom-6 md:right-6",
      )}
    >
      <div className="flex items-end justify-end gap-2 md:gap-3">
        <div
          ref={trayRef}
          role={hasSelection && !addToCartDisabled ? "button" : undefined}
          tabIndex={hasSelection && !addToCartDisabled ? 0 : undefined}
          aria-disabled={addToCartDisabled || trayDisabled ? true : undefined}
          aria-label={
            hasSelection
              ? copy.mutualFunds.screenerDockAddToCart.replace(
                  "{count}",
                  String(selectedFunds.length),
                )
              : queueDropDisabled
                ? copy.mutualFunds.screenerQueueDropDisabled
                    .replace("{count}", String(selectionCount))
                    .replace("{max}", String(maxSelectableFunds))
                : undefined
          }
          onClick={handleTrayClick}
          onKeyDown={handleTrayKeyDown}
          onDrop={handleDrop}
          className={cn(
            "group/tray zynd-screener-dock-tray relative h-14 min-h-14 w-fit max-w-[calc(100vw-5.5rem)] shrink-0 overflow-hidden",
            ZYND_3XL_RADIUS_CLASS,
            "select-none border bg-card shadow-zynd-high",
            "transition-[background-color,color,border-color,box-shadow,opacity] duration-200 ease-out",
            trayDisabled && "cursor-not-allowed opacity-60",
            showQueueFullState && "border-border/80",
            hasSelection && !addToCartDisabled && !dragNear && "cursor-pointer",
            hasSelection &&
              !addToCartDisabled &&
              !dragNear &&
              "hover:bg-primary hover:text-primary-foreground",
            hasSelection &&
              !addToCartDisabled &&
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            addToCartDisabled && hasSelection && "cursor-not-allowed opacity-80",
            dragNear
              ? "border-primary shadow-[inset_0_0_0_2px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
              : "border-border/80",
          )}
        >
          <div className="pointer-events-none relative inline-flex h-14 min-h-14 max-w-full items-center justify-center px-4">
            {hasSelection ? (
              <>
                <span
                  className={cn(
                    "inline-flex items-center justify-center gap-3",
                    "transition-opacity duration-200 ease-out",
                    !dragNear &&
                      !addToCartDisabled &&
                      "opacity-100 group-hover/tray:opacity-0 group-focus-visible/tray:opacity-0",
                    (dragNear || addToCartDisabled) && "opacity-100",
                  )}
                >
                  <span className="flex shrink-0 items-center">
                    {visibleFunds.map((fund, index) => (
                      <span
                        key={fund.product_id}
                        className={cn("relative shrink-0", index > 0 && "-ml-2")}
                        style={{ zIndex: visibleFunds.length - index }}
                      >
                        <MfFundAmcAvatar
                          amcLogoUrl={fund.amc_logo_url}
                          amcSlug={fund.amc_slug}
                          amcName={fund.amc_name}
                          size="sm"
                          className="size-7 p-0.5 ring-2 ring-card"
                        />
                      </span>
                    ))}
                    {overflowCount > 0 ? (
                      <span className="relative -ml-2 flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground ring-2 ring-card">
                        +{overflowCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="whitespace-nowrap text-caption font-medium">
                    {showQueueFullState
                      ? copy.mutualFunds.screenerQueueDropDisabled
                          .replace("{count}", String(selectionCount))
                          .replace("{max}", String(maxSelectableFunds))
                      : copy.mutualFunds.screenerDockSelectedCount.replace(
                          "{count}",
                          String(selectedFunds.length),
                        )}
                  </span>
                </span>

                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center gap-2 px-4",
                    "opacity-0 transition-opacity duration-200 ease-out",
                    !dragNear &&
                      !addToCartDisabled &&
                      "group-hover/tray:opacity-100 group-focus-visible/tray:opacity-100",
                  )}
                >
                  {adding ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ShoppingCart
                      className={cn(
                        "size-4",
                        !cartFull && "zynd-screener-dock-cart-icon",
                      )}
                      strokeWidth={2.1}
                      aria-hidden
                    />
                  )}
                  <span className="whitespace-nowrap text-compact font-semibold">
                    {cartFull
                      ? copy.mutualFunds.screenerCartAddBlocked
                          .replace("{count}", String(cart?.lumpsum_item_count ?? 0))
                          .replace("{max}", String(cart?.max_items ?? maxSelectableFunds))
                      : copy.mutualFunds.screenerDockAddToCart.replace(
                          "{count}",
                          String(selectedFunds.length),
                        )}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "inline-flex items-center justify-center gap-2.5 text-muted-foreground",
                    "transition-opacity duration-200 ease-out",
                    dragNear ? "opacity-0" : "opacity-100",
                  )}
                >
                  <ShoppingCart className="size-4 shrink-0" strokeWidth={2.1} aria-hidden />
                  <span className="whitespace-nowrap text-caption leading-none">
                    {queueDropDisabled
                      ? copy.mutualFunds.screenerQueueDropDisabled
                          .replace("{count}", String(selectionCount))
                          .replace("{max}", String(maxSelectableFunds))
                      : copy.mutualFunds.screenerDockDropHint}
                  </span>
                </span>
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center gap-2.5 text-muted-foreground",
                    "transition-opacity duration-200 ease-out",
                    dragNear ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden={!dragNear}
                >
                  <ShoppingCart className="size-4 shrink-0" strokeWidth={2.1} aria-hidden />
                  <span className="whitespace-nowrap text-caption leading-none">
                    {copy.mutualFunds.screenerDockDropActive}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        <SupportFabButton />
      </div>
    </div>
  );
}
