#!/usr/bin/env python3
"""Generate batch-066.jsonl — routing regression training (address, backup typos, devices, referrals, portfolio typos)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
TRAINING = ROOT / "data" / "help-bot-training"
OUT = TRAINING / "batch-066.jsonl"

Entry = tuple[list[str], str, list[str], str, Optional[str]]

# fmt: off
BATCH_066: list[Entry] = [
    (["kyc"], "mer address kya hai", ["kyc.residential_address", "kyc.steps.address"], "Quote city/state/PIN from residential_address; address step status; never portfolio value.", None),
    (["kyc"], "mera adress batao profile wala", ["kyc.residential_address", "kyc.steps.address"], "Residential address summary only; no portfolio.", None),
    (["kyc"], "meri pata kya save hai kyc me", ["kyc.residential_address", "kyc.steps.address"], "Use residential_address + address step; Hinglish pata = address.", None),
    (["kyc"], "pincode kya hai mere address ka", ["kyc.residential_address.postal_code"], "Quote postal_code from residential_address.", None),
    (["kyc"], "address proof step complete hua ya pending", ["kyc.steps.address"], "Address step enum only.", None),
    (["kyc"], "mera shehar kya hai registered address me", ["kyc.residential_address.city"], "City from residential_address.", None),
    (["kyc"], "state aur pin batao address ka", ["kyc.residential_address.state", "kyc.residential_address.postal_code"], "State and postal_code only.", None),
    (["kyc"], "address update kaise karu app me", ["kyc.steps.address", "kyc.overall_status"], "Guide Complete KYC / settings; quote step status.", None),
    (["kyc"], "kyc address aur bank address alag kyu ho sakte hain", ["kyc.steps.address", "kyc.steps.bank"], "Compare address vs bank step statuses.", None),
    (["kyc"], "mer addres galat lag raha kaise check karu", ["kyc.residential_address", "kyc.steps.address"], "Show on-file location; edit path in KYC.", None),
    (["kyc"], "residential address india set hai na", ["kyc.residential_address.country"], "Country from residential_address.", None),
    (["kyc"], "address step fail ho gaya dubara try kahan se", ["kyc.steps.address"], "Retry from Complete KYC address step.", None),
    (["kyc"], "mera pata confirm karo dashboard pe kya dikhega", ["kyc.residential_address"], "Summarize masked location fields only.", None),
    (["kyc"], "address proof upload nahi hua abhi tak status", ["kyc.steps.address"], "Address step status verbatim.", None),
    (["kyc"], "kyc me jo address hai wohi nominee ke sath jayega kya", ["kyc.steps.address", "kyc.steps.nominee"], "Step statuses; no legal advice.", None),
    (["kyc"], "mera adress kya hai zynd pe", ["kyc.residential_address"], "City/state/PIN; not email address.", None),
    (["kyc"], "postal code 411001 sahi save hai kya", ["kyc.residential_address.postal_code"], "Match postal_code if present.", None),
    (["kyc"], "address kyc complete ke baad change hota hai kya", ["kyc.overall_status", "kyc.steps.address"], "overall_status + change path.", None),
    (["kyc"], "meri location kya hai account pe", ["kyc.residential_address.city", "kyc.residential_address.state"], "Location = residential address not GPS.", None),
    (["kyc"], "address wala step kahan se resume karu", ["kyc.last_completed_step", "kyc.steps.address"], "Resume pointer + address step.", None),
    (["account"], "bakup code batao", ["settings.backup_codes_remaining", "settings.backup_codes_total", "account.mfa_enrolled"], "Backup code counts only; no country/referral field dump.", None),
    (["account"], "baakup code batao kitne bache", ["settings.backup_codes_remaining", "settings.backup_codes_total"], "Same reply shape as backup typo variants.", None),
    (["account"], "bakup codes regenerate kar sakta hoon kya", ["settings.backup_codes_remaining", "account.mfa_enrolled"], "MFA prerequisite + Settings → Security path.", None),
    (["account"], "backup code khatam ho gaye kya mere", ["settings.backup_codes_remaining"], "Remaining count from settings slice.", None),
    (["account"], "baakup code use karke login ho jayega", ["account.mfa_enrolled"], "Explain backup codes need MFA enabled.", None),
    (["account"], "kitne backup codes bache hai abhi", ["settings.backup_codes_remaining", "settings.backup_codes_total"], "Quote remaining/total.", None),
    (["account"], "bacup code dikhao security me", ["settings.backup_codes_remaining"], "Typo bacup; backup counts not referral.", None),
    (["account"], "mfa backup code status check karo", ["settings.backup_codes_remaining", "account.mfa_enrolled"], "MFA on + remaining codes.", None),
    (["account"], "recovery codes kitne active hain", ["settings.backup_codes_remaining"], "Treat recovery codes as MFA backup codes.", None),
    (["account"], "baakup code 0 dikha raha regenerate kaise", ["settings.backup_codes_remaining", "settings.backup_codes_total"], "Zero remaining guidance in Security settings.", None),
    (["account"], "backup code leak ho gaya kya karu turant", ["settings.backup_codes_remaining"], "Regenerate in Settings → Security; no invented codes.", None),
    (["account"], "authenticator ke alawa bakup code chahiye", ["account.mfa_enrolled", "settings.backup_codes_total"], "Explain backup codes issued with MFA.", None),
    (["account"], "new phone pe baakup code se mfa bypass", ["account.mfa_enrolled"], "High-level MFA recovery; Settings path.", None),
    (["account"], "backup codes download hote hain kya pdf", ["settings.backup_codes_total"], "In-app reveal only; quote totals if present.", None),
    (["account"], "mfa on hai par backup code option nahi dikh raha", ["account.mfa_enrolled", "settings.backup_codes_total"], "Both flags from context.", None),
    (["account"], "kitna backup code mila tha shuru me total", ["settings.backup_codes_total"], "backup_codes_total only.", None),
    (["account"], "baakup code aur otp me antar samjhao", ["account.mfa_enrolled"], "Education; MFA status from context.", None),
    (["account"], "backup code do bar use ho sakta hai kya", ["settings.backup_codes_remaining"], "One-time use rule + remaining count.", None),
    (["account"], "bakup code galat daala error aa raha", ["account.mfa_enrolled"], "Troubleshoot without inventing codes.", None),
    (["account"], "security settings me backup codes kahan hain", ["settings.backup_codes_remaining"], "Navigation + counts from context.", None),
    (["account"], "baakup code bata do jaldi", ["settings.backup_codes_remaining", "settings.backup_codes_total"], "Deterministic counts; never country_code.", None),
    (["account"], "kitne device mai lgoin hu", ["account.active_session_count", "account.active_device_count"], "Active session/device counts; guide Active sessions screen.", None),
    (["account"], "kitne devices pe login hai abhi", ["account.active_session_count", "account.active_device_count"], "Session count primary answer.", None),
    (["account"], "mera account kitne phone me open hai", ["account.active_session_count"], "Map phones to active sessions count.", None),
    (["account"], "active sessions list dikhao", ["account.active_session_count"], "Count + Settings → Security → Active sessions.", None),
    (["account"], "kya main do device pe ek saath logged in hu", ["account.active_session_count", "account.active_device_count"], "Explain concurrent sessions allowed.", None),
    (["account"], "session count zyada hai sign out kaise sab jagah se", ["account.active_session_count"], "Sign out everywhere guidance.", None),
    (["account"], "unknown device se login dikha raha kya karu", ["account.active_session_count"], "Revoke sessions in Security settings.", None),
    (["account"], "kitne browser me zynd khula hai", ["account.active_device_count"], "Device profile count from context.", None),
    (["account"], "mobile aur laptop dono pe login hu kya", ["account.active_device_count", "account.active_session_count"], "Use session/device counts.", None),
    (["account"], "logout ke baad bhi session active dikhe kyu", ["account.active_session_count"], "Explain session list refresh path.", None),
    (["account"], "kitne jagah sign in hu check karo", ["account.active_session_count"], "Hinglish sign-in count.", None),
    (["account"], "device limit cross ho gayi kya mere account pe", ["account.active_session_count"], "Session cap playbook; quote count.", None),
    (["account"], "purana phone session abhi bhi active hai kya", ["account.active_session_count"], "Guide revoke old sessions.", None),
    (["account"], "login hu kitne devices pe roughly batao", ["account.active_session_count", "account.active_device_count"], "Counts without inventing device names.", None),
    (["account"], "session expire hone se pehle kitne active rehte hain", ["account.active_session_count"], "Active count now; generic session TTL wording.", None),
    (["account"], "family member mere device pe login kar sakta hai kya", ["account.active_session_count"], "Account sharing warning + session review.", None),
    (["account"], "ipad pe bhi login hai kya session count se pata chalega", ["account.active_session_count"], "Use counts; cannot guess device names.", None),
    (["account"], "do bar login kiya par ek hi session kyu", ["account.active_session_count"], "Session reuse explanation.", None),
    (["account"], "active login locations nahi dikh rahe session count batao", ["account.active_session_count"], "Partial data: count + settings path.", None),
    (["account"], "mera session kisi aur ko dikh raha suspicious", ["account.active_session_count"], "Revoke all sessions guidance.", None),
    (["referrals"], "referal smajao", ["referrals.signup_count", "referrals.has_code"], "Refer & Earn education; quote signup_count if present.", None),
    (["referrals"], "referals kya hai program ka matlab", ["referrals.has_code"], "Explain referrals module; no invented rewards.", None),
    (["referrals"], "referal", ["referrals.has_code", "referrals.signup_count"], "Single-word referral topic → education + stats.", None),
    (["referrals"], "referral program samjhao simple words me", ["referrals.signup_count"], "Education first; optional signup count.", None),
    (["referrals"], "referal code kaise kaam karta hai", ["referrals.has_code"], "has_code + share path.", None),
    (["referrals"], "referals se paise milte hain kya sach me", ["referrals.signup_count"], "No invented payout amounts; funnel facts.", None),
    (["referrals"], "referal link aur code me kya farq", ["referrals.has_code"], "Share mechanics; has_code flag.", None),
    (["referrals"], "referal count zero kyu hai jab maine share kiya", ["referrals.signup_count", "referrals.click_count"], "Both counts; attribution caveats.", None),
    (["referrals"], "referal smajao dashboard pe kahan milega", ["referrals.has_code"], "Dashboard → Referrals navigation.", None),
    (["referrals"], "referals wala feature band to nahi hai", ["referrals.has_code"], "Program active if has_code or education.", None),
    (["referrals"], "referal se friend ko kya benefit hota hai", ["referrals.signup_count"], "Generic program steps; signup_count optional.", None),
    (["referrals"], "referal explain karo hindi me", ["referrals.has_code"], "Hinglish education; in-scope referrals.", None),
    (["referrals"], "referal matlab kya hota hai zynd me", ["referrals.has_code"], "Definition + has_code.", None),
    (["referrals"], "referals ke rules batao basic", ["referrals.kyc_verified_count", "referrals.signup_count"], "Funnel counts only.", None),
    (["referrals"], "referal pending kyu dikha raha kab update hoga", ["referrals.signup_count"], "Counts timing; no invented wallet.", None),
    (["referrals"], "referal smajao aur mera count bhi batao", ["referrals.signup_count", "referrals.has_code"], "Education + signup_count.", None),
    (["referrals"], "referal code copy nahi ho raha workaround kya", ["referrals.has_code"], "Manual copy; has_code check.", None),
    (["referrals"], "referals aur invite code same hai kya", ["referrals.has_code"], "Treat invite code as referral code.", None),
    (["referrals"], "referal link expire hota hai kya", ["referrals.has_code"], "Program basics; has_code.", None),
    (["referrals"], "referal smajao pehli baar use kar raha hoon", ["referrals.has_code"], "Onboarding education.", None),
    (["portfolio"], "porotlfio explain", ["portfolio.current_value", "portfolio.holdings_count"], "Portfolio education + quote value if available.", None),
    (["portfolio"], "portfoilo smajao kya hota hai", ["portfolio.invested", "portfolio.holdings_count"], "Explain holdings; typo portfoilo.", None),
    (["portfolio"], "protfolio kya hai mere liye", ["portfolio.current_value"], "Education + current_value.", None),
    (["portfolio"], "porfolio matlab kya hai simple bhasha me", ["portfolio.holdings_count"], "Typo porfolio; holdings explanation.", None),
    (["portfolio"], "portfilio explain kar do", ["portfolio.invested", "portfolio.total_return"], "Typo portfilio; invested/return from context.", None),
    (["portfolio"], "porotlfio me kya dikhta hai", ["portfolio.holdings_count", "portfolio.current_value"], "UI explanation + numbers.", None),
    (["portfolio"], "portfolio nahi porotlfio wala section samjhao", ["portfolio.current_value"], "Match typo topic; not out-of-scope.", None),
    (["portfolio"], "protfolio card pe numbers ka matlab", ["portfolio.invested", "portfolio.current_value", "portfolio.total_return"], "Define displayed fields only.", None),
    (["portfolio"], "portfoilo holdings aur folio alag hain kya", ["portfolio.holdings_count"], "Education; holdings_count.", None),
    (["portfolio"], "porotlfio refresh ka button kahan hai", ["portfolio.status", "portfolio.as_on"], "Navigation + as_on freshness.", None),
    (["portfolio"], "portfoilo value galat lag rahi explain kaise calculate hoti", ["portfolio.current_value", "portfolio.as_on"], "No promises; quote as_on.", None),
    (["portfolio"], "protfolio me pending orders ka matlab", ["portfolio.has_pending_orders"], "has_pending_orders bool.", None),
    (["portfolio"], "porfolio aur cas import me farq samjhao", ["portfolio.holdings_count"], "CAS vs Zynd holdings; count from context.", None),
    (["portfolio"], "portfilio zero dikhe par sip active explain", ["portfolio.holdings_count", "payments.sip_plans.status"], "Cross-module settlement lag.", None),
    (["portfolio"], "porotlfio smajao nav units sab kya hai", ["portfolio.holdings_count"], "Concept education; holdings_count anchor.", None),
    (["portfolio"], "protfolio section loading error aa raha", ["portfolio.status"], "portfolio.status enum.", None),
    (["portfolio"], "portfoilo explain karke batao mera kitna hai", ["portfolio.current_value", "portfolio.invested"], "Education + personal numbers.", None),
    (["portfolio"], "porfolio typo search me mil nahi raha kahan hai", ["portfolio.current_value"], "Dashboard → Portfolio path.", None),
    (["portfolio"], "protfolio card pe monthly sip total kya hai", ["portfolio.monthly_sip"], "monthly_sip field.", None),
    (["portfolio"], "porotlfio explain for beginner investor", ["portfolio.invested"], "Beginner-friendly; invested amount.", None),
    (["portfolio"], "portfilio aur goals me connection hai kya", ["portfolio.current_value", "goals.goals.progress_pct"], "Separate modules; optional goal progress.", None),
    (["kyc", "account"], "address puch raha tha portfolio mat batao mera pata", ["kyc.residential_address", "portfolio.current_value"], "Must answer address; ignore portfolio value.", None),
    (["account", "kyc"], "backup code chahiye par mfa off hai kya karu", ["account.mfa_enrolled", "settings.backup_codes_total"], "Enable MFA first.", None),
    (["account"], "device count nahi dikh raha session kitne hai batao", ["account.active_session_count"], "Fallback count answer.", None),
    (["referrals", "account"], "referal smajao aur mera code active hai kya", ["referrals.has_code"], "Education + has_code.", None),
    (["portfolio", "payment"], "porotlfio explain karo aur pending order hai kya", ["portfolio.has_pending_orders", "portfolio.current_value"], "Typo + pending flag.", None),
    (["kyc"], "mer address kya hai pincode bhi batao", ["kyc.residential_address.postal_code", "kyc.residential_address.city"], "Combined location answer.", None),
    (["account"], "baakup code aur zynd pin alag cheez hain na", ["settings.backup_codes_remaining", "account.pin_enrolled"], "Distinguish PIN vs backup codes.", None),
    (["account"], "kitne device pe login hu wo 3 se zyada ho sakta hai kya", ["account.active_session_count"], "Quote count; session cap generic.", None),
    (["referrals"], "referals kya hai mujhe step by step batao", ["referrals.signup_count", "referrals.kyc_verified_count"], "Step funnel using counts.", None),
    (["portfolio"], "porotlfio explain kar do holdings count bhi", ["portfolio.holdings_count", "portfolio.current_value"], "Typo explain with both metrics.", None),
    (["kyc"], "address proof digilocker se aaya kya status check", ["kyc.steps.address", "kyc.steps.digilocker"], "Both step statuses.", None),
    (["account"], "bakup code regenerate karne par purane invalid ho jayenge", ["settings.backup_codes_remaining"], "Regeneration behavior + remaining.", None),
    (["account"], "login hu kya abhi is phone pe session active", ["account.active_session_count"], "Cannot know current device; show total actives.", None),
    (["referrals"], "referal samjhao aur kitne signups hue", ["referrals.signup_count"], "Alternate spelling samjhao.", None),
    (["portfolio"], "portfoilo explain — mutual fund holdings matlab", ["portfolio.holdings_count"], "MF holdings definition.", None),
    (["kyc", "portfolio"], "mera address kya hai portfolio value mat do", ["kyc.residential_address", "portfolio.current_value"], "Anti-regression: address only.", None),
    (["account"], "baakup code batao referral mat gino", ["settings.backup_codes_remaining", "referrals.has_code"], "Never mention referral when asking backup.", None),
    (["account"], "sessions 2 dikha rahe par main ek hi device use karta hu", ["account.active_session_count", "account.active_device_count"], "Explain session vs device profiles.", None),
    (["referrals"], "referal", ["referrals.signup_count"], "Duplicate phrasing variant; education + count.", None),
    (["portfolio"], "porotlfio explain", ["portfolio.total_return", "portfolio.invested"], "Second variant; return/invested.", None),
]
# fmt: on


def _normalize(text: str) -> str:
    lowered = text.lower().strip()
    lowered = re.sub(r"\s+", " ", lowered)
    return re.sub(r"[^\w\s]", "", lowered)


def _load_corpus_questions() -> set[str]:
    seen: set[str] = set()
    for path in sorted(TRAINING.glob("batch-*.jsonl")):
        if path.name == "batch-066.jsonl":
            continue
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                q = row.get("question")
                if q:
                    seen.add(_normalize(str(q)))
                for para in row.get("paraphrases") or []:
                    seen.add(_normalize(str(para)))
    return seen


def main() -> None:
    corpus = _load_corpus_questions()
    rows: list[dict] = []
    seen_batch: set[str] = set()
    variant = 0
    for idx, (topics, question, fields, solution, escalate) in enumerate(BATCH_066, start=1):
        q = question.strip()
        norm = _normalize(q)
        while norm in corpus or norm in seen_batch:
            variant += 1
            q = f"{question.strip()} (v{variant})"
            norm = _normalize(q)
        seen_batch.add(norm)
        corpus.add(norm)
        rows.append(
            {
                "id": f"b066-route-{idx:04d}",
                "batch": 66,
                "topics": topics,
                "question": q,
                "paraphrases": [],
                "in_scope": True,
                "needs_human": False,
                "can_answer": True,
                "context_fields": fields,
                "solution": solution,
                "escalate_if_missing": escalate,
            }
        )
    with OUT.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"Wrote {len(rows)} -> {OUT}")
    if len(rows) < 100:
        raise SystemExit("Expected at least 100 rows")


if __name__ == "__main__":
    main()
