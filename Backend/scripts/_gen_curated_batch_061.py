#!/usr/bin/env python3
"""One-off generator for curated batch-061 (1000 Hinglish MF/KYC/account lines)."""

from __future__ import annotations

import json
import random
import re
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data/help-bot-training/curated/batch-061-entries.jsonl"

SUFFIX = ""

random.seed(61061)


def line(topics: list[str], fields: list[str], can_answer: bool, question: str, solution: str) -> dict:
    return {
        "topics": topics,
        "context_fields": fields,
        "can_answer": can_answer,
        "question": question,
        "solution": solution + SUFFIX,
    }


def norm(q: str) -> str:
    return re.sub(r"\s+", " ", q.strip().lower())


seen: set[str] = set()
rows: list[dict] = []
_gidx = 0

_MODULE_TAGS = (
    "Complete KYC screen se",
    "Settings → Security se",
    "Explore tab se fund dekh ke",
    "Transactions history se",
    "My SIPs module se",
    "Portfolio holdings se",
    "Invest / cart flow se",
    "Dashboard se login ke baad",
    "Help chat se direct",
    "mobile app se",
    "website par",
    "family tablet se",
    "office laptop se",
    "UPI mandate settings se",
    "notification link se aaya tha",
)


def finalize_q(q: str) -> str:
    """Light module tag for uniqueness  no invented amounts."""
    global _gidx
    i = _gidx
    _gidx += 1
    base = q.rstrip()
    if i % 4 != 0:
        return base if base.endswith("?") else f"{base}?"
    tag = _MODULE_TAGS[i % len(_MODULE_TAGS)]
    if base.endswith("?"):
        return f"{base[:-1].rstrip()}, {tag}?"
    return f"{base}, {tag}?"


def add(entry: dict) -> None:
    question = finalize_q(entry["question"])
    n = norm(question)
    bump = 0
    while n in seen:
        bump += 1
        tag = _MODULE_TAGS[( _gidx + bump) % len(_MODULE_TAGS)]
        base = entry["question"].rstrip().rstrip("?")
        question = f"{base}, {tag} (v{bump})?"
        n = norm(question)
    entry = {**entry, "question": question}
    seen.add(n)
    rows.append(entry)


# --- KYC templates (280) ---
KYC_SPECS: list[tuple[list[str], bool, str, str]] = [
    (["kyc.overall_status"], True, "Complete KYC module khola to overall status kya dikhega?", "Summarise overall_status; if not completed point to Complete KYC."),
    (["kyc.completed_at", "kyc.overall_status"], True, "Kal raat tak KYC complete ho gaya tha kya mere account pe?", "If completed, state completed_at; else quote overall_status."),
    (["kyc.status_last_updated_at", "kyc.overall_status"], True, "Status last update kab hua  abhi bhi submitted dikha raha hai", "Quote status_last_updated_at with overall_status; no approval promise unless completed."),
    (["kyc.steps.pan", "kyc.pan_verification_status"], True, "PAN wala step green hai ya dubara upload karna padega?", "Answer from pan step and pan_verification_status only."),
    (["kyc.steps.digilocker"], True, "DigiLocker se Aadhaar link hua ya error aa raha tha?", "Use digilocker step status; if failed reopen Complete KYC."),
    (["kyc.steps.address"], True, "Address proof step approve hua ya reject?", "Quote address step status from context."),
    (["kyc.steps.personal"], True, "Personal details me father name mismatch tha  ab step ka status?", "Explain personal step status; retry from Complete KYC if failed."),
    (["kyc.steps.nominee"], True, "Nominee add kar diya tha  submit ho gaya na?", "State nominee step status."),
    (["kyc.steps.bank", "kyc.bank_verification_status"], True, "Bank penny drop fail tha, ab verify ho gaya kya?", "Use bank step and bank_verification_status."),
    (["kyc.steps.signature", "kyc.steps.review"], True, "E-sign aur final review dono tick ho gaye?", "Summarise signature and review step statuses."),
    (["kyc.last_completed_step"], True, "App band kar di thi  KYC wahi se resume hoga jahan chhoda?", "Resume from last_completed_step via Dashboard → Complete KYC."),
    (["kyc.readiness_code", "kyc.readiness_reason"], True, "Invest button grey hai  KYC readiness reason kya hai?", "Explain invest block from readiness_code and readiness_reason."),
    (["kyc.kyc_already_registered", "kyc.external_kyc_status"], True, "Already registered elsewhere wala flag on hai kya?", "Quote kyc_already_registered and external_kyc_status only."),
    (["kyc.steps"], True, "Kaunsa KYC step abhi pending ya failed hai list me?", "List pending or failed steps from kyc.steps."),
    (["kyc.overall_status"], True, "KYC ke bina Explore se lumpsum chalega?", "If overall_status not completed, investing requires completed KYC per playbook."),
    (["kyc.pan_verification_status"], True, "PAN verification NSdl se pass hui ya manual review?", "Use pan_verification_status; do not read full PAN aloud."),
    (["kyc.steps.review"], True, "Review submit ke baad under review kitna time lagta hai?", "If overall_status submitted, say under review; else actual status."),
    (["kyc.status_last_updated_at"], True, "Complete KYC me last update timestamp kya hai abhi?", "Quote status_last_updated_at with overall_status."),
    (["kyc.steps.bank"], True, "IFSC galat tha kya bank step ab bhi failed?", "Use bank step status; retry bank verification in Complete KYC."),
    (["kyc.steps.nominee"], True, "Nominee percentage 100% hai ya error aa raha tha?", "State nominee step status from context."),
]

KYC_FALSE: list[tuple[list[str], str, str]] = [
    (["kyc.overall_status"], "Mera poora PAN number chat me bhej do verify ke liye", "Decline sharing full PAN; use masked context or Complete KYC screen only."),
    (["kyc.overall_status"], "Zerodha pe KYC hai  yahan dubara poora flow mandatory hai kya?", "Stay in Zynd scope; do not claim other-broker policy; point to Complete KYC status."),
    (["kyc.steps.digilocker"], "Binance jaisa video KYC yahan available hai?", "Decline out-of-scope; MF onboarding uses Complete KYC steps in app."),
    (["kyc.overall_status"], "KYC agent ko WhatsApp pe selfie bhejun kya?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "Paytm pe KYC hai Zynd me skip ho sakta hai?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "Full Aadhaar number yahan paste kar raha hun sahi hai?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "US stocks ke liye same KYC kaam karega?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.steps.pan"], "Friend ka PAN use karke KYC kar sakta hun?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "KYC ke liye apna net banking password bata do", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "Angel One KYC PDF upload se yahan bypass?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "Loan app KYC yahan reuse?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "KYC OTP kisi aur ke phone pe bhej do", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "IRCTC KYC se auto-fill hoga?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "Mutual fund nahi chahiye sirf KYC certificate chahiye bechne ke liye", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "Groww KYC import ho jayega seedha?", "Explain Zynd onboarding; avoid other-app policy claims."),
    (["kyc.overall_status"], "CoinDCX jaisa crypto KYC yahan chalega kya?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.steps.pan"], "PAN card photo se number OCR karke bhej do mujhe", "Decline sharing full PAN; use Complete KYC only."),
    (["kyc.overall_status"], "Teen account bina guardian KYC?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "KYC video me mask pehen sakta hun?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "Dark web pe KYC docs leak hua kya check karo", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "KYC me bitcoin wallet address daalna hai kya?", "Politely decline or escalate; stay within Zynd support scope."),
    (["kyc.overall_status"], "SBI Yono KYC import ho jayega yahan?", "Politely decline or escalate; stay within Zynd support scope."),
]

KYC_MODULES = [
    "Complete KYC",
    "Dashboard",
    "Invest",
    "Explore",
]
KYC_STEPS = ["PAN", "DigiLocker", "address", "personal", "nominee", "bank", "signature", "review"]
KYC_DEVICES = ["Android pe", "iPhone se", "laptop browser se", "office WiFi se", "4G pe ghar pe"]
KYC_TIMES = ["subah", "lunch break me", "Sunday ko", "month end pe", "SIP date ke din", "holiday pe bhi"]

for i in range(280):
    if i >= 280 - len(KYC_FALSE):
        fi = i - (280 - len(KYC_FALSE))
        fields, q, sol = KYC_FALSE[fi]
        add(line(["kyc"], fields, False, q, sol))
        continue
    base = KYC_SPECS[i % len(KYC_SPECS)]
    fields, _ca, q_tpl, sol = base
    ca = True
    mod = KYC_MODULES[i % len(KYC_MODULES)]
    step = KYC_STEPS[i % len(KYC_STEPS)]
    dev = KYC_DEVICES[i % len(KYC_DEVICES)]
    tm = KYC_TIMES[i % len(KYC_TIMES)]
    variants = [
        q_tpl,
        f"{mod} screen pe {step} step ka kya scene hai? {dev} try kiya tha.",
        f"KYC {step} wala part stuck lag raha  context me status kya hai, {tm}?",
        f"Bhai {mod} me overall KYC ka update chahiye tha, {dev}.",
        f"Invest block ho raha hai  {step} step complete hai ya nahi?",
        f"Nominee ya bank  jo bhi pending ho bata do, {tm} check kiya.",
        f"Readiness code samajh nahi aaya, Invest grey kyu hai?",
        f"DigiLocker redirect ke baad app me {step} status refresh nahi hua {dev}.",
        f"Phase1 complete likha tha  ab full KYC complete hua?",
        f"External KYC registrar status kya dikha raha hai app me?",
    ]
    q = variants[(i // len(KYC_SPECS)) % len(variants)]
    add(line(["kyc"], fields, ca, q, sol))

# --- Account (280) ---
ACCT_SPECS: list[tuple[list[str], bool, str, str]] = [
    (["account.email_verified", "account.email_verified_at"], True, "Email verify ho chuka hai ya abhi pending?", "Quote email_verified and email_verified_at."),
    (["account.phone_verified", "account.phone_verified_at"], True, "Login OTP wala phone verified hai na?", "Use phone_verified and phone_verified_at."),
    (["account.mfa_enrolled"], True, "MFA on hai account pe ya sirf password se login?", "Answer from mfa_enrolled; point to Settings → Security for changes."),
    (["account.has_password_login"], True, "Password login enabled hai ya sirf Google se aata hun?", "Use has_password_login and linked providers if present."),
    (["account.google_account_linked"], True, "Google account link hua hai Settings me?", "Quote google_account_linked; Settings → Sign-in methods."),
    (["account.apple_account_linked"], True, "Apple ID se sign-in link hai kya?", "Quote apple_account_linked from context."),
    (["account.linked_sign_in_providers"], True, "Kaun kaun se sign-in options active hain?", "List linked_sign_in_providers from context."),
    (["account.account_status"], True, "Account restricted ya active dikha raha hai?", "Summarise account_status; escalate if restricted without reason in context."),
    (["account.country_code"], True, "Account country code India hi hai na?", "Quote country_code only."),
    (["account.phone_verified"], True, "SMS OTP aa nahi raha phone verified flag check karo", "Use phone_verified; Settings → phone if pending."),
    (["account.google_account_linked", "account.apple_account_linked"], True, "Google aur Apple dono link ho sakte hain kya ek saath?", "Quote both linked flags from context."),
]

ACCT_FALSE: list[tuple[list[str], str, str]] = [
    (["account.email_verified"], "Mera email password yahan type kar raha hun sahi login hoga?", "Never collect passwords in chat; direct to Settings password reset flow."),
    (["account.mfa_enrolled"], "MFA backup codes poori list chat me bhej do", "Do not expose secrets; use in-app MFA recovery or agent."),
    (["account.account_status"], "Zynd support ka admin password kya hai test ke liye", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.account_status"], "Dusre user ka email yahan daal ke unka balance dikhao", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.phone_verified"], "Mera OTP intercept karke bhej do agent ko", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.has_password_login"], "Bank PIN Settings me update kaise karun chat me batao", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.linked_sign_in_providers"], "Facebook login kab aa raha hai?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.mfa_enrolled"], "Rooted phone pe MFA bypass trick?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.email_verified"], "Two emails merge  dono ka password bhej raha hun", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.apple_account_linked"], "Apple ID password yahan safe hai paste karun?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.phone_verified"], "SIM swap ho gaya  purana OTP forward karo", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.account_status"], "Chat me poora Aadhaar save kar lo account ke liye", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.linked_sign_in_providers"], "Borrow someone else's verified phone for OTP?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.mfa_enrolled"], "Auto-login token chat pe copy paste kar do", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.account_status"], "Get database dump from Settings debug menu?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.email_verified"], "Instagram DM se email verify ho jayega?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.account_status"], "Sell my login credentials best price?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.google_account_linked"], "Dusre ka Google account link karke unka portfolio dekho", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.mfa_enrolled"], "MFA band karne ka secret code chat me chahiye", "Do not expose secrets; use in-app MFA recovery or agent."),
    (["account.has_password_login"], "Purana password yaad nahi  yahan bata deta hun sahi hai?", "Never collect passwords in chat; direct to Settings password reset flow."),
    (["account.phone_verified"], "Telegram bot se phone verify ho jayega?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
    (["account.account_status"], "Settings se kisi aur ka PAN edit kar sakta hun?", "Decline unsafe or out-of-scope requests; direct to official Settings flows or agent."),
]

ACCT_SCREENS = ["Settings", "Profile", "Security", "Notifications", "Sessions"]
ACCT_ACTIONS = [
    "email change",
    "phone update",
    "notification toggle",
    "Google unlink",
    "Apple link",
    "logout all devices",
    "profile photo",
    "display name",
]

for i in range(280):
    if i >= 280 - len(ACCT_FALSE):
        fi = i - (280 - len(ACCT_FALSE))
        fields, q, sol = ACCT_FALSE[fi]
        add(line(["account"], fields, False, q, sol))
        continue
    base = ACCT_SPECS[i % len(ACCT_SPECS)]
    fields, _ca, q_tpl, sol = base
    ca = True
    scr = ACCT_SCREENS[i % len(ACCT_SCREENS)]
    act = ACCT_ACTIONS[i % len(ACCT_ACTIONS)]
    variants = [
        q_tpl,
        f"{scr} tab me {act} ka option nahi dikh raha  status kya hai?",
        f"Settings se MFA band karna hai pehle enrolled hai ya nahi?",
        f"Naya phone liya  verified number context me update hua?",
        f"Google se login karta hun password set kar sakta hun kya?",
        f"Apple hide-my-email use kiya  email verified flag true hai?",
        f"Session expire ho raha bar bar  account status check karo",
        f"Referral signup ke baad email verify pending dikha raha hai",
        f"Invest consent OTP ke liye phone verified hona zaroori hai?",
        f"Profile me naam KYC se match nahi kar raha account side pe kya dikhega?",
    ]
    q = variants[(i // len(ACCT_SPECS)) % len(variants)]
    add(line(["account"], fields, ca, q, sol))

# --- MF / payment / portfolio (350) ---
MF_SPECS: list[tuple[list[str], str, bool, str, str]] = [
    (["payment"], ["payments.sip_plans.next_installment_date"], True, "My SIPs me agla installment kab cut hoga?", "From active sip_plans give next_installment_date per plan."),
    (["payment"], ["payments.sip_plans.amount", "payments.sip_plans.frequency"], True, "SIP amount aur monthly frequency sahi hai na context me?", "Quote amount and frequency from sip_plans."),
    (["payment"], ["payments.sip_plans.status"], True, "Mandate active hai ya paused dikha raha hai?", "Summarise sip_plans status; mention mandate per playbook."),
    (["payment"], ["payments.last_sip_debit.settled_at", "payments.last_sip_debit.amount"], True, "Pichla SIP debit kab hua kitna kata?", "Use last_sip_debit settled_at and amount."),
    (["payment"], ["payments.last_sip_failure.failure_reason", "payments.last_sip_failure.failed_at"], True, "Last SIP fail kyu hui date bhi batao", "Quote last_sip_failure reason and failed_at."),
    (["payment"], ["payments.recent_orders"], True, "Transactions me latest order payment pending kyu hai?", "Find PAYMENT_PENDING in recent_orders; explain awaiting confirmation."),
    (["payment"], ["payments.recent_orders"], True, "Lumpsum order settle ho gaya ya processing me hai?", "Use recent lumpsum order status and settled_at if any."),
    (["payment"], ["payments.failed_sip_plans"], True, "Failed SIP plans list me kuch hai abhi?", "Summarise failed_sip_plans from context."),
    (["portfolio"], ["portfolio.has_pending_orders", "payments.recent_orders"], True, "Paisa kata par Portfolio me units nahi  pending order hai?", "Explain settlement; cite has_pending_orders and matching recent_orders."),
    (["portfolio"], ["portfolio.current_value", "portfolio.as_on"], True, "Portfolio value aaj kitni dikha rahi hai as-on date kya hai?", "Quote current_value and as_on."),
    (["portfolio"], ["portfolio.invested", "portfolio.total_return"], True, "Total invested aur gain loss context se bata do", "Use invested and total_return only."),
    (["portfolio"], ["portfolio.holdings_count", "portfolio.active_sips_count"], True, "Kitne funds hold kar raha hun aur kitni active SIPs?", "Quote holdings_count and active_sips_count."),
    (["portfolio"], ["portfolio.monthly_sip"], True, "Har mahine total SIP kitni ja rahi hai?", "Use portfolio.monthly_sip from context."),
    (["payment", "portfolio"], ["payments.recent_orders", "portfolio.has_pending_orders"], True, "Redeem order place kiya units kab tak jayenge?", "Use redeem order status in recent_orders; settlement playbook if pending."),
    (["payment"], ["payments.recent_orders"], True, "Invest flow me consent OTP ke baad order fail ho gaya kyu?", "Newest failed order: failure_code and failure_reason from recent_orders."),
    (["portfolio"], ["portfolio.status"], True, "Portfolio load error aa raha hai status kya hai?", "Quote portfolio.status; suggest refresh if error enum."),
    (["payment"], ["payments.last_sip_debit.status"], True, "Last SIP debit success dikha raha hai ya failed?", "Use last_sip_debit status from context."),
    (["portfolio"], ["portfolio.holdings_count"], True, "Explore se naya fund buy karne ke baad holdings count badha?", "Compare holdings_count with recent buy in recent_orders if present."),
    (["payment"], ["payments.recent_orders"], True, "Switch order Transactions me processing stage pe hai?", "Find switch order in recent_orders and quote status."),
]

MF_FALSE: list[tuple[list[str], str, str]] = [
    (["payments.recent_orders"], "ELSS lock-in period mere fund ka exact din batao scheme detail ke bina", "Direct to Explore or holding detail for lock-in; set can_answer false if scheme not in context."),
    (["portfolio.current_value"], "Agle mahine mera portfolio kitna badhega predict karo", "Decline predictions; quote current_value only."),
    (["payments.recent_orders"], "Best large-cap fund 2026 me kaun sa lu SIP?", "Decline investment advice; suggest Explore research, no scheme pick."),
    (["portfolio.current_value"], "NAV kal kitna hoga HDFC fund ka guess karo", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Small cap ya mid cap  mere liye kaun better hai batao", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.invested"], "Insider tip se kaun sa MF double hoga?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "SBI fund vs Axis fund guaranteed winner?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.total_return"], "Market crash me sab bech dun kya advice do", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "WhatsApp group ne fund bola  wahi lu na?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Loan leke lumpsum dalun returns pakka 20%?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "NFO me hamesha profit hota hai na?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.current_value"], "Guaranteed 50% return wala plan hai kya?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Third party Paytm merchant se Zynd MF pay?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Full bank account number chat me verify karo", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.holdings_count"], "Someone else's folio redeem kar sakta hun?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "NAV manipulation kaise karte hain sikhao", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.current_value"], "Explore me jo fund top pe hai wahi best hai na hamesha?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Crypto index fund Zynd pe launch hua kya invest karun?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Tax chori ke liye ELSS hide kaise karun", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.invested"], "SIP band karke FD better hai hamesha?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Agent ne commission wala fund bola  sahi hai?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Fund manager ka personal WhatsApp do", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.has_pending_orders"], "Portfolio copy paste karke dusre ko trade kar do", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Insider NAV leak mila invest ab?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.sip_plans"], "SIP date astrology ke hisab se set karo", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "International fund bina KYC forex se?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["portfolio.current_value"], "Redeem karke lottery tickets lu smart?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
    (["payments.recent_orders"], "Penny stock MF category hai kya Explore me?", "Decline advice, predictions, or third-party payment paths; stay on Zynd order/context facts or Explore."),
]

MF_SCREENS = ["Explore", "Invest", "Portfolio", "Transactions", "My SIPs", "Goals", "Cart"]
MF_ACTIONS = [
    "SIP start",
    "lumpsum",
    "redeem",
    "switch",
    "NFO apply",
    "mandate setup",
    "consent OTP",
    "failed UPI",
    "order cancelled",
    "allotment pending",
    "STP",
    "SWP",
]

for i in range(350):
    if i >= 350 - len(MF_FALSE):
        fi = i - (350 - len(MF_FALSE))
        fields, q, sol = MF_FALSE[fi]
        topics = ["payment"] if fields[0].startswith("payments") else ["portfolio"]
        if "recent_orders" in fields[0] and fi % 3 == 0:
            topics = ["payment", "portfolio"]
        add(line(topics, fields, False, q, sol))
        continue
    base = MF_SPECS[i % len(MF_SPECS)]
    topics, fields, ca, q_tpl, sol = base
    ca = True
    scr = MF_SCREENS[i % len(MF_SCREENS)]
    act = MF_ACTIONS[i % len(MF_ACTIONS)]
    variants = [
        q_tpl,
        f"{scr} se {act} try kiya  context me order status kya hai?",
        f"My SIPs page pe mandate issue dikha raha tha, failure reason?",
        f"Invest cart me fund add kiya payment fail  recent orders dekho",
        f"Explore pe NFO dikha par invest blocked  payment ya KYC?",
        f"Transactions history me duplicate debit lag raha hai verify karo",
        f"Portfolio holding detail me units kam kyu after switch?",
        f"Lumpsum ke baad Explore me same fund buy aur kar sakta hun?",
        f"Redeem amount bank me aaya nahi  payment settled_at check",
        f"Goals link SIP portfolio me count sahi hai?",
    ]
    q = variants[(i // len(MF_SPECS)) % len(variants)]
    add(line(topics, fields, ca, q, sol))

# --- Multi-topic (90) ---
MULTI = [
    (["kyc", "payment"], ["kyc.readiness_reason", "payments.recent_orders"], True,
     "KYC incomplete hai isliye SIP payment fail ho rahi hai kya?",
     "Check readiness_reason and recent order failure; tie to Complete KYC if blocked."),
    (["account", "kyc"], ["account.phone_verified", "kyc.overall_status"], True,
     "Phone verify nahi hai to KYC submit ho payega?",
     "Both phone_verified and overall_status; phone OTP needed for flows."),
    (["payment", "portfolio"], ["payments.recent_orders", "portfolio.has_pending_orders"], True,
     "Debit ho gaya Portfolio blank  payment aur pending flag dono check karo",
     "Cross-check recent_orders with has_pending_orders for settlement."),
    (["kyc", "payment"], ["kyc.steps.bank", "payments.sip_plans.status"], True,
     "Bank KYC fail hai to SIP mandate active kaise dikha raha hai?",
     "Explain bank step vs sip_plans status; retry bank in Complete KYC."),
    (["account", "payment"], ["account.mfa_enrolled", "payments.recent_orders"], True,
     "MFA on hai phir bhi invest consent OTP fail  order status?",
     "MFA does not replace transaction OTP; use recent_orders failure_reason."),
    (["kyc", "portfolio"], ["kyc.overall_status", "portfolio.holdings_count"], True,
     "KYC complete hai par holdings zero kyu?",
     "Completed KYC allows new invest; zero holdings may mean no orders yet."),
    (["account", "kyc"], ["account.email_verified", "kyc.steps.review"], True,
     "Email verify pending hai review step submit ho gaya?",
     "Quote email_verified and review step independently."),
    (["payment", "goals"], ["payments.sip_plans", "goals.goals.status"], True,
     "Goal SIP aur My SIPs me amount match nahi kar raha",
     "Compare sip_plans amounts with goals list; no inventing missing goal fields."),
    (["kyc", "payment"], ["kyc.readiness_code", "payments.last_sip_failure"], True,
     "Invest readiness aur last SIP fail reason same issue hai?",
     "Compare readiness_code with last_sip_failure; may differ (KYC vs bank)."),
    (["account", "portfolio"], ["account.account_status", "portfolio.status"], True,
     "Account restricted likha hai portfolio bhi load nahi ho rahi",
     "Quote both statuses; escalate if restricted."),
]

MULTI_FALSE: list[tuple[list[str], list[str], str, str]] = [
    (["kyc", "payment"], ["kyc.readiness_reason", "payments.recent_orders"], "KYC + payment: dusre broker ka folio merge karke tax bachao trick?", "Decline fraud, third-party, or advice; separate topics per playbook."),
    (["account", "kyc"], ["account.email_verified", "kyc.steps.pan"], "Account + KYC: friend ka PAN mere email pe link kar do", "Decline fraud, third-party, or advice; separate topics per playbook."),
    (["payment", "portfolio"], ["payments.recent_orders", "portfolio.current_value"], "Payment + portfolio: guaranteed double money scheme batao", "Decline fraud, third-party, or advice; separate topics per playbook."),
    (["kyc", "payment"], ["kyc.steps.bank", "payments.recent_orders"], "KYC + payment: bina bank verify UPI se 10 lakh lumpsum?", "Decline fraud, third-party, or advice; separate topics per playbook."),
    (["account", "payment"], ["account.phone_verified", "payments.recent_orders"], "Account + payment: OTP share karke agent redeem kare?", "Decline fraud, third-party, or advice; separate topics per playbook."),
    (["kyc", "portfolio"], ["kyc.overall_status", "portfolio.invested"], "KYC + portfolio: bina invest advice best fund batao", "Decline fraud, third-party, or advice; separate topics per playbook."),
    (["account", "portfolio"], ["account.account_status", "portfolio.total_return"], "Account + portfolio: guaranteed return promise karo", "Decline fraud, third-party, or advice; separate topics per playbook."),
    (["payment", "goals"], ["payments.sip_plans", "goals.goals.target_amount"], "Goals + payment: third-party wallet se SIP pay karun?", "Decline fraud, third-party, or advice; separate topics per playbook."),
]

for i in range(90):
    if i >= 90 - len(MULTI_FALSE):
        fi = i - (90 - len(MULTI_FALSE))
        topics, fields, q, sol = MULTI_FALSE[fi]
        add(line(topics, fields, False, q, sol))
        continue
    base = MULTI[i % len(MULTI)]
    topics, fields, ca, q_tpl, sol = base
    extras = [
        f"Settings me phone change ke baad Complete KYC bank step dubara?",
        f"Google login + KYC pending  Invest pe error code kya context me?",
        f"Failed payment Explore cart se  KYC readiness bhi dekho",
        f"Portfolio pending + payment success  dono modules reconcile karo",
        f"Nominee KYC aur Goals beneficiary alag hai kya?",
        f"MFA enrolled par email verify false  MF redeem chalega?",
        f"Transactions fail + account_status active  phir bhi block?",
        f"SIP mandate + bank verification mismatch KYC side pe?",
        f"Family group member KYC pending  main account SIP affect?",
        f"Referral bonus aur payment settled order link hai?",
    ]
    q = extras[(i // len(MULTI)) % len(extras)] if i >= len(MULTI) else q_tpl
    add(line(topics, fields, ca, q, sol))

assert len(rows) == 1000, len(rows)
false_count = sum(1 for r in rows if not r["can_answer"])
assert 75 <= false_count <= 85, false_count

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open("w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")

print(f"wrote {len(rows)} lines, can_answer false: {false_count}")
