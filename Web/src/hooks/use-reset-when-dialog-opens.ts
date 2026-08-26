import { useEffect, useRef } from "react";

/** Reset dialog state when opening, not when closing, to avoid step flashes during the close animation. */
export function useResetWhenDialogOpens(open: boolean, reset: () => void) {
  const resetRef = useRef(reset);
  resetRef.current = reset;
  const wasOpenRef = useRef(open);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetRef.current();
    }
    wasOpenRef.current = open;
  }, [open]);
}
