import { keepPreviousData } from "@tanstack/react-query";

/** Keep the last successful result visible while query key params change (period, page, filters). */
export const keepPreviousQueryData = keepPreviousData;
