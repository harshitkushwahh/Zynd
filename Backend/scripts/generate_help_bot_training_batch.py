#!/usr/bin/env python3
"""Generate help-bot training JSONL batches (100 examples per batch)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "help-bot-training"


def _row(
    batch: int,
    slug: str,
    topics: list[str],
    question: str,
    *,
    solution: str,
    context_fields: list[str] | None = None,
    can_answer: bool = True,
    paraphrases: list[str] | None = None,
    escalate_if_missing: str | None = None,
) -> dict:
    prefix = f"b{batch:03d}"
    return {
        "id": f"{prefix}-{slug}",
        "batch": batch,
        "topics": topics,
        "question": question,
        "paraphrases": paraphrases or [],
        "in_scope": True,
        "needs_human": False,
        "can_answer": can_answer,
        "context_fields": context_fields or [],
        "solution": solution,
        "escalate_if_missing": escalate_if_missing,
    }


def batch_one_entries() -> list[dict]:
    b = 1
    rows: list[dict] = []

    kyc = [
        (
            "kyc-01",
            "When was my KYC completed?",
            ["kyc.completed_at", "kyc.overall_status"],
            "If overall_status is completed, give completed_at in the customer's timezone wording. "
            "If not completed, state current overall_status and ask them to open Complete KYC.",
        ),
        (
            "kyc-02",
            "What is my KYC status right now?",
            ["kyc.overall_status", "kyc.steps"],
            "Summarise overall_status and any step still pending or failed from steps.",
        ),
        (
            "kyc-03",
            "Is my PAN verification done?",
            ["kyc.steps.pan", "kyc.pan_verification_status"],
            "Answer from pan step status and pan_verification_status only.",
        ),
        (
            "kyc-04",
            "Did my DigiLocker step go through?",
            ["kyc.steps.digilocker"],
            "Use digilocker step status; if failed mention reopening Complete KYC.",
        ),
        (
            "kyc-05",
            "Why is my bank verification still pending?",
            ["kyc.steps.bank", "kyc.bank_verification_status"],
            "Explain bank step status; suggest retry from Complete KYC if pending/failed.",
        ),
        (
            "kyc-06",
            "Has my nominee step been submitted?",
            ["kyc.steps.nominee"],
            "Quote nominee step status from context.",
        ),
        (
            "kyc-07",
            "Is my KYC under review?",
            ["kyc.overall_status"],
            "If overall_status is submitted, say it is under review. Otherwise state actual status.",
        ),
        (
            "kyc-08",
            "I finished KYC yesterday  is it approved?",
            ["kyc.overall_status", "kyc.status_last_updated_at"],
            "Use overall_status and status_last_updated_at; do not promise approval unless completed.",
        ),
        (
            "kyc-09",
            "Which KYC step should I do next?",
            ["kyc.steps", "kyc.last_completed_step"],
            "Name the first step not completed or failed; point to Complete KYC.",
        ),
        (
            "kyc-10",
            "My KYC failed  what do I do?",
            ["kyc.steps", "kyc.readiness_reason"],
            "Identify failed step from steps; mention readiness_reason if present; retry that step.",
        ),
        (
            "kyc-11",
            "What does phase1 complete mean on my KYC?",
            ["kyc.overall_status"],
            "Explain using playbook: phase checkpoint before full completion.",
        ),
        (
            "kyc-12",
            "Am I KYC registered already with another broker?",
            ["kyc.kyc_already_registered", "kyc.external_kyc_status"],
            "Only quote kyc_already_registered and external_kyc_status flags.",
        ),
        (
            "kyc-13",
            "Can I invest before KYC is done?",
            ["kyc.overall_status"],
            "If not completed, say investing requires completed KYC per playbook.",
        ),
        (
            "kyc-14",
            "How do I resume KYC after closing the app?",
            ["kyc.overall_status", "kyc.last_completed_step"],
            "Tell them to open Dashboard → Complete KYC; progress is saved at last_completed_step.",
        ),
        (
            "kyc-15",
            "Is my e-sign finished?",
            ["kyc.steps.signature", "kyc.steps.review"],
            "Use signature and review step statuses.",
        ),
        (
            "kyc-16",
            "Why does it say KYC in progress?",
            ["kyc.overall_status", "kyc.steps"],
            "Explain in_progress and list pending steps.",
        ),
    ]
    for slug, q, fields, sol in kyc:
        rows.append(_row(b, slug, ["kyc"], q, context_fields=fields, solution=sol))

    payment = [
        (
            "pay-01",
            "When was my last SIP payment deducted?",
            ["payments.last_sip_debit.settled_at", "payments.last_sip_debit.amount"],
            "Use last_sip_debit settled_at and amount; if null say no successful SIP debit on file.",
        ),
        (
            "pay-02",
            "When did my SIP fail?",
            ["payments.last_sip_failure.created_at", "payments.last_sip_failure.failure_reason"],
            "Quote last_sip_failure date and failure_reason if present.",
        ),
        (
            "pay-03",
            "Why did my SIP fail?",
            ["payments.last_sip_failure.failure_reason", "payments.failed_sip_plans"],
            "Use failure_reason from last failed SIP order or failed_sip_plans.",
        ),
        (
            "pay-04",
            "My payment failed  what happened?",
            ["payments.recent_orders"],
            "Newest failed order: status, failure_code, failure_reason from recent_orders.",
        ),
        (
            "pay-05",
            "Money was debited but I see no units",
            ["payments.recent_orders", "portfolio.has_pending_orders"],
            "Explain processing/settlement; cite pending order if in recent_orders.",
        ),
        (
            "pay-06",
            "What is my next SIP date?",
            ["payments.sip_plans.next_installment_date"],
            "From active sip_plans, give next_installment_date per plan.",
        ),
        (
            "pay-07",
            "Is my SIP mandate active?",
            ["payments.sip_plans.status"],
            "Summarise sip_plans status; mention mandate needed for SIP per playbook.",
        ),
        (
            "pay-08",
            "How much was my last SIP installment?",
            ["payments.last_sip_debit.amount"],
            "Amount from last_sip_debit.",
        ),
        (
            "pay-09",
            "Show my recent failed transactions",
            ["payments.recent_orders", "payments.last_sip_failure"],
            "List failed orders from recent_orders (type, date, reason).",
        ),
        (
            "pay-10",
            "My UPI autopay did not work",
            ["payments.sip_plans.failure_reason", "payments.last_sip_failure"],
            "Use SIP failure_reason; suggest checking mandate and retry.",
        ),
        (
            "pay-11",
            "Order stuck on payment pending",
            ["payments.recent_orders"],
            "Find PAYMENT_PENDING order; explain it is awaiting payment confirmation.",
        ),
        (
            "pay-12",
            "When will my lumpsum order settle?",
            ["payments.recent_orders"],
            "Use recent lumpsum order status and settled_at if any; else processing message.",
        ),
        (
            "pay-13",
            "I was charged twice for SIP",
            ["payments.recent_orders"],
            "List recent SIP orders with dates/amounts; do not invent duplicates.",
            False,
            "Escalate if two succeeded debits same day not visible in context.",
        ),
        (
            "pay-14",
            "Can I change my SIP amount?",
            ["payments.sip_plans"],
            "Direct to My SIPs / support agent for change; quote current plan amount from context.",
        ),
        (
            "pay-15",
            "How do I cancel my SIP?",
            ["payments.sip_plans.status"],
            "Direct to My SIPs cancel flow; state current plan status.",
        ),
        (
            "pay-16",
            "Netbanking payment failed at bank",
            ["payments.recent_orders.failure_reason"],
            "Quote failure_reason from latest failed order.",
        ),
        (
            "pay-17",
            "What is the status of my latest order?",
            ["payments.recent_orders"],
            "Newest order: type, status, created_at.",
        ),
        (
            "pay-18",
            "Did my last payment succeed?",
            ["payments.recent_orders", "payments.last_sip_debit"],
            "Answer from newest order or last_sip_debit SUCCEEDED.",
        ),
        (
            "pay-19",
            "SIP failed due to mandate  what now?",
            ["payments.failed_sip_plans", "payments.sip_plans"],
            "Mention failed plan/mandate reason; re-authorize mandate in app.",
        ),
        (
            "pay-20",
            "How long do refunds take?",
            [],
            "Playbook-only: no refund SLA in context; say check Transactions or agent if refund initiated.",
            True,
        ),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 else True
        esc = item[5] if len(item) > 5 else None
        topics = ["payment", "portfolio"] if slug == "pay-05" else ["payment"]
        rows.append(
            _row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can, escalate_if_missing=esc)
        )

    portfolio = [
        ("port-01", "What is my portfolio value?", ["portfolio.current_value", "portfolio.as_on"], "Quote current_value and as_on."),
        ("port-02", "How much have I invested in total?", ["portfolio.invested"], "Quote invested."),
        ("port-03", "Why is my portfolio showing zero?", ["portfolio.status", "portfolio.holdings_count"], "Use status and holdings_count; mention pending orders if has_pending_orders."),
        ("port-04", "When will holdings update after payment?", ["portfolio.has_pending_orders"], "Explain allotment delay per playbook."),
        ("port-05", "What is my return so far?", ["portfolio.total_return"], "Quote total_return only."),
        ("port-06", "How many funds do I hold?", ["portfolio.holdings_count"], "Quote holdings_count."),
        ("port-07", "How many active SIPs show on portfolio?", ["portfolio.active_sips_count"], "Quote active_sips_count."),
        ("port-08", "What is my monthly SIP total?", ["portfolio.monthly_sip"], "Quote monthly_sip_inr field as monthly_sip."),
        ("port-09", "Portfolio not updating since yesterday", ["portfolio.as_on", "portfolio.status"], "Give as_on; if stale suggest refresh Transactions."),
        ("port-10", "Are my units allotted yet?", ["portfolio.has_pending_orders", "payments.recent_orders"], "Cross-check pending orders vs holdings."),
        ("port-11", "Current value vs invested  difference?", ["portfolio.current_value", "portfolio.invested", "portfolio.total_return"], "Explain using those three fields."),
        ("port-12", "Do I have any pending orders?", ["portfolio.has_pending_orders"], "Boolean from context."),
    ]
    for slug, q, fields, sol in portfolio:
        rows.append(_row(b, slug, ["portfolio"], q, context_fields=fields, solution=sol))

    account = [
        ("acc-01", "Is my Google account linked to Zynd?", ["account.google_account_linked"], "Yes/no from google_account_linked."),
        ("acc-02", "Is Apple sign-in connected?", ["account.apple_account_linked"], "Yes/no from apple_account_linked."),
        ("acc-03", "How do I sign in  password or Google?", ["account.google_account_linked", "account.has_password_login"], "List linked methods from flags."),
        ("acc-04", "Is my email verified?", ["account.email_verified", "account.email_verified_at"], "Use email_verified and date if true."),
        ("acc-05", "Is my phone number verified?", ["account.phone_verified"], "Quote phone_verified."),
        ("acc-06", "Do I have MFA enabled?", ["account.mfa_enrolled"], "Quote mfa_enrolled."),
        ("acc-07", "I forgot my password", [], "Password reset from sign-in screen; bot cannot reset (playbook)."),
        ("acc-08", "Can you turn off MFA for me?", [], "Bot cannot; Settings → Security (playbook).", False),
        ("acc-09", "Why am I locked out?", ["account.account_status"], "Use account_status; suggest password reset/support."),
        ("acc-10", "Change my email address", [], "Direct to Settings; bot cannot change email."),
        ("acc-11", "Change my mobile number", [], "Direct to Settings / verification flow."),
        ("acc-12", "I am not getting login OTP", ["account.phone_verified", "account.email_verified"], "Check verified channels; retry; escalate if persists.", False),
        ("acc-13", "Link Google to my existing account", ["account.google_account_linked"], "If false, explain Settings → link Google; if true, already linked."),
        ("acc-14", "Unlink Apple ID", ["account.apple_account_linked"], "If linked, direct to Settings; bot cannot unlink directly."),
        ("acc-15", "What sign-in providers are on my account?", ["account.linked_sign_in_providers"], "List linked_sign_in_providers array."),
        ("acc-16", "Is my account active?", ["account.account_status"], "Quote account_status."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 else True
        rows.append(_row(b, slug, ["account"], q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "What goals do I have?", ["goals.goals"], "List title, status, progress from goals.goals."),
        ("goal-02", "How much saved toward my goal?", ["goals.goals.current_amount", "goals.goals.target_amount"], "Quote amounts for matching goal or first goal."),
        ("goal-03", "When is my goal target date?", ["goals.goals.target_date"], "Quote target_date."),
        ("goal-04", "How does the SIP calculator work?", [], "Playbook: estimates only, no money moved."),
        ("goal-05", "Can I link a goal to family?", ["goals.goals", "family_groups.groups"], "Family goals per playbook if group exists."),
        ("goal-06", "Why is my goal off track?", ["goals.goals.progress_pct"], "Use progress_pct vs target."),
        ("goal-07", "Pause my goal", [], "Direct to Goals hub; bot cannot pause."),
        ("goal-08", "Create a new goal", [], "Dashboard → Goals → create (playbook)."),
    ]
    for slug, q, fields, sol in goals:
        topics = ["goals", "family"] if slug == "goal-05" else ["goals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    family = [
        ("fam-01", "How many family groups am I in?", ["family_groups.groups"], "Count groups array."),
        ("fam-02", "Am I the family head?", ["family_groups.groups.my_role"], "Quote my_role for each group."),
        ("fam-03", "How do I invite someone to family?", [], "Family section → invite (playbook)."),
        ("fam-04", "Accept family invite", [], "Open invite link / Family section pending invites."),
        ("fam-05", "Leave a family group", [], "Family settings → leave (playbook)."),
        ("fam-06", "Members in my family group", ["family_groups.groups.member_count"], "Quote member_count only, no PII."),
        ("fam-07", "Shared goals with family", ["family_groups.groups", "goals.goals"], "Explain shared goals if groups exist."),
        ("fam-08", "Family group status", ["family_groups.groups.status"], "Quote status field per group."),
    ]
    for slug, q, fields, sol in family:
        topics = ["family", "goals"] if slug == "fam-07" else ["family"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    referrals = [
        ("ref-01", "What is my referral code?", ["referrals.has_code"], "If has_code, direct to referrals page for code; never invent code string."),
        ("ref-02", "How many friends signed up with my link?", ["referrals.signup_count"], "Quote signup_count."),
        ("ref-03", "Referral KYC verified count", ["referrals.kyc_verified_count"], "Quote kyc_verified_count."),
        ("ref-04", "Referral rewards when paid?", [], "Referrals page for program rules; no invented payout."),
        ("ref-05", "How many referral clicks?", ["referrals.click_count"], "Quote click_count."),
        ("ref-06", "Friends who invested via referral", ["referrals.first_investment_count"], "Quote first_investment_count."),
        ("ref-07", "Share my referral link", ["referrals.has_code"], "Direct to Referrals page share UI."),
        ("ref-08", "Do I have a referral code active?", ["referrals.has_code"], "Yes/no from has_code."),
    ]
    for slug, q, fields, sol in referrals:
        rows.append(_row(b, slug, ["referrals"], q, context_fields=fields, solution=sol))

    multi = [
        (
            "multi-01",
            ["kyc", "payment"],
            "Can I start a SIP without finishing KYC?",
            ["kyc.overall_status"],
            "If KYC not completed, say SIP investing requires completed KYC.",
        ),
        (
            "multi-02",
            ["payment", "portfolio"],
            "I paid but portfolio is empty",
            ["payments.recent_orders", "portfolio.holdings_count", "portfolio.has_pending_orders"],
            "Explain pending allotment using order status and has_pending_orders.",
        ),
        (
            "multi-03",
            ["account", "kyc"],
            "Email verified but KYC stuck",
            ["account.email_verified", "kyc.overall_status", "kyc.steps"],
            "Confirm email_verified; explain KYC step blocking.",
        ),
        (
            "multi-04",
            ["referrals", "kyc"],
            "Friend did KYC  why no referral credit?",
            ["referrals.kyc_verified_count"],
            "Quote count; program rules on referrals page.",
        ),
        (
            "multi-05",
            ["goals", "payment"],
            "Link SIP to my retirement goal",
            ["goals.goals", "payments.sip_plans"],
            "Direct to Goals funding flow; quote existing goals/SIPs.",
        ),
        (
            "multi-06",
            ["family", "goals"],
            "Family goal progress for our trip",
            ["goals.goals", "family_groups.groups"],
            "Quote shared goal progress if in context.",
        ),
        (
            "multi-07",
            ["payment", "account"],
            "Payment failed after OTP login",
            ["payments.recent_orders", "account.mfa_enrolled"],
            "Separate login vs payment; quote failed order reason.",
        ),
        (
            "multi-08",
            ["portfolio", "payment"],
            "SIP active but portfolio value low",
            ["portfolio.current_value", "payments.sip_plans", "portfolio.invested"],
            "Explain recent start or market value using context numbers.",
        ),
        (
            "multi-09",
            ["kyc", "portfolio"],
            "KYC done but cannot see investments",
            ["kyc.overall_status", "portfolio.status", "portfolio.holdings_count"],
            "If KYC completed and holdings 0, say no holdings yet or pending orders.",
        ),
        (
            "multi-10",
            ["account", "payment"],
            "Google login works but payment fails",
            ["account.google_account_linked", "payments.recent_orders"],
            "Auth separate from payment; latest failure_reason.",
        ),
        (
            "multi-11",
            ["referrals", "payment"],
            "Referral friend invested  what counts?",
            ["referrals.first_investment_count"],
            "Quote first_investment_count; rules on referrals page.",
        ),
        (
            "multi-12",
            ["kyc", "payment", "account"],
            "I am new  what do I do first?",
            ["kyc.overall_status", "account.email_verified"],
            "Order: verify email/phone, complete KYC, then invest.",
        ),
    ]
    for slug, topics, q, fields, sol in multi:
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    return rows


def batch_two_entries() -> list[dict]:
    """Batch 2: paraphrases, casual/Hinglish wording, redemption/CAS edges, deeper combos."""
    b = 2
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "Mera KYC complete ho gaya kya?", ["kyc.overall_status", "kyc.completed_at"], "Answer in clear English: use overall_status; if completed give completed_at."),
        ("kyc-02", "How long does KYC approval take?", ["kyc.overall_status"], "If submitted say under review; no SLA in context  do not invent days."),
        ("kyc-03", "My KYC got rejected  what now?", ["kyc.steps", "kyc.readiness_reason"], "Find failed/rejected step; readiness_reason; retry Complete KYC."),
        ("kyc-04", "Can I change nominee after KYC?", ["kyc.steps.nominee", "kyc.overall_status"], "Direct to Complete KYC / nominee step if not completed; else Settings/KYC update flow."),
        ("kyc-05", "Address proof was rejected", ["kyc.steps.address"], "Quote address step; reopen Complete KYC to re-upload."),
        ("kyc-06", "Signature step is still pending", ["kyc.steps.signature"], "Quote signature status; continue from Complete KYC."),
        ("kyc-07", "Wrong name showing in KYC", ["kyc.steps.personal", "kyc.pan_verification_status"], "Personal/PAN step; fix in Complete KYC before submit."),
        ("kyc-08", "I submitted KYC  how many days for approval?", ["kyc.overall_status", "kyc.status_last_updated_at"], "If submitted, under review; no fixed timeline in context."),
        ("kyc-09", "Need to redo DigiLocker", ["kyc.steps.digilocker", "kyc.readiness_code"], "DigiLocker step status; restart from Complete KYC."),
        ("kyc-10", "PAN name does not match bank", ["kyc.pan_verification_status", "kyc.bank_verification_status"], "Explain mismatch flags; fix PAN/bank steps."),
        ("kyc-11", "Is CKYC updated for me?", ["kyc.external_kyc_status"], "Only external_kyc_status from context."),
        ("kyc-12", "Does KYC expire?", ["kyc.overall_status"], "If completed, KYC remains until re-KYC required  no expiry date in context unless present."),
        ("kyc-13", "Difference between investor profile and KYC?", ["kyc.overall_status"], "KYC verifies identity; investing may need completed KYC + investor profile readiness."),
        ("kyc-14", "Why is bank step still pending?", ["kyc.steps.bank", "kyc.bank_verification_status"], "Bank verification status and retry path."),
        ("kyc-15", "Is nominee mandatory?", ["kyc.steps.nominee"], "Nominee step status; complete if pending per journey."),
        ("kyc-16", "KYC for mutual fund only or stocks too?", ["kyc.overall_status"], "Zynd MF investing; completed KYC per context."),
    ]
    for slug, q, fields, sol in kyc:
        rows.append(_row(b, slug, ["kyc"], q, context_fields=fields, solution=sol))

    payment = [
        ("pay-01", "I want to redeem my mutual fund", ["payments.recent_orders", "portfolio.holdings_count"], "Redemption is an order type; check recent REDEMPTION orders or direct to Portfolio → Redeem."),
        ("pay-02", "Switch from one scheme to another", ["payments.recent_orders"], "Switch orders in recent_orders or product Switch flow; no invented switch status."),
        ("pay-03", "What's the difference between lumpsum and SIP?", [], "Playbook: lumpsum one-time vs SIP recurring mandate."),
        ("pay-04", "Payment succeeded but order shows failed", ["payments.recent_orders"], "Find conflicting statuses in recent_orders; escalate if inconsistent.", False, "Conflicting payment vs order state"),
        ("pay-05", "How do I pause my SIP temporarily?", ["payments.sip_plans.status"], "Direct to My SIPs; quote plan status; bot cannot pause directly."),
        ("pay-06", "Increase my monthly SIP amount", ["payments.sip_plans"], "Current amount from sip_plans; change via My SIPs or agent."),
        ("pay-07", "Mandate limit exceeded for SIP", ["payments.sip_plans.failure_reason", "payments.failed_sip_plans"], "Quote failure_reason mentioning mandate/tier limits."),
        ("pay-08", "Why was autopay skipped this month?", ["payments.last_sip_failure", "payments.sip_plans"], "Last failure or inactive plan from context."),
        ("pay-09", "Transaction failed  insufficient balance", ["payments.last_sip_failure.failure_reason"], "Quote failure_reason if mentions balance."),
        ("pay-10", "Payment gateway timed out", ["payments.recent_orders"], "Latest order PAYMENT_PENDING or failed; retry payment."),
        ("pay-11", "Check status of my order", ["payments.recent_orders"], "Newest order type, status, dates."),
        ("pay-12", "Money debited but order cancelled", ["payments.recent_orders"], "Find cancelled order with debit; escalate for refund trace.", False),
        ("pay-13", "When does my first SIP installment run?", ["payments.sip_plans.next_installment_date"], "next_installment_date from active plan."),
        ("pay-14", "Will SIP run on a public holiday?", [], "Playbook: debits follow mandate/plan schedule; exact holiday rules not in context."),
        ("pay-15", "Two SIP debits on same day  normal?", ["payments.recent_orders"], "List SIP orders that day; escalate if duplicate succeeded.", False),
        ("pay-16", "UPI mandate expired  how to renew?", ["payments.sip_plans.status", "payments.failed_sip_plans"], "Failed/expired mandate from plan; re-authorize in app."),
        ("pay-17", "Pay lumpsum using net banking", ["payments.recent_orders"], "Recent lumpsum PAYMENT_PENDING/SUCCEEDED path; checkout in invest flow."),
        ("pay-18", "Cart checkout failed at payment", ["payments.recent_orders.failure_reason"], "Latest failed order failure_reason."),
        ("pay-19", "Wrong installment amount debited", ["payments.last_sip_debit.amount", "payments.sip_plans"], "Compare last debit amount to plan amount; escalate if mismatch.", False),
        ("pay-20", "How do I retry a failed payment?", ["payments.recent_orders"], "Open failed order in Transactions; restart payment if still pending."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 else True
        esc = item[5] if len(item) > 5 else None
        topics = ["payment", "portfolio"] if slug in {"pay-01", "pay-04"} else ["payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can, escalate_if_missing=esc))

    portfolio = [
        ("port-01", "How do I sell my mutual fund?", ["portfolio.holdings_count"], "Portfolio → redeem; holdings_count must be > 0."),
        ("port-02", "How much can I withdraw today?", ["portfolio.current_value"], "Current value is indicative; redemption limits from fund rules not in context."),
        ("port-03", "Today's gain or loss on portfolio", ["portfolio.total_return", "portfolio.as_on"], "Quote total_return and as_on; not intraday unless in context."),
        ("port-04", "Show scheme-wise breakup", ["portfolio.holdings_count"], "Direct to Portfolio holdings list; do not invent scheme names."),
        ("port-05", "Import CAS statement", [], "CAS feature if enabled in product; else support article  no CAS row without context."),
        ("port-06", "External holdings not showing", ["portfolio.status"], "Portfolio summary status; CAS import path if available."),
        ("port-07", "Partial redemption possible?", ["portfolio.holdings_count"], "Yes via redeem flow if holdings exist; quote holdings_count."),
        ("port-08", "I redeemed everything  balance zero?", ["portfolio.holdings_count", "portfolio.current_value"], "If holdings_count 0 and value 0, confirm empty portfolio."),
        ("port-09", "Fund missing after 3 days of payment", ["portfolio.has_pending_orders", "payments.recent_orders"], "Pending allotment explanation."),
        ("port-10", "Why current value less than invested?", ["portfolio.invested", "portfolio.current_value", "portfolio.total_return"], "Market movement via total_return; quote numbers."),
        ("port-11", "Portfolio summary failed to load", ["portfolio.status"], "status field error; retry later; no invented values."),
        ("port-12", "Where is my folio number?", [], "Holdings detail in Portfolio; folio not in summary context  open holding."),
    ]
    for slug, q, fields, sol in portfolio:
        can = slug != "port-04" and slug != "port-12"
        rows.append(_row(b, slug, ["portfolio"], q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "Google sign-in not working", ["account.google_account_linked"], "If linked, troubleshooting; if not, link in Settings."),
        ("acc-02", "Add a phone number to my account", ["account.phone_verified"], "Settings → phone; quote phone_verified."),
        ("acc-03", "Email verification link expired", ["account.email_verified"], "Resend verification from Settings if not verified."),
        ("acc-04", "Reset MFA authenticator app", ["account.mfa_enrolled"], "Security settings; bot cannot reset  agent if locked out.", False),
        ("acc-05", "Where are backup codes?", ["account.mfa_enrolled"], "Security → MFA backup codes when enrolled."),
        ("acc-06", "Login OTP on SMS not coming", ["account.phone_verified", "account.mfa_enrolled"], "Check phone_verified; retry; escalate.", False),
        ("acc-07", "Why is my account suspended?", ["account.account_status"], "Quote account_status; support review."),
        ("acc-08", "Delete my Zynd account", ["account.account_status"], "Account deletion flow in Settings; bot cannot delete."),
        ("acc-09", "Change name on profile", [], "Settings → profile; bot cannot edit."),
        ("acc-10", "App PIN lock setup", [], "Security / app PIN in settings if product supports."),
        ("acc-11", "I logged into the wrong Zynd account", [], "Sign out and sign in with correct email/Google.", True),
        ("acc-12", "Can you merge two accounts?", [], "Not self-serve; escalate to support.", False),
        ("acc-13", "Apple Hide My Email  will referrals work?", ["account.apple_account_linked", "account.email_verified"], "Email must be reachable; apple linked flag."),
        ("acc-14", "Turn off marketing notifications", [], "Settings → notifications preferences."),
        ("acc-15", "Session keeps expiring", [], "Re-login; check MFA; clear cookies  playbook troubleshooting."),
        ("acc-16", "Is my data secure on Zynd?", [], "High-level security: MFA, encryption; no invented certifications."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 else True
        rows.append(_row(b, slug, ["account"], q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "Edit my goal target amount", ["goals.goals"], "Goals hub edit; quote current target from context."),
        ("goal-02", "Delete a savings goal", ["goals.goals"], "Goals list → delete; bot cannot delete."),
        ("goal-03", "What return % does the calculator use?", [], "Calculator assumption from UI; not stored in context."),
        ("goal-04", "Fund a goal with one-time lumpsum", ["goals.goals", "payments.recent_orders"], "Link invest flow to goal; quote goal title."),
        ("goal-05", "Split SIP across two goals", ["goals.goals", "payments.sip_plans"], "Explain funding rules; list goals and SIPs present."),
        ("goal-06", "My goal deadline passed  what now?", ["goals.goals.target_date", "goals.goals.status"], "Quote target_date and status; extend/edit in Goals."),
        ("goal-07", "Family member contributing to shared goal", ["goals.goals", "family_groups.groups"], "Family goal funding per playbook."),
        ("goal-08", "Track goal progress daily", ["goals.goals.progress_pct"], "progress_pct and current vs target amounts."),
    ]
    for slug, q, fields, sol in goals:
        topics = ["goals", "family"] if slug == "goal-07" else ["goals"]
        if slug == "goal-04":
            topics = ["goals", "payment"]
        if slug == "goal-05":
            topics = ["goals", "payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    family = [
        ("fam-01", "Remove someone from family group", ["family_groups.groups.my_role"], "Only head can remove; quote role."),
        ("fam-02", "Family invite link expired", [], "Resend invite from Family section."),
        ("fam-03", "I am in two family groups  is that ok?", ["family_groups.groups"], "Count groups; explain multiple membership if allowed."),
        ("fam-04", "What can a family member do vs head?", ["family_groups.groups.my_role"], "Quote my_role; playbook permissions summary."),
        ("fam-05", "Transfer family head role", [], "Family settings → transfer head; bot cannot transfer."),
        ("fam-06", "Add child to family group", [], "Invite flow from Family; age/KYC rules per product."),
        ("fam-07", "See combined family portfolio", ["family_groups.groups"], "Privacy: no combined portfolio in context; shared goals only."),
        ("fam-08", "Decline a family invitation", [], "Pending invites → decline in Family UI."),
    ]
    for slug, q, fields, sol in family:
        can = False if slug == "fam-07" else True
        topics = ["family", "portfolio"] if slug == "fam-07" else ["family"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    referrals = [
        ("ref-01", "Referral code invalid at signup", ["referrals.has_code"], "Referrer must have active code; referee enters at signup."),
        ("ref-02", "Friend used my code but no reward", ["referrals.signup_count", "referrals.first_investment_count"], "Counts from context; program rules on referrals page."),
        ("ref-03", "Minimum investment for referral reward?", [], "Referrals page terms; do not invent INR threshold."),
        ("ref-04", "Where do I copy my referral link?", ["referrals.has_code"], "Referrals page share button if has_code."),
        ("ref-05", "Referral still pending", ["referrals.signup_count", "referrals.kyc_verified_count"], "Explain qualification steps from counts."),
        ("ref-06", "Is there a cap on referral rewards?", [], "Program limits on referrals page only."),
        ("ref-07", "Can I refer myself with second email?", [], "Self-referral not allowed; playbook policy.", False),
        ("ref-08", "Referral after I delete account", ["referrals.has_code"], "Code tied to account; inactive if account deleted."),
    ]
    for item in referrals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 else True
        rows.append(_row(b, slug, ["referrals"], q, context_fields=fields, solution=sol, can_answer=can))

    multi = [
        ("multi-01", ["kyc", "payment"], "KYC done but SIP setup fails", ["kyc.overall_status", "payments.sip_plans.failure_reason"], "KYC must be completed; then SIP/mandate failure_reason."),
        ("multi-02", ["portfolio", "payment"], "Redeem and money not in bank", ["payments.recent_orders", "portfolio.holdings_count"], "Redemption order status and settlement timeline."),
        ("multi-03", ["account", "referrals"], "Wrong email used for referral", ["account.email_verified", "referrals.signup_count"], "Referral attributes to signup email; fix before friend signs up."),
        ("multi-04", ["goals", "portfolio"], "Goal progress not moving after invest", ["goals.goals", "portfolio.has_pending_orders"], "Pending orders delay goal progress update."),
        ("multi-05", ["family", "kyc"], "Family member cannot invest  KYC?", ["family_groups.groups", "kyc.overall_status"], "Each member needs own KYC; quote customer's KYC only."),
        ("multi-06", ["payment", "referrals"], "Friend invested  referral count still zero", ["referrals.first_investment_count"], "Quote count; qualification hold days if in product copy elsewhere not invented."),
        ("multi-07", ["account", "portfolio"], "New phone login  portfolio missing", ["account.phone_verified", "portfolio.status"], "Same account; refresh; status loading issue."),
        ("multi-08", ["kyc", "referrals"], "Referral needs friend KYC first?", ["referrals.kyc_verified_count"], "Use kyc_verified_count semantics; referrals page rules."),
        ("multi-09", ["payment", "goals"], "SIP linked to wrong goal", ["payments.sip_plans", "goals.goals"], "List SIPs and goals; change link in Goals/SIP settings."),
        ("multi-10", ["portfolio", "kyc"], "Holdings show but KYC pending  bug?", ["kyc.overall_status", "portfolio.holdings_count"], "Reconcile status vs holdings; may be legacy or pending re-KYC."),
        ("multi-11", ["account", "payment"], "MFA on but payment OTP separate?", ["account.mfa_enrolled", "payments.recent_orders"], "Login MFA vs payment/OTP consent are different flows."),
        ("multi-12", ["kyc", "payment", "portfolio"], "New investor  debit, KYC, units timeline", ["kyc.overall_status", "payments.recent_orders", "portfolio.has_pending_orders"], "Step order: KYC → pay → pending allotment."),
    ]
    for slug, topics, q, fields, sol in multi:
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    return rows


def batch_three_entries() -> list[dict]:
    """Batch 3: risk/investor readiness, reports, consent OTP, tax/dividends, phrasing variants."""
    b = 3
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "Update bank account after KYC completed", ["kyc.overall_status", "kyc.steps.bank"], "If completed, bank change via Settings/KYC update; quote bank step status."),
        ("kyc-02", "Change address after submitting KYC", ["kyc.steps.address", "kyc.overall_status"], "Reopen address step if allowed; overall_status from context."),
        ("kyc-03", "My review step is stuck on submitted", ["kyc.steps.review", "kyc.overall_status"], "Review/submitted status; wait or support if prolonged."),
        ("kyc-04", "Can I invest with partial KYC?", ["kyc.overall_status"], "Investing requires completed KYC unless context shows otherwise."),
        ("kyc-05", "DigiLocker failed  error message?", ["kyc.steps.digilocker", "kyc.readiness_reason"], "DigiLocker status; readiness_reason if in kyc slice."),
        ("kyc-06", "Need help uploading signature", ["kyc.steps.signature"], "Signature step pending → Complete KYC."),
        ("kyc-07", "Is my PAN verified with ITD?", ["kyc.pan_verification_status"], "Quote pan_verification_status only."),
        ("kyc-08", "KYC shows phase2 complete  can I invest?", ["kyc.overall_status"], "Explain phase2 vs full completed; invest when overall completed."),
        ("kyc-09", "Why do I need bank penny drop?", ["kyc.steps.bank", "kyc.bank_verification_status"], "Bank verification purpose; status from context."),
        ("kyc-10", "Nominee details wrong after submit", ["kyc.steps.nominee"], "Fix via nominee step if still editable."),
        ("kyc-11", "Aadhaar masked in KYC  is that ok?", ["kyc.steps.digilocker"], "DigiLocker provides masked Aadhaar per regulations."),
        ("kyc-12", "KYC pending since last week", ["kyc.status_last_updated_at", "kyc.overall_status"], "Give last update time and status; no SLA invented."),
        ("kyc-13", "Re-KYC required on my account?", ["kyc.overall_status", "kyc.readiness_code"], "Use readiness_code/reason if present."),
        ("kyc-14", "Help with personal details step", ["kyc.steps.personal"], "Personal step status; continue Complete KYC."),
        ("kyc-15", "External KYC status pending", ["kyc.external_kyc_status"], "Quote external_kyc_status; no external ids."),
        ("kyc-16", "I closed KYC midway  is progress saved?", ["kyc.last_completed_step"], "Progress saved at last_completed_step; resume Complete KYC."),
    ]
    for slug, q, fields, sol in kyc:
        rows.append(_row(b, slug, ["kyc"], q, context_fields=fields, solution=sol))

    payment = [
        ("pay-01", "STP setup  how does it work?", [], "STP is transfer between schemes; setup in invest flows; no STP rows without context."),
        ("pay-02", "SWP to my bank monthly", [], "SWP withdrawal plans if product supports; direct to relevant MF section."),
        ("pay-03", "SIP date change to 5th of month", ["payments.sip_plans"], "Quote current plan; change via My SIPs."),
        ("pay-04", "Stop next SIP only not cancel plan", ["payments.sip_plans.next_installment_date"], "Skip installment rules in My SIPs; next date from context."),
        ("pay-05", "Payment pending for 24 hours", ["payments.recent_orders"], "Find PAYMENT_PENDING order; bank/gateway delay playbook."),
        ("pay-06", "Order processing after payment success", ["payments.recent_orders", "portfolio.has_pending_orders"], "Processing until allotment; has_pending_orders."),
        ("pay-07", "Failed because mandate not approved", ["payments.failed_sip_plans", "payments.sip_plans"], "Mandate approval failure_reason."),
        ("pay-08", "Invest lumpsum minimum amount?", [], "Min amount on scheme page; not in support context unless order min in pack."),
        ("pay-09", "SIP minimum ₹500  my plan?", ["payments.sip_plans"], "Quote sip_plans amount."),
        ("pay-10", "Consent OTP for mutual fund purchase", [], "MF consent OTP is separate from login OTP; complete in invest dialog."),
        ("pay-11", "Did not receive transaction consent OTP", [], "Resend from consent screen; check phone_verified.", False),
        ("pay-12", "Multiple orders in cart  one payment failed", ["payments.recent_orders"], "List recent orders statuses separately."),
        ("pay-13", "NFO lumpsum payment status", ["payments.recent_orders"], "Latest order type/status for NFO if in orders."),
        ("pay-14", "Refund timeline for failed lumpsum", ["payments.recent_orders.failure_reason"], "Failed order reason; refund via bank if debited  escalate.", False),
        ("pay-15", "Change SIP debit bank account", ["payments.sip_plans"], "Requires mandate update in My SIPs."),
        ("pay-16", "Why SIP amount differs slightly each month?", ["payments.last_sip_debit.amount"], "Quote amounts; market/nav rounding only if visible."),
        ("pay-17", "Payment done app crashed  order placed?", ["payments.recent_orders"], "Check newest order status in Transactions."),
        ("pay-18", "Autopay declined by bank", ["payments.last_sip_failure.failure_reason"], "failure_reason from bank decline."),
        ("pay-19", "Restart SIP after cancellation", ["payments.sip_plans"], "Cancelled plan status; create new SIP in invest flow."),
        ("pay-20", "Track payment reference number", ["payments.recent_orders"], "Order id/reference from recent order if in context; else Transactions UI."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = True
        esc = None
        if len(item) > 4:
            can = bool(item[4]) if isinstance(item[4], bool) else True
            if len(item) > 5:
                esc = item[5]
        topics = ["payment", "portfolio"] if slug == "pay-06" else ["payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can, escalate_if_missing=esc))

    portfolio = [
        ("port-01", "Download capital gains report", [], "Reports section if enabled; not in default context pack."),
        ("port-02", "Account statement PDF", [], "Generated reports in app; request from Reports/Statements."),
        ("port-03", "ELSS lock-in period for my fund", [], "Lock-in is scheme-specific; open holding detail; no invented years."),
        ("port-04", "Dividend payout not received", ["portfolio.holdings_count"], "Dividend crediting via AMC; escalate without payout rows."),
        ("port-05", "Compare two funds in portfolio", ["portfolio.holdings_count"], "Open holdings; bot cannot compare without scheme names in context."),
        ("port-06", "XIRR shown on dashboard", ["portfolio.total_return"], "Use total_return/as_on; XIRR label if UI shows it."),
        ("port-07", "Portfolio benchmark comparison", [], "Benchmark not in context; Portfolio analytics UI."),
        ("port-08", "Units mismatch with AMC statement", ["portfolio.holdings_count"], "Suggest CAS reconcile; escalate with folio."),
        ("port-09", "Mark portfolio to market daily?", ["portfolio.as_on"], "as_on date explains last refresh."),
        ("port-10", "Pending redemption units", ["payments.recent_orders", "portfolio.holdings_count"], "Open REDEMPTION order processing state."),
        ("port-11", "Switch order units not updated", ["payments.recent_orders"], "SWITCH order in recent_orders status."),
        ("port-12", "Total SIP count across funds", ["portfolio.active_sips_count"], "Quote active_sips_count."),
    ]
    for slug, q, fields, sol in portfolio:
        can = slug not in {"port-04", "port-05", "port-08"}
        rows.append(_row(b, slug, ["portfolio"], q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "Complete risk profile questionnaire", [], "Dashboard → Risk profile; required before some invests."),
        ("acc-02", "What is my risk profile result?", [], "Risk profile outcome in app; not in default account slice.", False),
        ("acc-03", "Update investor profile details", [], "Investor profile in dashboard; separate from KYC steps."),
        ("acc-04", "Change country code on account", ["account.country_code"], "Quote country_code; change via support if restricted."),
        ("acc-05", "Enable biometric login", [], "Device settings / app security feature."),
        ("acc-06", "Trust this device for MFA", ["account.mfa_enrolled"], "MFA trust device in Security settings."),
        ("acc-07", "Email changed but old inbox gets mail", ["account.email_verified"], "Verification on new email; sign-in uses current email on file."),
        ("acc-08", "Push notifications for orders", [], "Notification preferences for order updates."),
        ("acc-09", "WhatsApp updates from Zynd", [], "Notification channel preferences if product supports."),
        ("acc-10", "Download my data export", [], "Privacy/data export request via support.", False),
        ("acc-11", "Complaint about unauthorized login", ["account.account_status"], "Secure account: reset password, MFA; escalate.", False),
        ("acc-12", "Use same email for two family members", [], "One account per email; family invites use separate accounts."),
        ("acc-13", "Client ID for my account", [], "Client id visible in profile/support; not in default slice.", False),
        ("acc-14", "Turn on email alerts for SIP", [], "Notification preferences."),
        ("acc-15", "Account created with Apple  add password?", ["account.apple_account_linked", "account.has_password_login"], "Add password in Security if has_password_login false."),
        ("acc-16", "Sign out all devices", [], "Security → sign out everywhere if available."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = True
        if len(item) > 4 and isinstance(item[4], bool):
            can = item[4]
        rows.append(_row(b, slug, ["account"], q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "Rename my goal", ["goals.goals"], "Edit title in Goals hub."),
        ("goal-02", "Archive completed goal", ["goals.goals.status"], "Status from context; archive/close in Goals."),
        ("goal-03", "Goal vs SIP calculator difference", [], "Calculator hypothetical; goal tracks actual funding."),
        ("goal-04", "Set reminder before goal deadline", ["goals.goals.target_date"], "Quote target_date; reminders in Goals if supported."),
        ("goal-05", "Invest without picking a goal", ["goals.goals"], "Optional goal link on invest; goals list separate."),
        ("goal-06", "Goal shows 0% progress", ["goals.goals.progress_pct", "goals.goals.current_amount"], "Quote progress and amounts."),
        ("goal-07", "Combine two goals into one", [], "Manual: adjust targets or create new goal."),
        ("goal-08", "Export goal plan PDF", [], "Not in bot context; Goals UI if available."),
    ]
    for slug, q, fields, sol in goals:
        rows.append(_row(b, slug, ["goals"], q, context_fields=fields, solution=sol))

    family = [
        ("fam-01", "Resend family invite to spouse", [], "Family → pending invite → resend."),
        ("fam-02", "Family member KYC not done", ["family_groups.groups"], "Each member completes own KYC; quote groups only."),
        ("fam-03", "Stop sharing goals with family", ["family_groups.groups", "goals.goals"], "Leave group or unlink goal in Goals."),
        ("fam-04", "Family group name change", ["family_groups.groups"], "Edit group title if head; from groups list."),
        ("fam-05", "Invite rejected by member", [], "Invite shows declined; head can re-invite."),
        ("fam-06", "Max members in family group", [], "Product limit in Family UI; not invented."),
        ("fam-07", "Child turns 18  family access?", [], "Member becomes adult account; own KYC/investing."),
        ("fam-08", "Notifications for family invites", [], "Enable push/email in notification settings."),
    ]
    for slug, q, fields, sol in family:
        topics = ["family", "kyc"] if slug == "fam-02" else ["family"]
        if slug == "fam-03":
            topics = ["family", "goals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    referrals = [
        ("ref-01", "Referral reward in cash or wallet?", [], "Program terms on referrals page."),
        ("ref-02", "Track each friend's referral stage", ["referrals.signup_count", "referrals.kyc_verified_count", "referrals.first_investment_count"], "Explain funnel from counts."),
        ("ref-03", "Referral link opened but no signup", ["referrals.click_count", "referrals.signup_count"], "Clicks vs signups from context."),
        ("ref-04", "Change my referral code", ["referrals.has_code"], "Code usually fixed; referrals page if change allowed."),
        ("ref-05", "Refer corporate friend", [], "Same referral program; friend uses code at signup."),
        ("ref-06", "Referral benefit after I close SIP", ["referrals.first_investment_count"], "Qualification based on friend activity not referrer SIP."),
        ("ref-07", "Tax on referral rewards", [], "Tax advice not provided; refer to program terms/CA.", False),
        ("ref-08", "Share referral on WhatsApp", ["referrals.has_code"], "Use share on referrals page."),
    ]
    for item in referrals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["referrals"], q, context_fields=fields, solution=sol, can_answer=can))

    multi = [
        ("multi-01", ["kyc", "account"], "Risk profile pending  cannot invest?", ["kyc.overall_status"], "KYC plus risk profile may both be required; KYC from context."),
        ("multi-02", ["payment", "account"], "Consent OTP fails but login OTP works", ["account.phone_verified"], "Separate flows; phone_verified; retry consent."),
        ("multi-03", ["portfolio", "payment"], "Statement shows debit portfolio empty", ["payments.recent_orders", "portfolio.has_pending_orders"], "Pending allotment timeline."),
        ("multi-04", ["goals", "kyc"], "Create goal before KYC complete?", ["kyc.overall_status", "goals.goals"], "Goals may exist; funding invest needs KYC completed."),
        ("multi-05", ["referrals", "payment"], "Refer friend before I invest myself", ["referrals.has_code", "payments.recent_orders"], "Referral code independent; quote has_code."),
        ("multi-06", ["family", "payment"], "Pay for family member SIP", ["family_groups.groups"], "Each member own account/mandate; cannot pay other's SIP from context."),
        ("multi-07", ["kyc", "payment"], "Bank verified but payment fails", ["kyc.bank_verification_status", "payments.last_sip_failure"], "Separate payment failure_reason."),
        ("multi-08", ["portfolio", "goals"], "Goal funded but portfolio flat", ["goals.goals", "portfolio.current_value"], "Market movement vs goal progress timing."),
        ("multi-09", ["account", "kyc"], "Google account email differs from KYC email", ["account.google_account_linked", "kyc.overall_status"], "Sign-in email vs KYC registered email alignment."),
        ("multi-10", ["payment", "portfolio"], "Tax harvest redemption help", ["portfolio.holdings_count"], "Tax advice not provided; redemption flow only."),
        ("multi-11", ["referrals", "kyc"], "Friend stuck on KYC  referral counts?", ["referrals.kyc_verified_count"], "Counts update when friend completes KYC."),
        ("multi-12", ["kyc", "payment", "account"], "Full checklist before first SIP", ["kyc.overall_status", "account.email_verified", "account.phone_verified"], "Verify channels, complete KYC, then SIP+m mandate."),
    ]
    for slug, topics, q, fields, sol in multi:
        can = slug not in {"multi-06", "multi-10"}
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    return rows


def batch_four_entries() -> list[dict]:
    """Batch 4: typos/Hinglish, order lifecycle, explore/invest UX, support ticket meta."""
    b = 4
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "kyc status kya hai", ["kyc.overall_status", "kyc.steps"], "Reply in clear English with overall_status and pending steps."),
        ("kyc-02", "How do I fix KYC bank mismatch error?", ["kyc.bank_verification_status", "kyc.steps.bank"], "Bank verification status; retry bank step."),
        ("kyc-03", "Upload clearer signature photo", ["kyc.steps.signature"], "Signature step guidance; Complete KYC."),
        ("kyc-04", "KYC stuck on personal details", ["kyc.steps.personal", "kyc.readiness_reason"], "Personal step and readiness_reason."),
        ("kyc-05", "Can I use joint bank account for KYC?", ["kyc.steps.bank"], "Bank must match investor; verification via bank step status."),
        ("kyc-06", "Minor nominee in KYC", ["kyc.steps.nominee"], "Nominee step; guardian rules per form in app."),
        ("kyc-07", "Why is digilocker asking again?", ["kyc.steps.digilocker"], "Re-auth if step reset or failed."),
        ("kyc-08", "KYC completed but invest button disabled", ["kyc.overall_status", "kyc.readiness_code"], "Overall status and readiness_code."),
        ("kyc-09", "Change PAN after KYC submit", ["kyc.overall_status", "kyc.steps.pan"], "PAN changes restricted post-submit; support if typo.", False),
        ("kyc-10", "How long is KYC valid?", ["kyc.overall_status"], "No expiry date in context unless re-KYC flagged."),
        ("kyc-11", "KYC address different from Aadhaar", ["kyc.steps.address", "kyc.steps.digilocker"], "Address vs DigiLocker alignment in steps."),
        ("kyc-12", "Help with review and submit step", ["kyc.steps.review", "kyc.overall_status"], "Review step before submitted status."),
        ("kyc-13", "KYC failed at e-sign", ["kyc.steps.signature"], "Signature/e-sign step retry."),
        ("kyc-14", "Investor already registered error in KYC", ["kyc.kyc_already_registered"], "Quote kyc_already_registered flag."),
        ("kyc-15", "Resume KYC on new phone", ["kyc.last_completed_step"], "Same account login; resume Complete KYC."),
        ("kyc-16", "Who can see my KYC documents?", [], "Privacy: documents used for verification only; playbook tone."),
    ]
    for item in kyc:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["kyc"], q, context_fields=fields, solution=sol, can_answer=can))

    payment = [
        ("pay-01", "Cancel my pending lumpsum order", ["payments.recent_orders"], "Find PENDING/SUBMITTED order; cancel in Transactions if allowed."),
        ("pay-02", "Order cancelled but money debited", ["payments.recent_orders"], "Escalate refund trace if cancelled+debited.", False),
        ("pay-03", "Payment return page not loading", [], "Retry payment-return URL; check order in Transactions."),
        ("pay-04", "SIP step-up feature", ["payments.sip_plans"], "Step-up if product supports; current sip_plans amounts."),
        ("pay-05", "Why two orders for one SIP?", ["payments.recent_orders"], "List SIP orders same day; explain installment vs setup.", False),
        ("pay-06", "Add fund to cart and pay once", ["payments.recent_orders"], "Cart checkout; recent cart orders statuses."),
        ("pay-07", "Minimum SIP ₹100 possible?", ["payments.sip_plans"], "Quote plan amount; scheme minimum on fund page."),
        ("pay-08", "Mandate approved but SIP inactive", ["payments.sip_plans.status"], "Plan status vs mandate; failure_reason."),
        ("pay-09", "Change SIP from monthly to weekly", ["payments.sip_plans.frequency"], "Quote frequency; change via My SIPs."),
        ("pay-10", "Failed payment retry limit", ["payments.recent_orders"], "Retry from Transactions; escalate if blocked.", False),
        ("pay-11", "Netbanking success app shows failed", ["payments.recent_orders"], "Reconcile statuses; refresh Transactions."),
        ("pay-12", "When is cut-off time for today's order?", [], "Cut-off times on scheme page; not in support context."),
        ("pay-13", "SIP skipped this month automatically?", ["payments.last_sip_failure", "payments.sip_plans"], "Failure or inactive plan from context."),
        ("pay-14", "Pay for NFO before allotment", ["payments.recent_orders"], "NFO order payment_pending/processing states."),
        ("pay-15", "Duplicate mandate created", ["payments.sip_plans", "payments.failed_sip_plans"], "List plans; cancel duplicate in My SIPs.", False),
        ("pay-16", "UPI collect request for SIP", ["payments.last_sip_debit"], "Autopay debit via mandate; last_sip_debit timing."),
        ("pay-17", "Order ID not found in app", ["payments.recent_orders"], "Match from recent_orders list; else Transactions search."),
        ("pay-18", "Refund status for cancelled SIP", ["payments.sip_plans.status"], "Cancelled plan; refunds per AMC/bank timeline.", False),
        ("pay-19", "Invest more in same fund lumpsum", ["payments.recent_orders", "portfolio.holdings_count"], "New lumpsum order; holdings if any."),
        ("pay-20", "Payment failed insufficient mandate limit", ["payments.failed_sip_plans"], "Mandate tier/limit failure_reason."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["payment", "portfolio"] if slug == "pay-19" else ["payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    portfolio = [
        ("port-01", "Which fund gave highest return?", ["portfolio.total_return"], "No scheme ranking without holdings detail.", False),
        ("port-02", "Export portfolio CSV", [], "Export from Portfolio if available."),
        ("port-03", "Hide zero balance funds", ["portfolio.holdings_count"], "UI filter on holdings list."),
        ("port-04", "SIP vs current value on dashboard", ["portfolio.monthly_sip", "portfolio.current_value"], "Quote both fields."),
        ("port-05", "Allotment date for last purchase", ["payments.recent_orders.settled_at"], "settled_at on latest succeeded order."),
        ("port-06", "Why NAV date is old", ["portfolio.as_on"], "Explain as_on refresh schedule."),
        ("port-07", "Switch all units to another fund", ["portfolio.holdings_count"], "Full switch via Switch flow if holdings > 0."),
        ("port-08", "Redemption amount credited to which bank?", [], "Default bank from KYC/mandate; not in portfolio slice.", False),
        ("port-09", "Portfolio includes external CAS?", ["portfolio.status"], "Zynd portfolio vs CAS import separate."),
        ("port-10", "Gain shown is before tax?", ["portfolio.total_return"], "Returns before tax; not tax advice."),
        ("port-11", "One fund shows negative return", [], "Scheme-level return needs holding detail.", False),
        ("port-12", "Refresh portfolio pull to update", ["portfolio.as_on"], "Pull refresh; as_on updates after sync."),
    ]
    for item in portfolio:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["portfolio", "payment"] if slug == "port-05" else ["portfolio"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "Login with email OTP instead of password", ["account.has_password_login", "account.email_verified"], "Available sign-in methods from flags."),
        ("acc-02", "Update display name", [], "Settings → profile name."),
        ("acc-03", "Dark mode setting", [], "App appearance in settings."),
        ("acc-04", "Language Hindi in app", [], "App language settings if supported."),
        ("acc-05", "Rate limit on login attempts", ["account.account_status"], "Lockout after failed attempts; account_status."),
        ("acc-06", "Recover account without phone", ["account.email_verified", "account.google_account_linked"], "Email/Google recovery paths."),
        ("acc-07", "Add backup email", [], "Single primary email on account; change via Settings.", False),
        ("acc-08", "Security alert email not received", ["account.email_verified"], "Check spam; resend if email_verified false."),
        ("acc-09", "Use Zynd on two phones", [], "Same account multiple devices allowed with MFA."),
        ("acc-10", "Copy client id from profile", [], "Profile/support shows client id.", False),
        ("acc-11", "Disable referral emails", [], "Notification preferences."),
        ("acc-12", "Account under review", ["account.account_status"], "Quote status; support timeline not invented."),
        ("acc-13", "Switch from Apple to Google login", ["account.apple_account_linked", "account.google_account_linked"], "Link/unlink in Security; one account."),
        ("acc-14", "PIN forgot for app lock", [], "Reset PIN in Security or re-login."),
        ("acc-15", "Email typo at signup", ["account.email_verified"], "Fix before verify; contact support if locked.", False),
        ("acc-16", "Is my session still active?", [], "Sessions expire; re-login for security."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["account"], q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "Set goal for house down payment", ["goals.goals"], "Create in Goals; quote existing similar goal if any."),
        ("goal-02", "Monthly savings target for goal", ["goals.goals.target_amount"], "Target amount and progress from context."),
        ("goal-03", "Auto-invest into goal via SIP", ["goals.goals", "payments.sip_plans"], "Link SIP to goal in funding flow."),
        ("goal-04", "Goal not updating after redemption", ["goals.goals", "portfolio.current_value"], "Redemption lowers progress; quote goal amounts."),
        ("goal-05", "Share goal progress with family", ["goals.goals", "family_groups.groups"], "Family shared goals if in group."),
        ("goal-06", "Retirement goal calculator age 60", [], "Calculator inputs only; no personal advice."),
        ("goal-07", "Duplicate goal by mistake", ["goals.goals"], "Delete duplicate in Goals list."),
        ("goal-08", "Goal currency only INR?", [], "Goals in INR on Zynd India."),
    ]
    for slug, q, fields, sol in goals:
        topics = ["goals", "payment"] if slug == "goal-03" else ["goals"]
        if slug == "goal-05":
            topics = ["goals", "family"]
        if slug == "goal-04":
            topics = ["goals", "portfolio"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    family = [
        ("fam-01", "Family group invite not received", [], "Resend; check email/SMS of invitee."),
        ("fam-02", "Member left group  goals?", ["family_groups.groups", "goals.goals"], "Shared goals may unlink; quote groups."),
        ("fam-03", "Can family see my portfolio value?", [], "No portfolio sharing; shared goals only.", False),
        ("fam-04", "Two heads in same family group", ["family_groups.groups.my_role"], "Only one head; quote roles."),
        ("fam-05", "Invite parent to family", [], "Send invite from Family section."),
        ("fam-06", "Family chat feature", [], "Zynd has goals/groups not family chat.", False),
        ("fam-07", "Remove myself from family", [], "Leave group in Family settings."),
        ("fam-08", "Family SIP contribution tracking", ["family_groups.groups", "goals.goals"], "Track via shared goals not individual SIPs."),
    ]
    for item in family:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["family", "goals"] if slug == "fam-08" else ["family"]
        if slug == "fam-02":
            topics = ["family", "goals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    referrals = [
        ("ref-01", "Referral code case sensitive?", ["referrals.has_code"], "Enter exact code; has_code gate."),
        ("ref-02", "Friend signed up without code", ["referrals.signup_count"], "Cannot attach retroactively; playbook."),
        ("ref-03", "How many friends can I refer?", [], "No cap in context; referrals page."),
        ("ref-04", "Referral leaderboard", [], "Not in bot context."),
        ("ref-05", "Reward when friend only completes KYC", ["referrals.kyc_verified_count"], "Qualification stages from counts."),
        ("ref-06", "Referral link QR code", ["referrals.has_code"], "Share/QR on referrals page."),
        ("ref-07", "Old referral code after name change", ["referrals.has_code"], "Code tied to account; has_code."),
        ("ref-08", "Refer friend outside India", [], "Program for eligible signups per terms."),
    ]
    for slug, q, fields, sol in referrals:
        rows.append(_row(b, slug, ["referrals"], q, context_fields=fields, solution=sol))

    multi = [
        ("multi-01", ["kyc", "payment"], "KYC bank ok mandate fails", ["kyc.bank_verification_status", "payments.failed_sip_plans"], "Separate bank vs mandate errors."),
        ("multi-02", ["payment", "portfolio"], "Buy fund units not visible same day", ["payments.recent_orders", "portfolio.has_pending_orders"], "Pending allotment playbook."),
        ("multi-03", ["account", "payment"], "Logged in still payment asks login", [], "Session vs payment gateway cookie; retry.", False),
        ("multi-04", ["goals", "payment"], "Goal funded SIP cancelled", ["goals.goals", "payments.sip_plans.status"], "Goal progress stalls if SIP cancelled."),
        ("multi-05", ["referrals", "account"], "Referral email bounce", ["referrals.has_code", "account.email_verified"], "Fix email verification first."),
        ("multi-06", ["kyc", "portfolio"], "KYC incomplete portfolio from old employer?", ["kyc.overall_status", "portfolio.holdings_count"], "Holdings require completed KYC for new buys."),
        ("multi-07", ["family", "referrals"], "Refer spouse in same family group", ["family_groups.groups", "referrals.has_code"], "Separate accounts each need signup with code."),
        ("multi-08", ["payment", "account"], "OTP for payment but MFA device lost", ["account.mfa_enrolled"], "Recover MFA then retry consent.", False),
        ("multi-09", ["portfolio", "payment"], "Redeem to pay credit card bill", [], "Redemption to bank account only; no CC payout.", False),
        ("multi-10", ["kyc", "goals"], "Start goal before PAN in KYC", ["kyc.steps.pan", "goals.goals"], "PAN step required in KYC journey."),
        ("multi-11", ["account", "portfolio"], "App update broke portfolio view", ["portfolio.status"], "status error; retry update/relogin."),
        ("multi-12", ["kyc", "payment", "referrals"], "Friend path: signup KYC invest referral", ["referrals.signup_count", "kyc.overall_status"], "Explain funnel; quote own referral counts only."),
    ]
    for item in multi:
        slug, topics, q, fields, sol = item[0], item[1], item[2], item[3], item[4]
        can = item[5] if len(item) > 5 and isinstance(item[5], bool) else True
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    return rows


def batch_five_entries() -> list[dict]:
    """Batch 5: agent handoff, tickets, edge phrasing, regulatory tone, deeper MF ops."""
    b = 5
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "Talk to agent about KYC rejection", ["kyc.overall_status", "kyc.steps"], "Summarise status; offer human if step failed.", False),
        ("kyc-02", "KYC document upload keeps failing", ["kyc.steps", "kyc.readiness_reason"], "Which step; file size/format; retry Complete KYC."),
        ("kyc-03", "Is video KYC required?", ["kyc.overall_status", "kyc.readiness_code"], "Only if readiness_code indicates; else DigiLocker path."),
        ("kyc-04", "Update nominee after KYC complete", ["kyc.overall_status", "kyc.steps.nominee"], "Nominee changes via KYC update flow if allowed."),
        ("kyc-05", "KYC for NRI customer", ["account.country_code"], "Zynd India focus; country_code from account."),
        ("kyc-06", "Match KYC name with bank account name", ["kyc.bank_verification_status"], "Names must match; bank verification status."),
        ("kyc-07", "How secure is my KYC data?", [], "Encrypted storage; used for regulatory KYC only."),
        ("kyc-08", "KYC pending on holidays", ["kyc.status_last_updated_at"], "Processing may pause; quote last update."),
        ("kyc-09", "Can agent see my PAN number?", [], "Agents see masked/summary context only; never full PAN in chat."),
        ("kyc-10", "Duplicate KYC application", ["kyc.overall_status"], "One KYC journey per user; quote status."),
        ("kyc-11", "KYC approved email not received", ["kyc.overall_status", "account.email_verified"], "Check spam; status in app over email."),
        ("kyc-12", "Switch from manual KYC to DigiLocker", ["kyc.steps.digilocker"], "DigiLocker step in Complete KYC."),
        ("kyc-13", "Help  KYC page blank", ["kyc.overall_status"], "Refresh; try browser; escalate if persists.", False),
        ("kyc-14", "Father name mismatch in KYC", ["kyc.steps.personal"], "Fix personal details step before submit."),
        ("kyc-15", "KYC and risk profile order", ["kyc.overall_status"], "Complete KYC first; risk profile in dashboard."),
        ("kyc-16", "Withdraw KYC application", ["kyc.overall_status"], "Cannot withdraw submitted; support for edge cases.", False),
    ]
    for item in kyc:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["kyc", "account"] if slug in {"kyc-05", "kyc-11"} else ["kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    payment = [
        ("pay-01", "Speak to human about failed SIP", ["payments.last_sip_failure"], "Quote failure; human if unresolved.", False),
        ("pay-02", "Raise ticket for double debit", ["payments.recent_orders"], "List SIP orders; escalate.", False),
        ("pay-03", "Payment stuck on processing 3 days", ["payments.recent_orders"], "Order status and created_at; escalate.", False),
        ("pay-04", "Change payment method mid checkout", [], "Restart checkout with preferred method."),
        ("pay-05", "SIP on 31st vs 30th date", ["payments.sip_plans.next_installment_date"], "Quote scheduled next_installment_date."),
        ("pay-06", "Fund house rejected my purchase", ["payments.recent_orders.failure_reason"], "failure_reason on failed order."),
        ("pay-07", "Instant redemption facility", ["portfolio.holdings_count"], "Redemption timelines fund-specific; not instant unless in context.", False),
        ("pay-08", "Pay using someone else's UPI", [], "Payment must be from investor's linked bank/mandate."),
        ("pay-09", "SIP trigger if market falls", [], "SIP debits on schedule; not market-triggered unless product says."),
        ("pay-10", "Verify mandate on NPCI portal", ["payments.sip_plans.status"], "Mandate status in My SIPs; NPCI external."),
        ("pay-11", "Child's SIP from parent account", [], "Minor needs own account/KYC; cannot debit parent mandate for child.", False),
        ("pay-12", "GST on mutual fund fees", [], "Not tax advice; expense ratio on scheme factsheet."),
        ("pay-13", "Exit load on my redemption", [], "Scheme-specific; holding detail page.", False),
        ("pay-14", "Pause all SIPs at once", ["payments.sip_plans"], "List plans; pause each in My SIPs."),
        ("pay-15", "Payment success SMS but app pending", ["payments.recent_orders"], "Refresh Transactions; bank SMS can precede app sync."),
        ("pay-16", "Add new bank for payments only", ["kyc.steps.bank"], "Bank linked via KYC/bank verification."),
        ("pay-17", "International card payment", [], "Indian bank/UPI/mandate flows supported on Zynd India."),
        ("pay-18", "SIP in debt fund minimum", ["payments.sip_plans"], "Quote plan amount; scheme min on fund page."),
        ("pay-19", "Failed because KYC not complete", ["kyc.overall_status", "payments.recent_orders"], "Block invest until KYC completed."),
        ("pay-20", "Webhook delay on payment status", ["payments.recent_orders"], "Poll Transactions; status updates async."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["payment"]
        if slug in {"pay-07"}:
            topics = ["payment", "portfolio"]
        if slug == "pay-19":
            topics = ["payment", "kyc"]
        if slug == "pay-16":
            topics = ["payment", "kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    portfolio = [
        ("port-01", "Agent help read my portfolio", ["portfolio.current_value", "portfolio.holdings_count"], "Summarise; agent for discrepancies.", False),
        ("port-02", "Incorrect units in one scheme", ["portfolio.holdings_count"], "Escalate with folio from holding.", False),
        ("port-03", "Portfolio vs contract note", [], "Contract notes in Transactions/Reports."),
        ("port-04", "Show only equity holdings", [], "Filter asset class on Portfolio UI."),
        ("port-05", "Debt fund value dropped  why?", ["portfolio.total_return"], "Market/rate move; quote total_return not advice."),
        ("port-06", "Merge folios same PAN", [], "Contact AMC/consolidation; not self-serve in app.", False),
        ("port-07", "Historical portfolio chart missing", ["portfolio.as_on"], "Chart range in UI; as_on for data freshness."),
        ("port-08", "Zero units after partial redeem", ["portfolio.holdings_count", "payments.recent_orders"], "Remaining units after REDEMPTION order."),
        ("port-09", "Portfolio for closed account", ["account.account_status"], "If account not active, data access limited."),
        ("port-10", "Compare portfolio to Nifty 50", [], "Benchmark not in context pack."),
        ("port-11", "SIP investments vs portfolio cost", ["portfolio.invested", "portfolio.monthly_sip"], "Quote invested and monthly_sip fields."),
        ("port-12", "Holdings show wrong fund name", [], "Escalate screenshot; sync from registrar.", False),
    ]
    for item in portfolio:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["portfolio"]
        if slug == "port-09":
            topics = ["portfolio", "account"]
        if slug in {"port-08", "port-11"}:
            topics = ["portfolio", "payment"] if slug == "port-08" else ["portfolio", "payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "Connect me to support agent now", [], "Human handoff when bot cannot answer; stay in chat.", False),
        ("acc-02", "Support ticket status", [], "Help → tickets list; bot sees conversation not admin console.", False),
        ("acc-03", "Attach screenshot in help chat", [], "Use image attach in Help chat if enabled."),
        ("acc-04", "Support hours", [], "Bot 24/7; human agents business hours if escalated."),
        ("acc-05", "Escalate previous chat", [], "Open same ticket from Help tickets or new Message support."),
        ("acc-06", "Complaint number for SEBI", [], "Zynd grievance process first; regulatory escalation path in legal docs.", False),
        ("acc-07", "Report bug in app", [], "Describe in Help chat; attach screenshot."),
        ("acc-08", "Feedback on help bot answer", [], "Use thumbs/feedback if UI has it; rephrase question."),
        ("acc-09", "Chat history disappeared", [], "Tickets under Help Center history."),
        ("acc-10", "Resolved ticket but need more help", [], "Message support opens new conversation when prior resolved."),
        ("acc-11", "Agent assigned to my ticket", [], "Human handler after escalation; wait for agent reply."),
        ("acc-12", "Is support chat encrypted?", [], "HTTPS; do not share passwords/OTP in chat."),
        ("acc-13", "Call support phone number", [], "Chat-first support; phone if published on website."),
        ("acc-14", "Email support instead of chat", [], "Help chat preferred; email from Contact if listed."),
        ("acc-15", "Login from abroad", ["account.country_code"], "Access may work; investing rules India-focused."),
        ("acc-16", "Two-factor for every transaction", ["account.mfa_enrolled"], "Login MFA vs MF consent OTP separate."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["account"], q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "Is my emergency fund goal on track?", ["goals.goals.progress_pct"], "Quote progress for emergency-titled goal if exists."),
        ("goal-02", "Round-up spare change to goal", [], "Feature if available; else manual invest to goal."),
        ("goal-03", "Goal notification before target date", ["goals.goals.target_date"], "Quote target_date; enable reminders in Goals."),
        ("goal-04", "Transfer goal to another user", [], "Goals not transferable; family shared goals alternative."),
        ("goal-05", "Tax saving goal ELSS link", ["goals.goals"], "ELSS is scheme choice; goal tracks amount not tax advice."),
        ("goal-06", "Multiple SIPs one goal", ["goals.goals", "payments.sip_plans"], "Several SIPs can fund one goal if linked."),
        ("goal-07", "Goal progress after market crash", ["goals.goals", "portfolio.current_value"], "Progress uses funded amount vs market label."),
        ("goal-08", "Default goal when investing", ["goals.goals"], "Optional link at invest; list goals in context."),
    ]
    for slug, q, fields, sol in goals:
        topics = ["goals"]
        if slug in {"goal-06", "goal-07"}:
            topics = ["goals", "payment"] if slug == "goal-06" else ["goals", "portfolio"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=slug != "goal-04"))

    family = [
        ("fam-01", "Family goal contribution split", ["family_groups.groups", "goals.goals"], "Shared goal progress; not payment split in context."),
        ("fam-02", "Privacy settings in family group", [], "Members see shared goals not individual portfolios."),
        ("fam-03", "Block a member from family group", ["family_groups.groups.my_role"], "Head can remove member; quote role."),
        ("fam-04", "Family invite spam", [], "Only send invite to intended email/phone."),
        ("fam-05", "Under 18 in family investing", [], "Minor accounts need guardian KYC separately."),
        ("fam-06", "Merge two family groups", [], "Not supported; pick one group.", False),
        ("fam-07", "Family head passed away", [], "Sensitive: contact support for account succession.", False),
        ("fam-08", "See who invited me to family", [], "Invite shows inviter in Family pending UI."),
    ]
    for item in family:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["family", "goals"] if slug == "fam-01" else ["family"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    referrals = [
        ("ref-01", "Referral counted twice same friend", ["referrals.signup_count"], "One signup per friend; quote count.", False),
        ("ref-02", "Referral after account suspension", ["account.account_status", "referrals.has_code"], "Suspended account may block rewards."),
        ("ref-03", " influencer referral program", ["referrals.has_code"], "Standard referral page; no special influencer context."),
        ("ref-04", "Referral in WhatsApp group", ["referrals.has_code"], "Share link from referrals page."),
        ("ref-05", "Friend deleted account referral lost", ["referrals.signup_count"], "Counts historical; re-signup rules on referrals page."),
        ("ref-06", "Referral bonus timeline 30 days", [], "Qualification hold in program terms; not invented.", False),
        ("ref-07", "Corporate referral batch codes", [], "Single user code unless enterprise program published."),
        ("ref-08", "Referral analytics export", ["referrals.click_count"], "Quote clicks; export from referrals UI if any."),
    ]
    for item in referrals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["referrals", "account"] if slug == "ref-02" else ["referrals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    multi = [
        ("multi-01", ["account", "kyc"], "Agent review my KYC status", ["kyc.overall_status", "kyc.steps"], "Bot summary then human if needed.", False),
        ("multi-02", ["payment", "account"], "Human for payment dispute", ["payments.recent_orders"], "Escalate with order facts.", False),
        ("multi-03", ["portfolio", "account"], "Wrong portfolio  need agent", ["portfolio.status"], "Refresh; escalate if status error.", False),
        ("multi-04", ["kyc", "payment", "portfolio"], "New user zero holdings after week", ["kyc.overall_status", "payments.recent_orders", "portfolio.holdings_count"], "Timeline KYC→pay→allotment."),
        ("multi-05", ["referrals", "kyc", "payment"], "Refer friend who cannot complete KYC", ["referrals.kyc_verified_count"], "Friend must complete own KYC."),
        ("multi-06", ["family", "kyc", "payment"], "Pay SIP for child in family group", ["family_groups.groups"], "Each investor own mandate.", False),
        ("multi-07", ["goals", "payment", "kyc"], "Goal invest blocked", ["kyc.overall_status", "goals.goals"], "KYC gate before funding goal."),
        ("multi-08", ["account", "payment"], "Resolved ticket payment still failing", ["payments.recent_orders"], "New chat; quote latest order failure."),
        ("multi-09", ["portfolio", "payment", "kyc"], "Redeem without fresh KYC", ["kyc.overall_status", "portfolio.holdings_count"], "Redeem may need valid KYC; quote statuses."),
        ("multi-10", ["referrals", "account"], "Referral link wrong account logged in", ["referrals.has_code", "account.google_account_linked"], "Share from logged-in referrer account."),
        ("multi-11", ["kyc", "account"], "DigiLocker works web not mobile app", ["kyc.steps.digilocker"], "Try embed return path; same KYC journey."),
        ("multi-12", ["payment", "portfolio", "account"], "Full support checklist debit no units", ["payments.recent_orders", "portfolio.has_pending_orders", "account.phone_verified"], "Verify contact, order status, pending allotment, then agent.", False),
    ]
    for item in multi:
        slug, topics, q, fields, sol = item[0], item[1], item[2], item[3], item[4]
        can = item[5] if len(item) > 5 and isinstance(item[5], bool) else True
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    return rows


def batch_six_entries() -> list[dict]:
    """Batch 6: explore/invest UX, schemes/NFO, notifications, paraphrase density."""
    b = 6
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "Complete KYC on mobile browser", ["kyc.last_completed_step"], "Resume Complete KYC; progress saved."),
        ("kyc-02", "KYC iframe blank after DigiLocker", ["kyc.steps.digilocker"], "Retry embed return; check popup blockers."),
        ("kyc-03", "Why PAN photo required", ["kyc.steps.pan"], "PAN verification step requirement."),
        ("kyc-04", "KYC for senior citizen", ["kyc.overall_status"], "Same journey; no age shortcut in context."),
        ("kyc-05", "Update mobile in KYC contact", ["kyc.steps.personal", "account.phone_verified"], "Personal/contact step vs phone_verified flag."),
        ("kyc-06", "KYC status shows none  never started?", ["kyc.overall_status"], "If none, open Complete KYC from dashboard."),
        ("kyc-07", "Can I skip nominee?", ["kyc.steps.nominee"], "Nominee step status; regulatory requirement tone."),
        ("kyc-08", "KYC failed CKYC match", ["kyc.external_kyc_status"], "Quote external_kyc_status; retry/support."),
        ("kyc-09", "How to download KYC acknowledgement", [], "Acknowledgement in app after submit if available.", False),
        ("kyc-10", "KYC and FATCA declaration", ["kyc.steps.personal"], "Part of personal/review steps in journey."),
        ("kyc-11", "Spouse name in KYC", ["kyc.steps.personal"], "Personal details fields in step status."),
        ("kyc-12", "KYC verification call from bank", [], "Bank may verify separately; Zynd status in app."),
        ("kyc-13", "Reopen KYC after completed", ["kyc.overall_status"], "Updates via KYC modify flow if product allows."),
        ("kyc-14", "KYC address proof not Aadhaar", ["kyc.steps.address"], "Address step alternatives per form."),
        ("kyc-15", "Help bot says KYC incomplete but I finished", ["kyc.overall_status", "kyc.status_last_updated_at"], "Refresh; quote status and last update."),
        ("kyc-16", "KYC for HUF or company", [], "Retail individual accounts only on Zynd consumer app.", False),
    ]
    for item in kyc:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["kyc", "account"] if slug == "kyc-05" else ["kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    payment = [
        ("pay-01", "Explore page fund not in portfolio", ["portfolio.holdings_count"], "Explore is catalog; buy to add holdings."),
        ("pay-02", "Invest ₹5000 lumpsum today", ["payments.recent_orders"], "Place order in invest flow; confirm via recent order."),
        ("pay-03", "SIP start date tomorrow", ["payments.sip_plans.next_installment_date"], "Schedule shows next_installment_date after setup."),
        ("pay-04", "Add to cart vs buy now difference", [], "Cart batches checkout; buy now single order."),
        ("pay-05", "Remove item from cart", [], "Cart screen remove before checkout."),
        ("pay-06", "NFO closed but still showing", [], "NFO windows on scheme page; catalog lifecycle."),
        ("pay-07", "SIP in ELSS for 80C", [], "ELSS tax saving is scheme type; not tax advice."),
        ("pay-08", "Payment page spinning loader", ["payments.recent_orders"], "Wait; check if order created in Transactions."),
        ("pay-09", "Use two bank accounts for SIPs", ["payments.sip_plans"], "Each plan/mandate tied to one bank."),
        ("pay-10", "Order rejected after market hours", ["payments.recent_orders.failure_reason"], "failure_reason may cite cut-off."),
        ("pay-11", "SIP amount rounded up", ["payments.last_sip_debit.amount", "payments.sip_plans"], "Compare debit to plan amount."),
        ("pay-12", "Failed because investor profile pending", ["kyc.overall_status"], "Complete KYC and investor profile readiness."),
        ("pay-13", "Pay from joint account", ["kyc.steps.bank"], "Bank must match KYC single/joint rules."),
        ("pay-14", "Cancel SIP before first debit", ["payments.sip_plans.status"], "Cancel pending plan in My SIPs."),
        ("pay-15", "Lumpsum failed insufficient funds", ["payments.recent_orders.failure_reason"], "Quote failure_reason."),
        ("pay-16", "Track NFO allotment status", ["payments.recent_orders"], "Order status until allotted/settled."),
        ("pay-17", "SIP on last day of month", ["payments.sip_plans.next_installment_date"], "Debit date from plan schedule."),
        ("pay-18", "Payment OTP expired", [], "Resend consent OTP in invest dialog."),
        ("pay-19", "Buy same fund twice same day", ["payments.recent_orders"], "List two orders same day if present."),
        ("pay-20", "Mandate e-sign separate from KYC e-sign", ["payments.sip_plans"], "Mandate authorization in SIP setup flow."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        topics = ["payment"]
        if slug in {"pay-01", "pay-12"}:
            topics = ["payment", "portfolio"] if slug == "pay-01" else ["payment", "kyc"]
        if slug == "pay-13":
            topics = ["payment", "kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    portfolio = [
        ("port-01", "Search fund in portfolio", ["portfolio.holdings_count"], "Search on Portfolio holdings list."),
        ("port-02", "Sort holdings by return", ["portfolio.total_return"], "Sort in UI; total_return is aggregate."),
        ("port-03", "Direct vs regular plan in holdings", [], "Plan type on scheme detail if shown.", False),
        ("port-04", "IDCW vs growth in my funds", [], "Scheme option on holding detail page."),
        ("port-05", "Portfolio empty after migration", ["portfolio.status", "portfolio.holdings_count"], "status and count; support if wrong.", False),
        ("port-06", "Show only SIP-funded holdings", [], "Filter or tag not in summary context.", False),
        ("port-07", "Annual portfolio statement email", [], "Reports/notifications preferences."),
        ("port-08", "Compare my return to FD rate", [], "Not personalized advice; quote total_return only."),
        ("port-09", "Units in decimal places", ["portfolio.holdings_count"], "Units shown to AMC precision on holding."),
        ("port-10", "Portfolio after account merge", ["portfolio.holdings_count"], "Escalate merge cases.", False),
        ("port-11", "Market crash portfolio red", ["portfolio.total_return", "portfolio.current_value"], "Explain mark-to-market using fields."),
        ("port-12", "Refresh holdings after switch", ["payments.recent_orders", "portfolio.as_on"], "SWITCH order status then as_on refresh."),
    ]
    for item in portfolio:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["portfolio", "payment"] if slug == "port-12" else ["portfolio"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "Turn on order fill notifications", [], "Notification preferences for orders."),
        ("acc-02", "Email when SIP debits", [], "Enable payment/SIP alerts in settings."),
        ("acc-03", "SMS alerts cost money?", [], "Carrier rates may apply; Zynd SMS for OTP/security."),
        ("acc-04", "Update notification email", ["account.email_verified"], "Change email in Settings; verify new email."),
        ("acc-05", "Quiet hours for push", [], "Do Not Disturb / OS settings."),
        ("acc-06", "Marketing emails unsubscribe", [], "Unsubscribe link or notification prefs."),
        ("acc-07", "Verify new device login alert", ["account.mfa_enrolled"], "MFA and email alerts on new device."),
        ("acc-08", "App version too old for invest", [], "Update app from store for latest invest flows."),
        ("acc-09", "Clear app cache portfolio wrong", ["portfolio.as_on"], "Cache clear; refresh portfolio as_on."),
        ("acc-10", "Use Zynd on tablet", [], "Responsive web/app support."),
        ("acc-11", "Accessibility font size", [], "OS accessibility settings."),
        ("acc-12", "Copy OTP from SMS autofill", [], "Use autofill carefully; never share OTP."),
        ("acc-13", "Account flagged for review", ["account.account_status"], "Quote account_status; support follow-up."),
        ("acc-14", "Change timezone display", [], "Dates shown in user locale/IST for India product."),
        ("acc-15", "Link email after Apple signup", ["account.apple_account_linked", "account.email_verified"], "Add/verify email in Settings."),
        ("acc-16", "Help bot vs human  who answers?", [], "Bot first; agent after escalation or complex cases."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        topics = ["account", "portfolio"] if slug == "acc-09" else ["account"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    goals = [
        ("goal-01", "Vacation goal in 12 months", ["goals.goals.target_date"], "Create goal with target_date 12mo out."),
        ("goal-02", "Increase goal target mid-way", ["goals.goals.target_amount"], "Edit target in Goals."),
        ("goal-03", "Goal vs actual spend tracking", ["goals.goals.current_amount"], "Quote current_amount vs target."),
        ("goal-04", "Hide completed goals", ["goals.goals.status"], "Filter/archive completed in Goals."),
        ("goal-05", "SIP calculator linked to goal", ["goals.goals"], "Run calculator then create/link goal."),
        ("goal-06", "Goal nudge if behind schedule", ["goals.goals.progress_pct"], "progress_pct vs time to target_date."),
        ("goal-07", "Education goal for child", ["goals.goals"], "Personal goal title; family optional."),
        ("goal-08", "Zero goals  should I create one?", ["goals.goals"], "Optional; list if empty in context."),
    ]
    for slug, q, fields, sol in goals:
        rows.append(_row(b, slug, ["goals"], q, context_fields=fields, solution=sol))

    family = [
        ("fam-01", "Ping family member to complete KYC", ["family_groups.groups"], "Each member own KYC; invite reminder only."),
        ("fam-02", "Family dashboard for head", ["family_groups.groups.my_role"], "Head sees group admin; not member portfolios."),
        ("fam-03", "Duplicate family invite sent", [], "Cancel pending duplicate invite."),
        ("fam-04", "Family group for siblings only", ["family_groups.groups"], "Any invited members per product rules."),
        ("fam-05", "Leave family keep personal goals", ["family_groups.groups", "goals.goals"], "Personal goals remain; shared may unlink."),
        ("fam-06", "Family member changed phone", [], "They update on their account."),
        ("fam-07", "Report abuse in family group", [], "Contact support; leave group.", False),
        ("fam-08", "Family goals vs personal goals list", ["goals.goals", "family_groups.groups"], "Distinguish shared vs personal in Goals UI."),
    ]
    for item in family:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["family", "goals"] if slug in {"fam-05", "fam-08"} else ["family"]
        if slug == "fam-01":
            topics = ["family", "kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    referrals = [
        ("ref-01", "Referral banner in app home", ["referrals.has_code"], "Referrals section from dashboard."),
        ("ref-02", "Paste referral code at login", [], "Code at signup/email step not after account created.", False),
        ("ref-03", "Referral for existing users", ["referrals.has_code"], "Existing users cannot be referred; share for new signups."),
        ("ref-04", "Track referral in app widget", ["referrals.click_count", "referrals.signup_count"], "Quote counts from context."),
        ("ref-05", "Referral program ended?", [], "Active if has_code and referrals page loads."),
        ("ref-06", "Gift card instead of referral cash", [], "Rewards per program terms on referrals page."),
        ("ref-07", "Refer colleague same company email domain", ["referrals.has_code"], "Each person unique account with code at signup."),
        ("ref-08", "Referral help bot question", ["referrals.has_code"], "Explain share link; quote has_code."),
    ]
    for item in referrals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["referrals"], q, context_fields=fields, solution=sol, can_answer=can))

    multi = [
        ("multi-01", ["payment", "portfolio"], "Bought fund not in explore search", ["portfolio.holdings_count"], "Explore catalog vs owned holdings."),
        ("multi-02", ["kyc", "payment"], "Invest button greyed KYC done", ["kyc.overall_status", "kyc.readiness_code"], "Check readiness_code and investor profile."),
        ("multi-03", ["account", "payment"], "Notifications off missed failed SIP", ["payments.last_sip_failure"], "Enable alerts; quote last failure."),
        ("multi-04", ["goals", "payment"], "Goal 100% but SIP still running", ["goals.goals", "payments.sip_plans"], "Cancel or redirect SIP after goal met."),
        ("multi-05", ["referrals", "kyc"], "Refer before my KYC done", ["referrals.has_code", "kyc.overall_status"], "Referral share independent; friend needs own KYC."),
        ("multi-06", ["family", "goals", "payment"], "Family goal SIP who pays", ["family_groups.groups", "goals.goals"], "Each member funds own account/SIP."),
        ("multi-07", ["portfolio", "payment", "kyc"], "First investment checklist explore to units", ["kyc.overall_status", "payments.recent_orders", "portfolio.has_pending_orders"], "KYC → order → pending allotment."),
        ("multi-08", ["account", "kyc"], "New email unverified blocks KYC", ["account.email_verified", "kyc.overall_status"], "Verify email then Complete KYC."),
        ("multi-09", ["payment", "portfolio"], "Switch order done holdings old fund still shows", ["payments.recent_orders", "portfolio.as_on"], "SWITCH processing; refresh after as_on."),
        ("multi-10", ["referrals", "payment"], "Refer friend SIP counts for reward", ["referrals.first_investment_count"], "Friend first investment count qualifies."),
        ("multi-11", ["kyc", "account"], "DigiLocker mobile ok desktop fail", ["kyc.steps.digilocker"], "Same account; try other browser/device."),
        ("multi-12", ["payment", "account", "portfolio"], "Help me understand my first statement", ["payments.recent_orders", "portfolio.invested"], "Walk through one order and invested total."),
    ]
    for item in multi:
        slug, topics, q, fields, sol = item[0], item[1], item[2], item[3], item[4]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    return rows


def batch_seven_entries() -> list[dict]:
    """Batch 7: out-of-scope boundaries, compliance tone, dense paraphrase bank."""
    b = 7
    rows: list[dict] = []

    def add(topic_list: list[str], items: list[tuple]) -> None:
        for item in items:
            slug, q, fields, sol = item[0], item[1], item[2], item[3]
            can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
            rows.append(_row(b, slug, topic_list, q, context_fields=fields, solution=sol, can_answer=can))

    add(["kyc"], [
        ("kyc-01", "What stock should I buy?", [], "Out of scope: no investment advice; MF account help only.", False),
        ("kyc-02", "Is my Aadhaar number stored?", [], "Stored securely for KYC compliance; never ask customer to type full Aadhaar in chat."),
        ("kyc-03", "KYC for US citizen OCI", ["account.country_code"], "India MF for eligible residents; country_code context."),
        ("kyc-04", "Update KYC after marriage name change", ["kyc.overall_status"], "KYC update flow for name change."),
        ("kyc-05", "KYC selfie video step", ["kyc.steps"], "Only steps in context; no video if not in steps."),
        ("kyc-06", "Why KYC needs bank proof", ["kyc.steps.bank"], "Regulatory payout account verification."),
        ("kyc-07", "KYC pending over 30 days", ["kyc.status_last_updated_at", "kyc.overall_status"], "Quote status; escalate if submitted too long.", False),
        ("kyc-08", "Help  OTP on KYC bank verify", ["kyc.bank_verification_status"], "Bank penny drop/OTP on bank step."),
        ("kyc-09", "Scanned PDF for address ok?", ["kyc.steps.address"], "Use accepted formats in Complete KYC UI."),
        ("kyc-10", "KYC for minor child account", [], "Separate minor/guardian flow if product supports.", False),
        ("kyc-11", "Print KYC form offline", [], "Digital journey in app only."),
        ("kyc-12", "KYC agent callback request", ["kyc.overall_status"], "Summarise; human callback via escalation.", False),
        ("kyc-13", "PEP declaration in KYC", ["kyc.steps.personal"], "Personal/review disclosures in journey."),
        ("kyc-14", "KYC locked cannot edit", ["kyc.overall_status"], "Submitted/under review may lock edits."),
        ("kyc-15", "Verify KYC on call  is it legit?", [], "Zynd never asks for full PAN/password on phone; use in-app only."),
        ("kyc-16", "KYC status API for my app", [], "Consumer app only; no developer API in help scope.", False),
    ])
    add(["payment"], [
        ("pay-01", "Which mutual fund will double money?", [], "No return promises; educate not advise.", False),
        ("pay-02", "SIP band karo abhi", ["payments.sip_plans.status"], "Reply English: cancel/pause in My SIPs; quote status."),
        ("pay-03", "Last month SIP kitne ka kata", ["payments.last_sip_debit.amount", "payments.last_sip_debit.settled_at"], "Hinglish: last debit amount and date."),
        ("pay-04", "Payment fraud on my account", ["payments.recent_orders"], "List unknown orders; escalate immediately.", False),
        ("pay-05", "Chargeback on UPI SIP", ["payments.last_sip_failure"], "Quote failure; bank chargeback process.", False),
        ("pay-06", "Invest salary day every month", ["payments.sip_plans.next_installment_date"], "Set SIP date in plan schedule."),
        ("pay-07", "Lumpsum today NAV guaranteed?", [], "NAV applicable per cut-off; no guarantee."),
        ("pay-08", "SIP failed thrice in row", ["payments.failed_sip_plans", "payments.last_sip_failure"], "Pattern from failed plans and last failure."),
        ("pay-09", "Pay with credit card for MF", [], "Supported methods per checkout; typically bank/UPI mandate."),
        ("pay-10", "Order amount edited after submit", ["payments.recent_orders"], "Cannot change submitted order; cancel if allowed and re-place.", False),
        ("pay-11", "SIP on 29th Feb schedule", ["payments.sip_plans.next_installment_date"], "Monthly date rolls per calendar rules in plan."),
        ("pay-12", "Bulk redeem all funds", ["portfolio.holdings_count"], "Redeem each holding or full redeem flow.", False),
        ("pay-13", "Payment receipt download", ["payments.recent_orders"], "Receipt in Transactions for succeeded orders."),
        ("pay-14", "Third party paying my SIP", [], "Payer must be account holder bank/mandate.", False),
        ("pay-15", "Failed  risk profile expired", [], "Renew risk profile in dashboard then retry."),
        ("pay-16", "Weekend payment processing", ["payments.recent_orders"], "Orders may queue until next business processing."),
        ("pay-17", "SIP in direct plan only", [], "Plan type on scheme page at invest time."),
        ("pay-18", "Payment link expired", ["payments.recent_orders"], "Start new payment from order in Transactions."),
        ("pay-19", "Auto increase SIP 10% yearly", [], "Step-up if product feature; else manual increase.", False),
        ("pay-20", "Why AMC rejected purchase", ["payments.recent_orders.failure_reason"], "failure_reason text from order."),
    ])
    for row in rows:
        if row["id"] == "b007-pay-12":
            row["topics"] = ["payment", "portfolio"]

    add(["portfolio"], [
        ("port-01", "Predict next year portfolio return", [], "No predictions; quote past total_return only.", False),
        ("port-02", "Best fund in my portfolio", [], "No ranking advice without holdings detail.", False),
        ("port-03", "Portfolio loan against MF", [], "Not a Zynd lending product in help scope.", False),
        ("port-04", "Show P&L tax lot wise", [], "Tax lots in reports if available; not tax advice.", False),
        ("port-05", "Crypto in portfolio", [], "Zynd MF only; no crypto holdings.", False),
        ("port-06", "Insurance policy in portfolio", [], "MF holdings only in portfolio context."),
        ("port-07", "Duplicate folio same scheme", [], "Possible across purchases; see holding folios.", False),
        ("port-08", "Portfolio benchmark Nifty 50", [], "Benchmark in UI if shown; not in context pack."),
        ("port-09", "Smallcase vs my portfolio", [], "Zynd holdings only; external smallcase separate."),
        ("port-10", "Demat mutual funds showing", ["portfolio.holdings_count"], "MF folio holdings not demat unless product says."),
        ("port-11", "Portfolio value at 9am IST", ["portfolio.as_on"], "as_on timestamp explains last refresh."),
        ("port-12", "Export for CA tax filing", [], "Statements/reports for CA; bot does not file tax.", False),
    ])
    add(["account"], [
        ("acc-01", "Give me your API key", [], "Never share secrets; no API keys in consumer support.", False),
        ("acc-02", "Change password via chat", [], "Password change only in app sign-in/settings; bot cannot.", False),
        ("acc-03", "Is Zynd SEBI registered?", [], "Regulatory disclosures on website; bot cites no fake registration numbers.", False),
        ("acc-04", "Share my password to fix login", [], "Never share password; reset via forgot password.", False),
        ("acc-05", "Phishing email pretending Zynd", [], "Check sender domain; login only via official app/site."),
        ("acc-06", "Account hacked move money", ["account.account_status"], "Lock: reset creds, MFA, escalate urgent.", False),
        ("acc-07", "GDPR data delete request", [], "Deletion flow in Settings/privacy policy.", False),
        ("acc-08", "Use VPN to login India", ["account.country_code"], "Access may work; investing India rules apply."),
        ("acc-09", "Bot store chat forever?", [], "Support tickets retained per policy; no invented retention period."),
        ("acc-10", "Turnstile captcha failing signup", [], "Retry signup; disable VPN; refresh.", False),
        ("acc-11", "Referral code in password field", [], "Referral at signup only not password.", False),
        ("acc-12", "Login with client id", [], "Login with email/phone/Google/Apple.", False),
        ("acc-13", "Account dormant reactivate", ["account.account_status"], "Quote status; sign in and complete KYC if needed."),
        ("acc-14", "Whatsapp login to Zynd", [], "WhatsApp not a sign-in method on Zynd.", False),
        ("acc-15", "Share screen with agent", [], "Agent may request screenshot upload in chat.", False),
        ("acc-16", "Legal notice to Zynd", [], "Escalate to support/legal channel.", False),
    ])
    add(["goals"], [
        ("goal-01", "Guarantee goal will be met", [], "Goals track progress; no guaranteed returns.", False),
        ("goal-02", "Goal for bitcoin savings", [], "MF goals only; no crypto goal.", False),
        ("goal-03", "Move goal to friend's account", [], "Goals not transferable.", False),
        ("goal-04", "Goal based on inflation 7%", [], "Calculator assumptions user-controlled; not advice.", False),
        ("goal-05", "Auto goal from salary credit", [], "Link SIP to goal manually; no salary hook in context.", False),
        ("goal-06", "Goal progress includes unrealized gains", ["goals.goals", "portfolio.current_value"], "Clarify funded amount vs market value labels."),
        ("goal-07", "Set 50 goals max", ["goals.goals"], "List count from context; product limit in UI.", False),
        ("goal-08", "Goal reminder push not working", [], "Check notification permissions.", False),
    ])
    add(["family"], [
        ("fam-01", "Family member see my password", [], "Never share credentials; separate logins.", False),
        ("fam-02", "Sue family member over group", [], "Not legal advice; leave group/support.", False),
        ("fam-03", "Family portfolio total net worth", [], "No aggregated net worth in context.", False),
        ("fam-04", "Invite 50 members", ["family_groups.groups.member_count"], "Quote member_count; product limits in UI.", False),
        ("fam-05", "Family trading tips group", [], "Not investment advice channel.", False),
        ("fam-06", "Minor trading without parent", [], "Minors need guardian account.", False),
        ("fam-07", "Family KYC shared document", [], "Each member own KYC; no shared KYC.", False),
        ("fam-08", "Export family member list PII", [], "No PII export of other members in bot.", False),
    ])
    add(["referrals"], [
        ("ref-01", "Guaranteed ₹1000 referral", [], "No invented reward amounts; referrals page.", False),
        ("ref-02", "Referral pyramid scheme", [], "Single-level referral program only.", False),
        ("ref-03", "Buy referral signups", [], "Fraud prohibited; organic signups only.", False),
        ("ref-04", "Referral code leaked publicly", ["referrals.has_code"], "Rotate/regenerate if feature exists; monitor signups.", False),
        ("ref-05", "Referral in newspaper ad", [], "Share official link; follow program terms.", False),
        ("ref-06", "Referral tax 30% TDS", [], "Not tax advice; program terms.", False),
        ("ref-07", "Referral for NRI friend", [], "Friend must meet signup eligibility.", False),
        ("ref-08", "Hack referral counts", [], "Counts system-tracked; fraud escalates.", False),
    ])
    multi_items = [
        ("multi-01", ["kyc", "payment"], "Is this chat investment advice?", [], "Educational account help only; not personalized advice.", False),
        ("multi-02", ["account", "payment"], "Scam call asked UPI for KYC", [], "Never pay UPI for KYC; report scam.", False),
        ("multi-03", ["portfolio", "payment"], "Guaranteed 20% return fund", [], "No guarantees; quote historical total_return if asked factually.", False),
        ("multi-04", ["referrals", "account"], "Referral bot spam messages", [], "Use official share; report abuse.", False),
        ("multi-05", ["kyc", "account"], "Share PAN in chat to verify", [], "Never type full PAN; use in-app KYC.", False),
        ("multi-06", ["payment", "portfolio"], "Insider tip on NAV", [], "Out of scope; no insider information.", False),
        ("multi-07", ["goals", "portfolio"], "Will I reach crore by 40", [], "Calculator hypothetical only; no promise.", False),
        ("multi-08", ["family", "referrals"], "Refer entire family group", ["referrals.has_code", "family_groups.groups"], "Each signup uses code individually."),
        ("multi-09", ["kyc", "payment", "portfolio"], "Safe to invest all savings today", [], "Not personalized advice; diversification user decision.", False),
        ("multi-10", ["account", "kyc"], "Email phishing with KYC link", [], "Use only app/official domain links.", False),
        ("multi-11", ["payment", "account"], "Ransomware locked phone  SIP?", ["payments.sip_plans"], "Secure device; SIP continues on mandate if active."),
        ("multi-12", ["kyc", "payment", "account"], "What will you never ask in chat", [], "Never password, full PAN, OTP, card CVV."),
    ]
    for item in multi_items:
        slug, topics, q, fields, sol = item[0], item[1], item[2], item[3], item[4]
        can_map = {
            "multi-01": True, "multi-02": True, "multi-03": True, "multi-04": True, "multi-05": True,
            "multi-06": False, "multi-07": False, "multi-08": True, "multi-09": False, "multi-10": True,
            "multi-11": True, "multi-12": True,
        }
        can = can_map.get(slug, True)
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    return rows


def batch_eight_entries() -> list[dict]:
    """Batch 8: operational depth, sync/errors, positive resolution paths, variant phrasing."""
    b = 8
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "Refresh KYC status button", ["kyc.overall_status", "kyc.status_last_updated_at"], "Pull to refresh Complete KYC page."),
        ("kyc-02", "KYC step checkmarks meaning", ["kyc.steps"], "Explain each step status from steps object."),
        ("kyc-03", "Upload PNG signature", ["kyc.steps.signature"], "Accepted formats in signature step."),
        ("kyc-04", "KYC after changing phone number", ["account.phone_verified", "kyc.overall_status"], "Verify phone then continue KYC if needed."),
        ("kyc-05", "Joint holder KYC", [], "Individual account KYC per holder on their login.", False),
        ("kyc-06", "KYC support chat screenshot", [], "Attach redacted screenshot in Help chat.", False),
        ("kyc-07", "Readiness code meaning", ["kyc.readiness_code", "kyc.readiness_reason"], "Quote both fields plainly."),
        ("kyc-08", "External KYC pending from registrar", ["kyc.external_kyc_status"], "external_kyc_status only."),
        ("kyc-09", "Complete KYC on iPad", ["kyc.last_completed_step"], "Same web/app journey; resume supported."),
        ("kyc-10", "KYC email confirmation", ["account.email_verified", "kyc.overall_status"], "Verify email parallel to KYC."),
        ("kyc-11", "Nominee percentage split 50-50", ["kyc.steps.nominee"], "Nominee step rules in form UI."),
        ("kyc-12", "Bank IFSC not found", ["kyc.steps.bank"], "Re-enter IFSC; bank step validation."),
        ("kyc-13", "KYC timeout session expired", ["kyc.last_completed_step"], "Resume; progress saved."),
        ("kyc-14", "Compare my KYC to friend's", [], "Only customer's own KYC context.", False),
        ("kyc-15", "KYC for gift investment", ["kyc.overall_status"], "Gifts still require recipient own KYC account.", False),
        ("kyc-16", "Help text on review step", ["kyc.steps.review", "kyc.overall_status"], "Review before submit; overall moves to submitted."),
    ]
    for item in kyc:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["kyc", "account"] if slug in {"kyc-04", "kyc-10"} else ["kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    payment = [
        ("pay-01", "Sync payment status now", ["payments.recent_orders"], "Refresh Transactions; async webhook update."),
        ("pay-02", "SIP debit notification late", ["payments.last_sip_debit.settled_at"], "Debit time vs notification delay."),
        ("pay-03", "Order success email missing", ["payments.recent_orders"], "Check spam; status in app authoritative."),
        ("pay-04", "Duplicate order same fund same day", ["payments.recent_orders"], "List orders; cancel duplicate if pending.", False),
        ("pay-05", "Invest from watchlist", [], "Watchlist to invest flow in app."),
        ("pay-06", "SIP consent OTP resend limit", [], "Wait cooldown; retry consent panel."),
        ("pay-07", "Payment method saved cards", [], "Indian MF flows use bank/mandate not saved cards typically."),
        ("pay-08", "Partial lumpsum amount edit", [], "Edit before submit only."),
        ("pay-09", "SIP active but no debit yet", ["payments.sip_plans.next_installment_date"], "First debit on next_installment_date."),
        ("pay-10", "Failed order retry button", ["payments.recent_orders"], "Retry payment on failed/pending order."),
        ("pay-11", "Cart expired items", [], "Re-add funds to cart from explore."),
        ("pay-12", "Payment success portfolio pending", ["payments.recent_orders", "portfolio.has_pending_orders"], "Normal pending allotment window."),
        ("pay-13", "Mandate status pending bank", ["payments.sip_plans.status"], "Plan status until mandate active."),
        ("pay-14", "Change SIP fund scheme", [], "Cancel and create new SIP or switch flows.", False),
        ("pay-15", "Refund UTR number", [], "UTR from bank SMS; escalate if debited no order.", False),
        ("pay-16", "SIP daily plan status", ["payments.sip_plans.frequency", "payments.sip_plans.status"], "Quote frequency and status."),
        ("pay-17", "Lumpsum + SIP same fund same day", ["payments.recent_orders"], "Two orders allowed; list both."),
        ("pay-18", "Payment while traveling abroad", [], "UPI/mandate may fail abroad; Indian bank required."),
        ("pay-19", "Order history export CSV", [], "Transactions export if UI provides."),
        ("pay-20", "Zero balance bank SIP debit", ["payments.last_sip_failure.failure_reason"], "Insufficient funds in failure_reason."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["payment", "portfolio"] if slug == "pay-12" else ["payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    portfolio = [
        ("port-01", "Pull refresh portfolio stuck", ["portfolio.status"], "status loading; retry or escalate.", False),
        ("port-02", "Holdings count wrong number", ["portfolio.holdings_count"], "Reconcile with list; escalate.", False),
        ("port-03", "Current value rounded", ["portfolio.current_value"], "Display rounding; precise in holding detail."),
        ("port-04", "SIP count matches active_sips_count", ["portfolio.active_sips_count", "payments.sip_plans"], "Cross-check fields."),
        ("port-05", "Portfolio tab empty loading skeleton", ["portfolio.status"], "Wait for status ready."),
        ("port-06", "Show profit since inception", ["portfolio.total_return", "portfolio.invested"], "Use total_return and invested."),
        ("port-07", "Hide a fund from portfolio view", [], "UI filter if available; holdings remain.", False),
        ("port-08", "Portfolio after name change", ["portfolio.holdings_count"], "Holdings tied to PAN/account unchanged."),
        ("port-09", "Two accounts same PAN portfolio merge", [], "Escalate duplicate accounts.", False),
        ("port-10", "NAV change today on holding", [], "NAV daily; holding page as_on.", False),
        ("port-11", "Portfolio widget home screen", ["portfolio.current_value"], "Widget shows summary current_value refresh."),
        ("port-12", "Cost basis vs current value labels", ["portfolio.invested", "portfolio.current_value"], "Define invested vs current_value."),
    ]
    for item in portfolio:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["portfolio", "payment"] if slug == "port-04" else ["portfolio"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "Sync contacts for referrals", [], "Manual share referral link."),
        ("acc-02", "Biometric login failed", [], "Fallback password/Google sign-in."),
        ("acc-03", "Update app from Play Store", [], "Latest version for bug fixes."),
        ("acc-04", "Clear cookies web login", [], "Clear site data; re-login zynd."),
        ("acc-05", "Account email typo fix before verify", ["account.email_verified"], "Fix before verification completes.", False),
        ("acc-06", "Lost phone with SMS OTP", ["account.phone_verified"], "Recovery via email/Google; update phone.", False),
        ("acc-07", "Help bot language Hindi", [], "Bot replies English; app UI may have locale."),
        ("acc-08", "Copy client id for support ticket", [], "Share client id with agent when asked.", False),
        ("acc-09", "Rate limit too many OTP requests", [], "Wait window; avoid spam resend."),
        ("acc-10", "Sign up with work email", ["account.email_verified"], "Any valid email; verify inbox."),
        ("acc-11", "Account settings dark mode portfolio", [], "Appearance setting applies app-wide."),
        ("acc-12", "Help center search tickets", [], "Help → Tickets search by subject."),
        ("acc-13", "Push token reset", [], "Reinstall app or logout/login refresh push."),
        ("acc-14", "WebSocket chat disconnected", [], "Refresh chat; realtime reconnects."),
        ("acc-15", "Resolved ticket open new chat auto", [], "Message support starts fresh thread when prior resolved."),
        ("acc-16", "Feedback after agent resolved", [], "Optional survey; new issue new chat."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["account"], q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "Sort goals by deadline", ["goals.goals.target_date"], "Sort in Goals UI by target_date."),
        ("goal-02", "Goal icon color change", [], "Cosmetic in goal edit UI."),
        ("goal-03", "Link existing SIP retroactively", ["goals.goals", "payments.sip_plans"], "Link in goal funding settings if supported."),
        ("goal-04", "Goal milestone 25% alert", ["goals.goals.progress_pct"], "Notify when progress_pct crosses threshold if enabled."),
        ("goal-05", "Emergency fund separate from goals", ["goals.goals"], "Create dedicated goal title Emergency Fund."),
        ("goal-06", "Goal math does not match SIP", ["goals.goals", "payments.sip_plans"], "SIP amount vs goal target timeline explanation."),
        ("goal-07", "Archive goal without deleting", ["goals.goals.status"], "Archive/complete status in Goals."),
        ("goal-08", "Share goal screenshot", [], "Share from Goals UI; no PII of others."),
    ]
    for slug, q, fields, sol in goals:
        topics = ["goals", "payment"] if slug in {"goal-03", "goal-06"} else ["goals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol))

    family = [
        ("fam-01", "Resend invite 3rd time", [], "Resend from pending invites list."),
        ("fam-02", "Member role changed to head", ["family_groups.groups.my_role"], "Role change by current head only."),
        ("fam-03", "Family group empty after create", ["family_groups.groups"], "Invite members to populate."),
        ("fam-04", "Notification when member joins", [], "Enable family notifications if available."),
        ("fam-05", "Family goal 100% celebrate", ["goals.goals.progress_pct"], "Quote progress_pct for shared goal."),
        ("fam-06", "Leave family lost shared goals", ["family_groups.groups", "goals.goals"], "Shared goals may hide after leave."),
        ("fam-07", "Family invite wrong email typo", [], "Cancel wrong invite; send new one.", False),
        ("fam-08", "Two heads conflict", [], "One head per group; support if dispute.", False),
    ]
    for item in family:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["family", "goals"] if slug in {"fam-05", "fam-06"} else ["family"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    referrals = [
        ("ref-01", "Referral stats refresh", ["referrals.click_count", "referrals.signup_count"], "Refresh referrals page counts."),
        ("ref-02", "Friend signed up wrong code typo", [], "Cannot reapply; friend needs new account fix not possible.", False),
        ("ref-03", "Referral link UTM tracking", [], "Share official link; UTM if appended by user."),
        ("ref-04", "Multiple referrals same household", ["referrals.signup_count"], "Each unique account counts."),
        ("ref-05", "Referral reward pending 30 days", [], "Qualification period on referrals page terms."),
        ("ref-06", "Show referral QR print", ["referrals.has_code"], "QR from share sheet if available."),
        ("ref-07", "Referral after changing email", ["referrals.has_code", "account.email_verified"], "Code stays on account; verify email."),
        ("ref-08", "Referral help for friend onboarding", ["referrals.has_code"], "Friend uses code at signup; you share link."),
    ]
    for item in referrals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["referrals", "account"] if slug == "ref-07" else ["referrals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    multi = [
        ("multi-01", ["payment", "portfolio"], "Refresh all  orders and holdings", ["payments.recent_orders", "portfolio.as_on"], "Refresh Transactions and Portfolio."),
        ("multi-02", ["kyc", "payment"], "Ready to invest checklist", ["kyc.overall_status", "account.email_verified", "account.phone_verified"], "Verify channels + completed KYC."),
        ("multi-03", ["goals", "payment"], "Goal funded but SIP cancelled", ["goals.goals", "payments.sip_plans.status"], "Progress stays; SIP status separate."),
        ("multi-04", ["referrals", "kyc"], "Friend KYC done referral still pending", ["referrals.kyc_verified_count"], "Wait qualification steps beyond KYC."),
        ("multi-05", ["account", "payment"], "Realtime chat shows old order status", ["payments.recent_orders"], "Pull refresh; websocket ticket:updated."),
        ("multi-06", ["family", "goals", "payment"], "Family shared goal SIP cancelled", ["goals.goals", "payments.sip_plans"], "Member who owns SIP must restart."),
        ("multi-07", ["portfolio", "payment", "kyc"], "All green but invest fails", ["kyc.readiness_code", "payments.recent_orders.failure_reason"], "Readiness and latest failure_reason."),
        ("multi-08", ["account", "referrals"], "New email breaks referral link", ["account.email_verified", "referrals.has_code"], "Code on account unchanged after email verify."),
        ("multi-09", ["kyc", "portfolio"], "KYC complete portfolio loading forever", ["kyc.overall_status", "portfolio.status"], "status error escalate.", False),
        ("multi-10", ["payment", "goals"], "Invest without goal link ok?", ["goals.goals"], "Goal link optional at invest."),
        ("multi-11", ["account", "portfolio"], "Help bot + human same ticket", [], "Stay in thread; agent sees history after escalate."),
        ("multi-12", ["kyc", "payment", "portfolio", "account"], "Summarize my Zynd account in 3 lines", ["kyc.overall_status", "portfolio.current_value", "payments.sip_plans"], "Brief: KYC status, portfolio value, active SIP count/status."),
    ]
    for item in multi:
        slug, topics, q, fields, sol = item[0], item[1], item[2], item[3], item[4]
        can = item[5] if len(item) > 5 and isinstance(item[5], bool) else True
        if slug == "multi-09":
            can = False
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    return rows


def batch_nine_entries() -> list[dict]:
    """Batch 9: Hinglish/typos, redeem-switch-STP-SWP depth, consent/report edges."""
    b = 9
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "kyc kb complete hua?", ["kyc.overall_status", "kyc.completed_at"], "Plain English answer from overall_status and completed_at.", ["KYC complete ho gaya?", "Is my KYC done yet?"]),
        ("kyc-02", "pan verifcation pending dikha raha", ["kyc.steps.pan", "kyc.pan_verification_status"], "Quote pan step and pan_verification_status; Complete KYC retry."),
        ("kyc-03", "digilocker fail ho gya retry kaise", ["kyc.steps.digilocker", "kyc.readiness_reason"], "DigiLocker step + readiness_reason; restart journey."),
        ("kyc-04", "nominee add nahi ho raha", ["kyc.steps.nominee"], "Nominee step status; fix in Complete KYC form."),
        ("kyc-05", "bank acount mismatch error", ["kyc.steps.bank", "kyc.bank_verification_status"], "Bank step validation; re-enter matching account."),
        ("kyc-06", "signature upload size limit", ["kyc.steps.signature"], "Signature step rules; acceptable format/size in UI."),
        ("kyc-07", "kyc submitted but still cant invest", ["kyc.overall_status", "kyc.readiness_code"], "overall vs readiness_code; wait or fix blocking step."),
        ("kyc-08", "re-kyc required message meaning", ["kyc.readiness_code", "kyc.readiness_reason"], "Quote readiness fields; Complete KYC if prompted."),
        ("kyc-09", "aadhar address not matching", ["kyc.steps.address"], "Address step; re-upload or DigiLocker refresh."),
        ("kyc-10", "minor account kyc", [], "Zynd individual adult accounts; minors need guardian flow  escalate.", False),
        ("kyc-11", "nri kyc supported?", [], "Indian resident KYC in context; NRI rules not in pack  escalate.", False),
        ("kyc-12", "kyc status last updated kab", ["kyc.status_last_updated_at"], "status_last_updated_at only."),
        ("kyc-13", "personal details step stuck loading", ["kyc.steps.personal", "kyc.last_completed_step"], "Resume from last_completed_step; refresh page."),
        ("kyc-14", "review step submit button greyed", ["kyc.steps.review", "kyc.steps"], "Incomplete prior steps in steps object."),
        ("kyc-15", "already registered with another broker kyc", ["kyc.kyc_already_registered", "kyc.external_kyc_status"], "kyc_already_registered and external_kyc_status."),
        ("kyc-16", "kyc photo blur reject", ["kyc.steps.personal"], "Re-capture in personal step; Complete KYC."),
    ]
    for item in kyc:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = True
        para: list[str] | None = None
        if len(item) > 4:
            if isinstance(item[4], bool):
                can = item[4]
            elif isinstance(item[4], list):
                para = item[4]
        topics = ["kyc", "payment"] if slug == "kyc-07" else ["kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can, paraphrases=para or []))

    payment = [
        ("pay-01", "redeem karne me kitna time", ["payments.recent_orders", "portfolio.has_pending_orders"], "Redemption order status; settlement not instant  recent_orders."),
        ("pay-02", "SWP start kaise karu", ["payments.sip_plans"], "SWP via product flow; sip_plans for existing recurring context only."),
        ("pay-03", "STP from equity to debt", ["payments.recent_orders"], "STP order in recent_orders or Switch/STP UI; no invented status."),
        ("pay-04", "sip consent otp nahi aa raha", [], "Resend consent OTP; cooldown; check phone_verified.", False),
        ("pay-05", "lumpsum payment pending since 2 hrs", ["payments.recent_orders"], "Order PAYMENT_PENDING; refresh Transactions."),
        ("pay-06", "switch order rejected why", ["payments.recent_orders.failure_reason"], "failure_reason on switch order."),
        ("pay-07", "cancel pending redemption", ["payments.recent_orders"], "Cancel only if order still cancellable  status in recent_orders.", False),
        ("pay-08", "sip amount galat debit hua", ["payments.last_sip_debit.amount", "payments.sip_plans"], "Compare amounts; escalate mismatch.", False),
        ("pay-09", "mandate revoke bank app se", ["payments.sip_plans.status"], "Plan may show inactive; re-register mandate in app."),
        ("pay-10", "nfo apply kiya status", ["payments.recent_orders"], "NFO purchase row in recent_orders type/status."),
        ("pay-11", "instalment skip this month possible?", ["payments.sip_plans.status"], "Pause/skip via My SIPs; quote plan status."),
        ("pay-12", "payment success portfolio nahi dikha", ["payments.recent_orders", "portfolio.has_pending_orders"], "Pending allotment window normal."),
        ("pay-13", "multiple sips same fund allowed?", ["payments.sip_plans"], "List plans; multiple mandates possible if product allows."),
        ("pay-14", "refund for failed lumpsum timeline", ["payments.recent_orders"], "Failed order refund via bank; escalate if debited.", False),
        ("pay-15", "autopay limit increase for sip", [], "Bank mandate limit change in bank app + re-consent.", False),
        ("pay-16", "last sip fail reason batao", ["payments.last_sip_failure.failure_reason", "payments.last_sip_failure.failed_at"], "Quote failure fields."),
        ("pay-17", "redeem full amount all units", ["portfolio.holdings_count"], "Full redeem from Portfolio; holdings must exist."),
        ("pay-18", "cart se 3 funds ek saath pay", ["payments.recent_orders"], "Multiple orders from cart checkout in recent_orders."),
        ("pay-19", "sip date change 5th to 10th", ["payments.sip_plans.next_installment_date"], "Change via My SIPs; next_installment_date after change."),
        ("pay-20", "txn id kaha milega", ["payments.recent_orders"], "Order reference in Transactions detail."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["payment", "portfolio"] if slug in {"pay-01", "pay-12", "pay-17"} else ["payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    portfolio = [
        ("port-01", "XIRR kya hai mere portfolio ka", [], "XIRR if shown in UI; not in summary pack  open analytics.", False),
        ("port-02", "holding since date", [], "Per-scheme detail in Portfolio holding page."),
        ("port-03", "units balance wrong lag raha", ["portfolio.holdings_count"], "Refresh; escalate if persists.", False),
        ("port-04", "redeemable amount vs current value", ["portfolio.current_value"], "Current value indicative; exit load/lock-in in scheme rules not in context."),
        ("port-05", "ELSS lock in period kitna bacha", [], "ELSS lock from scheme detail; not in summary context.", False),
        ("port-06", "dividend payout history", [], "Transactions / scheme detail; not full history in pack."),
        ("port-07", "portfolio as on date meaning", ["portfolio.as_on"], "Quote as_on  data freshness timestamp."),
        ("port-08", "total return negative kyu", ["portfolio.total_return", "portfolio.invested"], "Market move; quote total_return vs invested."),
        ("port-09", "pending orders badge portfolio", ["portfolio.has_pending_orders"], "has_pending_orders true during allotment."),
        ("port-10", "compare two funds in portfolio", [], "Holdings list only; no performance compare in bot context.", False),
        ("port-11", "cas import ke baad bhi purana value", ["portfolio.status"], "Refresh after CAS sync; status loading.", False),
        ("port-12", "active sips count sahi nahi", ["portfolio.active_sips_count", "payments.sip_plans"], "Cross-check active_sips_count with sip_plans list."),
    ]
    for item in portfolio:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["portfolio", "payment"] if slug == "port-12" else ["portfolio"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "google account unlink kaise", ["account.google_account_linked"], "Settings if linked; warn sign-in impact."),
        ("acc-02", "phone number change otp", ["account.phone_verified"], "Verify new number flow in Settings."),
        ("acc-03", "email change after kyc", ["account.email_verified", "kyc.overall_status"], "Email verify; KYC name tied to PAN unchanged."),
        ("acc-04", "mfa sms vs authenticator", ["account.mfa_enrolled"], "Security settings enrollment type."),
        ("acc-05", "account locked too many attempts", ["account.account_status"], "account_status; wait or agent unlock.", False),
        ("acc-06", "download tax statement", [], "Reports / tax docs in app if available."),
        ("acc-07", "capital gains report FY", [], "Reports section; bot cannot generate custom FY.", False),
        ("acc-08", "privacy data export", [], "Settings privacy request; escalate if not self-serve.", False),
        ("acc-09", "login with apple hide email", ["account.apple_account_linked", "account.email_verified"], "Apple linked + reachable email for OTP."),
        ("acc-10", "session on two phones ok?", [], "Same account multi-device allowed; sign out remote if needed."),
        ("acc-11", "notification sip debit alert off", [], "Settings notifications toggles."),
        ("acc-12", "help bot history saved?", [], "Ticket thread in Help; resolved tickets read-only."),
        ("acc-13", "turnstile captcha failing signup", [], "Retry network; disable VPN; refresh page."),
        ("acc-14", "referral code paste at signup", ["referrals.has_code"], "Friend enters code during signup  not retroactive on your account."),
        ("acc-15", "profile photo change", [], "Profile settings if supported."),
        ("acc-16", "zynd app vs web same portfolio", ["portfolio.holdings_count"], "Same account same holdings after sync."),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["account", "kyc"] if slug == "acc-03" else ["account", "portfolio"] if slug == "acc-16" else ["account"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "goal target badhana hai", ["goals.goals"], "Edit goal target in Goals hub."),
        ("goal-02", "goal se sip unlink", ["goals.goals", "payments.sip_plans"], "Unlink in goal funding; SIP continues unless cancelled."),
        ("goal-03", "multiple goals one sip", [], "Usually one SIP per plan; link primary goal in UI.", False),
        ("goal-04", "goal progress 0 after invest", ["goals.goals.progress_pct", "payments.recent_orders"], "Progress updates after settled order; check pending."),
        ("goal-05", "retirement goal calculator", ["goals.goals"], "Goal title/target from context; calculator in Goals UI."),
        ("goal-06", "goal complete mark manually", ["goals.goals.status"], "Mark complete/archive in Goals."),
        ("goal-07", "family goal vs personal goal", ["goals.goals", "family_groups.groups"], "Shared goals tied to family group membership."),
        ("goal-08", "goal reminder notification", [], "Notification prefs for goal milestones if enabled."),
    ]
    for item in goals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["goals", "payment"] if slug in {"goal-02", "goal-04"} else ["goals", "family"] if slug == "goal-07" else ["goals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    family = [
        ("fam-01", "family group invite expire", [], "Resend invite from pending list."),
        ("fam-02", "remove member from family", ["family_groups.groups"], "Head removes member in Family settings."),
        ("fam-03", "see member portfolio privacy", [], "Only aggregated/shared views per product; not full holdings of others.", False),
        ("fam-04", "family head transfer", [], "Head role transfer in Family settings if supported.", False),
        ("fam-05", "child account under family", [], "Each member own KYC account; family is sharing layer.", False),
        ("fam-06", "family invite declined resend", [], "New invite after decline."),
        ("fam-07", "shared goal contribution split", ["goals.goals", "family_groups.groups"], "Progress on shared goal; contributions per member in UI."),
        ("fam-08", "leave family group steps", ["family_groups.groups"], "Leave group in Family settings; confirm shared access ends."),
    ]
    for item in family:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["family", "goals"] if slug == "fam-07" else ["family"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    referrals = [
        ("ref-01", "referral code copy paste", ["referrals.has_code"], "Share official link/code from Referrals page."),
        ("ref-02", "friend used link no credit", ["referrals.signup_count", "referrals.kyc_verified_count"], "Qualification beyond signup; quote counts."),
        ("ref-03", "referral whatsapp share", ["referrals.has_code"], "Use share sheet; has_code must be true."),
        ("ref-04", "change my referral code", [], "Code fixed per account; cannot customize.", False),
        ("ref-05", "referral fraud duplicate accounts", [], "One reward per unique qualified user; escalate suspicion.", False),
        ("ref-06", "referral earnings where shown", [], "Referrals dashboard terms and rewards section."),
        ("ref-07", "code at login vs signup", ["referrals.has_code"], "Code at signup for friend; you share from Referrals."),
        ("ref-08", "referral after account delete", [], "Deletion voids pending rewards  policy in terms.", False),
    ]
    for item in referrals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["referrals"], q, context_fields=fields, solution=sol, can_answer=can))

    multi = [
        ("multi-01", ["kyc", "payment"], "KYC done par SIP start nahi ho rahi", ["kyc.readiness_code", "payments.sip_plans.status"], "readiness_code plus mandate/plan status."),
        ("multi-02", ["portfolio", "payment"], "Redeem kiya paise kab aayenge", ["payments.recent_orders", "portfolio.has_pending_orders"], "Redemption order status and settlement expectation from order row."),
        ("multi-03", ["account", "kyc"], "Google se login KYC alag?", ["account.google_account_linked", "kyc.overall_status"], "Same user; KYC per account not per OAuth provider."),
        ("multi-04", ["goals", "portfolio"], "Goal 50% but portfolio down", ["goals.goals.progress_pct", "portfolio.total_return"], "Goal progress vs market total_return  explain separately."),
        ("multi-05", ["payment", "account"], "OTP fail invest flow", ["account.phone_verified", "payments.recent_orders"], "phone_verified and pending order payment retry."),
        ("multi-06", ["referrals", "account"], "Refer friend not verified email", ["referrals.has_code", "account.email_verified"], "You can share; friend must verify to qualify."),
        ("multi-07", ["family", "kyc"], "Family member KYC pending", ["family_groups.groups", "kyc.overall_status"], "Each member own kyc.overall_status on their login.", False),
        ("multi-08", ["kyc", "portfolio", "payment"], "New investor first sip checklist", ["kyc.overall_status", "account.email_verified", "payments.sip_plans"], "KYC + verified channels + create SIP."),
        ("multi-09", ["portfolio", "payment"], "Switch + redeem same day", ["payments.recent_orders"], "List both order types same day; processing independent."),
        ("multi-10", ["account", "payment", "portfolio"], "Sync everything not updating", ["portfolio.status", "payments.recent_orders", "kyc.status_last_updated_at"], "Refresh each tab; escalate if status error persists.", False),
        ("multi-11", ["goals", "referrals"], "Goal funded from referral bonus", [], "Referral rewards credit per terms; link to goal manually if credited.", False),
        ("multi-12", ["kyc", "payment", "portfolio", "goals"], "Quick health check mere account ka", ["kyc.overall_status", "portfolio.current_value", "payments.sip_plans", "goals.goals"], "Four-line summary from context fields only; no advice."),
    ]
    for item in multi:
        slug, topics, q, fields, sol = item[0], item[1], item[2], item[3], item[4]
        can = False if slug in {"multi-07", "multi-10", "multi-11"} else True
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    return rows


def batch_ten_entries() -> list[dict]:
    """Batch 10: capstone mix  tone, closures, dense combos, fine-tune-ready phrasing."""
    b = 10
    rows: list[dict] = []

    kyc = [
        ("kyc-01", "Thanks  when exactly did I finish KYC?", ["kyc.completed_at", "kyc.overall_status"], "If completed, give completed_at warmly; else state status and next step.", ["KYC completion date please", "Finished KYC  what date?"]),
        ("kyc-02", "Which KYC step is still open?", ["kyc.steps"], "List pending/failed steps by name from steps."),
        ("kyc-03", "Am I investment-ready per KYC?", ["kyc.overall_status", "kyc.readiness_code"], "completed + readiness_code clear to invest or block reason."),
        ("kyc-04", "Bank verified but overall not complete", ["kyc.steps.bank", "kyc.overall_status"], "Remaining steps in steps beyond bank."),
        ("kyc-05", "Can you resubmit KYC for me?", [], "Customer must complete Complete KYC; bot cannot submit.", False),
        ("kyc-06", "KYC document password protected PDF", ["kyc.steps.address"], "Upload unlocked PDF in address step."),
        ("kyc-07", "Holding US passport  KYC?", [], "Product supports resident Indian KYC in context; escalate atypical docs.", False),
        ("kyc-08", "Status says submitted  what next?", ["kyc.overall_status", "kyc.status_last_updated_at"], "Under review; notify when status changes; no SLA invent."),
        ("kyc-09", "Fix typo in PAN before submit", ["kyc.steps.pan"], "Correct in pan step before review submit."),
        ("kyc-10", "Nominee same as bank account holder", ["kyc.steps.nominee"], "Nominee rules in form; need not match bank holder."),
        ("kyc-11", "Complete KYC on desktop vs mobile", ["kyc.last_completed_step"], "Same journey; resume via last_completed_step."),
        ("kyc-12", "External registrar KYC delay", ["kyc.external_kyc_status"], "external_kyc_status only; patience or escalate if stuck long.", False),
        ("kyc-13", "KYC and risk profile order", ["kyc.overall_status"], "KYC identity first; investor readiness separate."),
        ("kyc-14", "Lost access mid KYC DigiLocker", ["kyc.steps.digilocker"], "Re-auth DigiLocker in step."),
        ("kyc-15", "Why readiness_reason mentions bank?", ["kyc.readiness_reason", "kyc.bank_verification_status"], "Quote both; actionable retry."),
        ("kyc-16", "Confirm KYC before large lumpsum", ["kyc.overall_status", "kyc.readiness_code"], "Must be completed/readiness clear; no amount advice."),
    ]
    for item in kyc:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = True
        para: list[str] | None = None
        if len(item) > 4:
            if isinstance(item[4], bool):
                can = item[4]
            elif isinstance(item[4], list):
                para = item[4]
        topics = ["kyc", "payment"] if slug == "kyc-16" else ["kyc"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can, paraphrases=para or []))

    payment = [
        ("pay-01", "Please confirm my last successful SIP debit date", ["payments.last_sip_debit.settled_at", "payments.last_sip_debit.amount"], "Quote settled_at and amount; offer to check failure if asked."),
        ("pay-02", "Any failed SIP recently?", ["payments.last_sip_failure.failure_reason", "payments.last_sip_failure.failed_at"], "Quote last failure fields or say none in context."),
        ("pay-03", "How many active SIPs do I have?", ["payments.sip_plans", "portfolio.active_sips_count"], "Count from sip_plans or active_sips_count."),
        ("pay-04", "Latest order status in one sentence", ["payments.recent_orders"], "Newest order type + status + date."),
        ("pay-05", "Pause all SIPs at once", [], "Pause each in My SIPs; no bulk bot action.", False),
        ("pay-06", "Change default bank for debits", ["kyc.steps.bank"], "Bank from KYC; update via Complete KYC/settings bank change flow.", False),
        ("pay-07", "Invest ₹5000 today  will it work?", [], "No investment advice or guarantees; check KYC/readiness and use invest flow.", False),
        ("pay-08", "Order stuck in payment pending", ["payments.recent_orders"], "Retry payment or wait webhook; quote order age from row."),
        ("pay-09", "SIP cancelled but mandate active at bank", ["payments.sip_plans.status"], "Cancel plan in app; revoke mandate in bank if needed."),
        ("pay-10", "Duplicate webhook double order fear", ["payments.recent_orders"], "List same-day orders; escalate duplicate success.", False),
        ("pay-11", "Consent OTP verified still cannot place order", ["payments.recent_orders.failure_reason", "kyc.readiness_code"], "failure_reason + readiness_code."),
        ("pay-12", "Redemption to different bank account", [], "Payout bank typically KYC bank; escalate change request.", False),
        ("pay-13", "Weekend lumpsum payment", ["payments.recent_orders"], "Payment may process; order timestamps from recent_orders."),
        ("pay-14", "SIP plan frequency monthly confirm", ["payments.sip_plans.frequency"], "Quote frequency field."),
        ("pay-15", "Failed plan in failed_sip_plans list", ["payments.failed_sip_plans"], "Quote failed plan reason/status from list."),
        ("pay-16", "Transaction fees on SIP", [], "Expense ratio in scheme docs; no Zynd fee invent in context."),
        ("pay-17", "Cancel lumpsum before payment", ["payments.recent_orders"], "Cancel if status allows in Transactions."),
        ("pay-18", "Invest without consent OTP possible?", [], "Consent OTP required for regulated transactions.", False),
        ("pay-19", "Payment receipt download", ["payments.recent_orders"], "Order detail / email confirmation if sent."),
        ("pay-20", "Next SIP debit amount and date", ["payments.sip_plans.next_installment_date", "payments.sip_plans"], "Next date and plan amount from sip_plans."),
    ]
    for item in payment:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["payment", "kyc"] if slug in {"pay-06", "pay-11"} else ["payment"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    portfolio = [
        ("port-01", "What is my portfolio worth right now?", ["portfolio.current_value", "portfolio.as_on"], "current_value with as_on freshness."),
        ("port-02", "How much have I invested in total?", ["portfolio.invested"], "Quote invested field."),
        ("port-03", "Overall gain or loss amount", ["portfolio.total_return"], "Quote total_return with brief explanation."),
        ("port-04", "Do I hold any funds currently?", ["portfolio.holdings_count"], "holdings_count zero vs positive."),
        ("port-05", "Portfolio still loading  normal?", ["portfolio.status"], "status loading; retry refresh."),
        ("port-06", "Pending orders affecting value?", ["portfolio.has_pending_orders", "portfolio.current_value"], "has_pending_orders may delay full reflection."),
        ("port-07", "Best performing fund in my portfolio", [], "No ranking in summary pack; open holdings.", False),
        ("port-08", "Should I sell losing fund?", [], "No investment advice; explain total_return only or escalate.", False),
        ("port-09", "Portfolio empty after successful buy", ["portfolio.has_pending_orders", "payments.recent_orders"], "Pending allotment until settlement."),
        ("port-10", "SIP count on portfolio card", ["portfolio.active_sips_count"], "Quote active_sips_count."),
        ("port-11", "Reconcile portfolio with bank statement", [], "Bank debits vs orders in Transactions; escalate mismatch.", False),
        ("port-12", "Thank you  that explains my portfolio summary", ["portfolio.current_value", "portfolio.invested", "portfolio.total_return"], "Brief recap of three fields; invite further questions."),
    ]
    for item in portfolio:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["portfolio", "payment"] if slug in {"port-06", "port-09"} else ["portfolio"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    account = [
        ("acc-01", "Is my email verified?", ["account.email_verified"], "Quote email_verified boolean plainly."),
        ("acc-02", "Is my phone verified for OTP?", ["account.phone_verified"], "Quote phone_verified."),
        ("acc-03", "Google account linked status", ["account.google_account_linked"], "google_account_linked flag and Settings path."),
        ("acc-04", "Apple sign in linked?", ["account.apple_account_linked"], "apple_account_linked from context."),
        ("acc-05", "MFA enabled on my account?", ["account.mfa_enrolled"], "mfa_enrolled and Security settings."),
        ("acc-06", "Account status active or restricted?", ["account.account_status"], "Quote account_status."),
        ("acc-07", "How do I talk to a human agent?", [], "Use Help chat Message support / escalate; bot hands off.", False),
        ("acc-08", "This chat resolved my issue  thanks", [], "Acknowledge; if resolution prompt open, Yes closes ticket; new issue new chat."),
        ("acc-09", "Wrong answer earlier  need agent", [], "Apologize; escalate to agent with ticket context.", False),
        ("acc-10", "Can you see my password?", [], "Never; Zynd staff cannot see passwords.", False),
        ("acc-11", "Export all my support tickets", [], "Help → Tickets history; bot cannot bulk export.", False),
        ("acc-12", "Timezone for dates in chat", [], "Use customer-friendly IST wording for ISO timestamps from context."),
        ("acc-13", "Bot vs agent who am I speaking to?", [], "You are on Zynd Help bot until agent joins thread."),
        ("acc-14", "Sensitive info safe in this chat?", [], "Do not share OTP/passwords; agents see ticket not full bank creds."),
        ("acc-15", "Reopen resolved ticket", [], "Start new chat for new issue; old ticket stays resolved.", False),
        ("acc-16", "Account summary for spouse", [], "Only account holder context; no third-party data.", False),
    ]
    for item in account:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["account"], q, context_fields=fields, solution=sol, can_answer=can))

    goals = [
        ("goal-01", "List my goals briefly", ["goals.goals"], "Titles and progress_pct from goals list."),
        ("goal-02", "Which goal is closest to target?", ["goals.goals.progress_pct"], "Highest progress_pct from context."),
        ("goal-03", "Create goal without SIP", ["goals.goals"], "Goal can exist; fund via lumpsum later."),
        ("goal-04", "Goal deleted by mistake recover", [], "Escalate if no undo in UI.", False),
        ("goal-05", "Goal currency INR confirm", ["goals.goals"], "Goals in INR per product."),
        ("goal-06", "Link new SIP to existing goal", ["goals.goals", "payments.sip_plans"], "Funding link in goal settings."),
        ("goal-07", "No goals yet  is that ok?", ["goals.goals"], "Optional feature; investing works without goals."),
        ("goal-08", "Goal progress after redemption", ["goals.goals.progress_pct", "portfolio.total_return"], "Progress may drop if linked to holdings value.", False),
    ]
    for item in goals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["goals", "payment"] if slug == "goal-06" else ["goals", "portfolio"] if slug == "goal-08" else ["goals"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    family = [
        ("fam-01", "Am I in a family group?", ["family_groups.groups"], "groups list empty or membership from context."),
        ("fam-02", "My role in family group", ["family_groups.groups.my_role"], "Quote my_role."),
        ("fam-03", "Invite pending count", ["family_groups.groups"], "Pending invites if in family slice."),
        ("fam-04", "Family feature benefits one line", ["family_groups.groups"], "Shared goals/visibility per product; no invent perks."),
        ("fam-05", "Accept invite link expired", [], "Ask head resend invite."),
        ("fam-06", "Family + referrals combine?", ["family_groups.groups", "referrals.has_code"], "Separate features; each member own referral code.", False),
        ("fam-07", "Dispute family head access", [], "Escalate to support with both parties verify.", False),
        ("fam-08", "Thanks for explaining family groups", ["family_groups.groups"], "Brief recap membership; offer further help."),
    ]
    for item in family:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        topics = ["family", "referrals"] if slug == "fam-06" else ["family"]
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    referrals = [
        ("ref-01", "Do I have a referral code?", ["referrals.has_code"], "has_code true/false and where to find."),
        ("ref-02", "How many friends signed up via me?", ["referrals.signup_count"], "signup_count from context."),
        ("ref-03", "How many completed KYC from referrals?", ["referrals.kyc_verified_count"], "kyc_verified_count."),
        ("ref-04", "Referral link clicks count", ["referrals.click_count"], "click_count if present."),
        ("ref-05", "Referral program rules summary", ["referrals.has_code"], "High-level from Referrals page; no invent reward amounts.", False),
        ("ref-06", "Friend forgot code at signup", [], "Cannot add post signup; friend new account only path.", False),
        ("ref-07", "Self referral with second email", [], "Prohibited; escalate fraud concern.", False),
        ("ref-08", "Thank you  shared my referral link", ["referrals.has_code"], "Encourage sharing; remind friend uses at signup."),
    ]
    for item in referrals:
        slug, q, fields, sol = item[0], item[1], item[2], item[3]
        can = item[4] if len(item) > 4 and isinstance(item[4], bool) else True
        rows.append(_row(b, slug, ["referrals"], q, context_fields=fields, solution=sol, can_answer=can))

    multi = [
        ("multi-01", ["account", "kyc", "payment"], "Can I invest today  full checklist", ["kyc.overall_status", "kyc.readiness_code", "account.email_verified", "account.phone_verified"], "Checklist from four fields; direct to Invest if clear."),
        ("multi-02", ["portfolio", "payment", "kyc"], "Why portfolio zero but SIP active", ["portfolio.holdings_count", "payments.sip_plans.status", "kyc.overall_status"], "No holdings yet vs pending first debit."),
        ("multi-03", ["goals", "payment", "portfolio"], "Goal progress vs portfolio value mismatch", ["goals.goals.progress_pct", "portfolio.current_value"], "Explain measurement difference; no advice."),
        ("multi-04", ["referrals", "kyc", "account"], "Referral pending friend KYC", ["referrals.kyc_verified_count", "referrals.signup_count"], "Counts explain pipeline; friend must complete own KYC."),
        ("multi-05", ["family", "goals", "kyc"], "Family shared goal member not KYC", ["family_groups.groups", "kyc.overall_status"], "Each member invests after own KYC.", False),
        ("multi-06", ["payment", "portfolio", "account"], "Help me understand last 7 days activity", ["payments.recent_orders", "portfolio.as_on"], "Summarize recent_orders only; no invented trades."),
        ("multi-07", ["kyc", "payment", "portfolio", "goals", "referrals"], "Everything important in one message", ["kyc.overall_status", "portfolio.current_value", "payments.sip_plans", "goals.goals", "referrals.signup_count"], "Dense factual summary; bullet style; no advice."),
        ("multi-08", ["account", "payment"], "Agent please  payment dispute", ["payments.recent_orders"], "Acknowledge; escalate with order ids from context.", False),
        ("multi-09", ["portfolio", "payment", "kyc"], "Data looks wrong  human review", ["portfolio.status", "payments.recent_orders", "kyc.overall_status"], "Escalate; attach what fields look inconsistent.", False),
        ("multi-10", ["account"], "Goodbye and close chat", [], "If resolved prompt, suggest Yes; else ask if anything else."),
        ("multi-11", ["kyc", "account"], "Verify identity before sharing portfolio stats", ["kyc.overall_status", "account.email_verified"], "Bot only serves signed-in user; quote status reassurance."),
        ("multi-12", ["kyc", "payment", "portfolio", "account", "goals", "family", "referrals"], "Final training recap  my Zynd snapshot", ["kyc.overall_status", "portfolio.current_value", "portfolio.invested", "payments.sip_plans", "goals.goals", "referrals.signup_count", "account.email_verified"], "Capstone answer: one short paragraph from all fields present; warm close."),
    ]
    for item in multi:
        slug, topics, q, fields, sol = item[0], item[1], item[2], item[3], item[4]
        can = False if slug in {"multi-05", "multi-08", "multi-09"} else True
        rows.append(_row(b, slug, topics, q, context_fields=fields, solution=sol, can_answer=can))

    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=1)
    args = parser.parse_args()

    if args.batch == 1:
        entries = batch_one_entries()
        out_name = "batch-001.jsonl"
    elif args.batch == 2:
        entries = batch_two_entries()
        out_name = "batch-002.jsonl"
    elif args.batch == 3:
        entries = batch_three_entries()
        out_name = "batch-003.jsonl"
    elif args.batch == 4:
        entries = batch_four_entries()
        out_name = "batch-004.jsonl"
    elif args.batch == 5:
        entries = batch_five_entries()
        out_name = "batch-005.jsonl"
    elif args.batch == 6:
        entries = batch_six_entries()
        out_name = "batch-006.jsonl"
    elif args.batch == 7:
        entries = batch_seven_entries()
        out_name = "batch-007.jsonl"
    elif args.batch == 8:
        entries = batch_eight_entries()
        out_name = "batch-008.jsonl"
    elif args.batch == 9:
        entries = batch_nine_entries()
        out_name = "batch-009.jsonl"
    elif args.batch == 10:
        entries = batch_ten_entries()
        out_name = "batch-010.jsonl"
    else:
        raise SystemExit(f"Batch {args.batch} not implemented yet.")

    if len(entries) != 100:
        raise SystemExit(f"Batch {args.batch} must have 100 entries, got {len(entries)}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / out_name
    with out_path.open("w", encoding="utf-8") as handle:
        for row in entries:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Wrote {len(entries)} examples to {out_path}")


if __name__ == "__main__":
    main()
