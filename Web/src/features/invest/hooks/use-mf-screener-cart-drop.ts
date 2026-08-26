"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  bulkUpsertMfCartItems,
  fetchMfCart,
  upsertMfCartItem,
  type MfCart,
} from "@/features/invest/api/invest-api";
import { setMfCartQueryData } from "@/features/invest/hooks/use-mf-cart-query";
import type { MfFundScreenerSelectionItem } from "@/features/invest/contexts/mf-fund-screener-selection-context";
import {
  resolveScreenerCartLumpsumAmount,
  SCREENER_CART_DEFAULT_LUMPSUM_INR,
} from "@/features/invest/lib/mf-cart-amount";
import {
  canAddToMfCart,
  filterLumpsumBulkCartAdds,
  getMfCartMaxItems,
  remainingMfCartSlots,
} from "@/features/invest/lib/mf-cart-limits";
import type { MfFundScreenerDragPayload } from "@/features/invest/lib/mf-fund-screener-drag";
import { formatInr } from "@/features/invest/lib/mf-format";
import {
  screenerCartBlockedMessage,
  screenerCartPartialAddMessage,
} from "@/features/invest/lib/mf-screener-queue-messages";
import { queryKeys } from "@/lib/query-keys";
import { copy } from "@/shared/config/copy";

type ScreenerCartFund = MfFundScreenerDragPayload | MfFundScreenerSelectionItem;

function buildScreenerCartItems(funds: ScreenerCartFund[]) {
  return funds.map((fund) => ({
    product_id: fund.product_id,
    amount_inr:
      "amount_inr" in fund && Number.isFinite(fund.amount_inr)
        ? fund.amount_inr
        : resolveScreenerCartLumpsumAmount(fund.min_lumpsum_amount_inr),
  }));
}

function screenerCartAmountDescription(funds: ScreenerCartFund[], items: Array<{ amount_inr: number }>) {
  if (funds.length === 1) {
    return copy.mutualFunds.screenerDockAddedAtAmount.replace(
      "{amount}",
      formatInr(items[0].amount_inr),
    );
  }

  const usesHigherMin = items.some(
    (item) => item.amount_inr > SCREENER_CART_DEFAULT_LUMPSUM_INR,
  );
  if (usesHigherMin) {
    return copy.mutualFunds.screenerDockAddedWithMinAmounts;
  }

  return copy.mutualFunds.screenerDockAddedAtDefaultAmount.replace(
    "{amount}",
    formatInr(SCREENER_CART_DEFAULT_LUMPSUM_INR),
  );
}

function cartFullMessage(cart: Pick<MfCart, "max_items">) {
  return copy.mutualFunds.cartFullHint.replace("{max}", String(getMfCartMaxItems(cart)));
}

async function resolveMfCartSnapshot(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<MfCart> {
  return (
    queryClient.getQueryData<MfCart>(queryKeys.invest.cart()) ?? (await fetchMfCart())
  );
}

export function useMfScreenerCartDrop() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const addFundsToCart = useCallback(
    async (funds: ScreenerCartFund[]) => {
      if (funds.length === 0) return null;
      setAdding(true);
      try {
        const cartSnapshot = await resolveMfCartSnapshot(queryClient);
        const slotsBeforeAdd = remainingMfCartSlots(cartSnapshot, "lumpsum");
        const { addable, skipped } = filterLumpsumBulkCartAdds(cartSnapshot, funds);

        if (addable.length === 0) {
          toast.error(
            screenerCartBlockedMessage(cartSnapshot.lumpsum_item_count, cartSnapshot.max_items),
          );
          return null;
        }

        const items = buildScreenerCartItems(addable);

        const cart =
          addable.length === 1
            ? await upsertMfCartItem({
                product_id: addable[0].product_id,
                amount_inr: items[0].amount_inr,
                investment_type: "lumpsum",
              })
            : await bulkUpsertMfCartItems({ items });

        setMfCartQueryData(queryClient, cart);

        toast.success(
          addable.length === 1
            ? copy.mutualFunds.cartAddedToast
            : copy.mutualFunds.screenerDockAddSuccess.replace("{count}", String(addable.length)),
          {
            description: screenerCartAmountDescription(addable, items),
            action: {
              label: copy.mutualFunds.cartViewAction,
              onClick: () => router.push("/dashboard/mutual-funds/cart"),
            },
          },
        );

        if (skipped > 0) {
          toast.warning(
            screenerCartPartialAddMessage(cartSnapshot.lumpsum_item_count, slotsBeforeAdd),
          );
        }

        if (cart.lumpsum_item_count >= cart.max_items) {
          toast.message(cartFullMessage(cart));
        }

        return cart;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : copy.mutualFunds.cartAddFailed);
        return null;
      } finally {
        setAdding(false);
      }
    },
    [queryClient, router],
  );

  const addFundToCart = useCallback(
    async (fund: ScreenerCartFund) => {
      const cartSnapshot = await resolveMfCartSnapshot(queryClient);
      if (!canAddToMfCart(cartSnapshot, fund.product_id, "lumpsum")) {
        toast.error(
          screenerCartBlockedMessage(cartSnapshot.lumpsum_item_count, cartSnapshot.max_items),
        );
        return null;
      }
      return addFundsToCart([fund]);
    },
    [addFundsToCart, queryClient],
  );

  return {
    addFundToCart,
    addFundsToCart,
    adding,
    resolveCartAmount: resolveScreenerCartLumpsumAmount,
  };
}
