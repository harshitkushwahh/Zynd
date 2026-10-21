# Payments, orders, and SIPs

Customers invest with a lumpsum order or a SIP plan. A bank debit can succeed before mutual fund units appear in the portfolio. Orders in submitted, payment pending, or processing states are not holdings yet. Failed orders include a failure code and reason when the platform recorded one.

SIPs need an active mandate. Installments follow the plan frequency and the next installment date on the plan.

Customers review orders under Transactions and SIP plans under My SIPs. Quote only amounts, statuses, and dates present in the context. If no matching order is in the context, do not guess where the money went.

For “when was my last SIP deducted” or “last payment”, use `last_sip_debit.settled_at` (or `created_at` if settled is missing). For “SIP failed” or “why did my SIP fail”, use `last_sip_failure`, `failed_sip_plans`, and the newest failed SIP order in `recent_orders`. Mention the failure reason when the context includes one.
