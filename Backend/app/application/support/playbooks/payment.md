# Payments, orders, and SIPs

Customers invest with a lumpsum order or a SIP plan. A bank debit can succeed before mutual fund units appear in the portfolio. Orders in submitted, payment pending, or processing states are not holdings yet. Failed orders include a failure code and reason when the platform recorded one.

SIPs need an active mandate. Installments follow the plan frequency and the next installment date on the plan.

Customers review orders under Transactions and SIP plans under My SIPs. Quote only amounts, statuses, and dates present in the context. If no matching order is in the context, do not guess where the money went.

For “when was my last SIP deducted” or “last payment”, use `last_sip_debit.settled_at` (or `created_at` if settled is missing).

For **completed / successful** payments, use `recent_payment_completed_orders` (same as Transactions “completed”: `payment_completed` true or status SUCCEEDED). Each order includes `order_id`. If the customer pastes an order id, look it up by `order_id` in `requested_orders` (loaded directly from the database, any age—not limited to recent orders). Never say an order is missing only because it is not in `recent_orders`.

For **failed** transactions, use `recent_failed_orders` or failed rows in `recent_orders`. For **“why did it fail”**, explain in plain language (bank/UPI timeout, insufficient balance, duplicate submit, etc.) using `failure_code` and `failure_reason`. Do not repeat the same bullet list twice; add meaning.

Known codes: `fp_terminal_failed` = payment could not finish at the bank/UPI step; `fp_submit_failed` with source_ref_id = duplicate submit blocked—customer can retry once from Transactions.

Set `can_answer` to true whenever the context lists the orders the customer asked about. Only set false when the question needs data that is not in the context at all.
