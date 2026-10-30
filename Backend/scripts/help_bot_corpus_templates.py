"""Field catalog and parametric Q&A templates for help-bot corpus generation."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Iterator

import sys
from pathlib import Path

_SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_ROOT))

from app.application.support.help_bot_field_catalog import FIELD_BY_TOPIC, TOPICS  # noqa: E402

INTENT_TEMPLATES: list[tuple[str, str, str, bool]] = [
    (
        "status",
        "What is my {label}?",
        "Answer using {fields} from the customer context only; do not invent values.",
        True,
    ),
    (
        "status_casual",
        "Can you tell me about my {label}?",
        "Summarise {fields} in plain language from context.",
        True,
    ),
    (
        "when",
        "When did my {label} last change?",
        "Use date or timestamp fields among {fields} if present in context.",
        True,
    ),
    (
        "why",
        "Why does my account show this for {label}?",
        "Explain using {fields} and related readiness or failure fields; no speculation.",
        True,
    ),
    (
        "confirm",
        "Please confirm my {label}.",
        "Quote {fields} directly from context in one or two sentences.",
        True,
    ),
    (
        "missing",
        "I cannot see my {label} in the app.",
        "If {fields} are absent in context, set can_answer false and suggest refresh or agent.",
        False,
    ),
    (
        "how_check",
        "How do I check my {label} on Zynd?",
        "Direct to the in-app screen for this topic; then quote {fields} if available in context.",
        True,
    ),
    (
        "compare",
        "Is my {label} normal compared to last time?",
        "Only compare using values present in {fields}; if history missing, say so and do not invent.",
        True,
    ),
]

HINGLISH_FRAMES: list[str] = [
    "{base}",
    "Mera {label} kya hai?",
    "{label} ka status batao",
    "Zynd pe {label} kaise dekhu?",
    "Please {base_lower}",
    "Need help: {base_lower}",
    "Quick question  {base_lower}",
    "Hey, {base_lower}",
    "Can u check {label} for me?",
    "What about my {label}?",
]

# Batches from row 30k+ (and --focus hinglish|modules) draw from expansion specs below.
EXPANSION_START_SEQ = 30_000

HINGLISH_FIELD_TEMPLATES: list[tuple[str, str, bool]] = [
    ("hi-status", "Mera {label} ka status kya hai?", True),
    ("hi-done", "Kya mera {label} complete ho gaya?", True),
    ("hi-when", "{label} kab update hua tha?", True),
    ("hi-why", "{label} pending kyu dikha raha hai?", True),
    ("hi-check", "Zynd app pe {label} kahan check karu?", True),
    ("hi-batao", "Bhai {label} bata do na", True),
    ("hi-pls", "Please {label} confirm kar do", True),
    ("hi-nhi", "{label} nahi dikh raha app me", False),
    ("hi-sip", "SIP wale section me {label} sahi hai?", True),
    ("hi-kyc", "KYC flow me {label} ab bhi pending?", True),
    ("hi-portfolio", "Portfolio module me {label} refresh nahi ho raha", True),
    ("hi-referral", "Referral page pe {label} update kab hoga?", True),
    ("hi-family", "Family group me {label} kaise dekhe?", True),
    ("hi-goal", "Goals tab me {label} match nahi kar raha", True),
    ("hi-account", "Settings / account me {label} kahan hai?", True),
]

MODULE_NAV_TEMPLATES: dict[str, list[str]] = {
    "kyc": [
        "Complete KYC module me {label} kahan milega?",
        "KYC steps screen par {label} fail kyu?",
    ],
    "payment": [
        "Transactions module me {label} dikhao",
        "My SIPs section se {label} kaise verify karu?",
    ],
    "portfolio": [
        "Portfolio tab refresh ke baad bhi {label} purana lag raha",
        "Holdings screen par {label} galat kyun?",
    ],
    "account": [
        "Settings module me {label} update kaise karu?",
        "Login / security page par {label} kya hona chahiye?",
    ],
    "goals": [
        "Goals hub me {label} sync nahi ho raha",
        "Goal detail page par {label} check karna hai",
    ],
    "family": [
        "Family module invite ke baad {label} update?",
        "Family group screen par {label} kahan?",
    ],
    "referrals": [
        "Referrals dashboard par {label} zero kyu?",
        "Share link module me {label} sahi count?",
    ],
}

HINGLISH_MULTI: list[tuple[list[str], list[str], str, str, bool]] = [
    (
        ["kyc", "payment"],
        ["kyc.overall_status", "payments.sip_plans.status"],
        "KYC ho gaya par SIP start nahi ho rahi  kya missing hai?",
        "Quote readiness and SIP/mandate status from context only.",
        True,
    ),
    (
        ["payment", "portfolio"],
        ["payments.recent_orders", "portfolio.has_pending_orders"],
        "Payment success dikha par portfolio update nahi hua abhi tak",
        "Pending allotment using recent_orders and has_pending_orders.",
        True,
    ),
    (
        ["account", "kyc"],
        ["account.email_verified", "account.phone_verified", "kyc.overall_status"],
        "Invest karne se pehle email phone aur KYC sab ok hai?",
        "Checklist from verified flags and kyc.overall_status.",
        True,
    ),
    (
        ["goals", "payment"],
        ["goals.goals.progress_pct", "payments.sip_plans"],
        "Goal aur SIP link hai kya mere account me?",
        "Goal progress vs SIP plans from context.",
        True,
    ),
    (
        ["referrals", "account"],
        ["referrals.signup_count", "referrals.kyc_verified_count"],
        "Referral reward pending  signup hue par KYC pending?",
        "Use referral counts; no invented reward amounts.",
        True,
    ),
]

HINGLISH_DISAMBIG: list[str] = [
    "jaldi bata do please",
    "app me kahan dikhega",
    "Hinglish me samjha do",
    "simple words me",
    "bas itna confirm chahiye",
    "screenshot bhej sakta hoon",
    "aaj hi invest karna hai",
    "kal se SIP chalu hai",
    "bank se debit ho chuka",
    "notification nahi aaya",
    "OTP to aa gaya tha",
    "WiFi pe try kar raha hoon",
    "mobile data pe bhi same issue",
    "naya phone liya hai",
    "Google login use karta hoon",
    "Apple ID se login hai",
    "family wale ne pucha",
    "agent se pehle yahi check",
    "help bot se hi fix ho jayega?",
    "ticket mat kholo abhi",
]

DISAMBIG_PHRASES: list[str] = [
    "I need this for my records.",
    "Can you help me understand?",
    "Just checking before my next SIP.",
    "Quick check on my account.",
    "I'm looking at the app now.",
    "Before I contact support.",
    "This is for my own tracking.",
    "Following up from yesterday.",
    "After I refreshed the page.",
    "My family asked me about this.",
    "I'm new to mutual funds.",
    "I want to be sure it's correct.",
    "Is this shown anywhere else in Zynd?",
    "Does this affect investing today?",
    "Please keep it brief.",
    "I'm on the mobile app.",
    "I'm on the website.",
    "After my last login.",
    "Before I add a new goal.",
    "Before I invite family.",
    "For my referral dashboard.",
    "After my payment attempt.",
    "When my mandate was updated.",
    "After email verification.",
    "After phone verification.",
    "I'm completing KYC still.",
    "I finished KYC recently.",
    "My portfolio looked different last week.",
    "I saw a notification about this.",
    "The help center sent me here.",
    "I'm comparing with my bank statement.",
    "I need clarity for tax filing.",
    "Just a sanity check.",
    "Is this synced in real time?",
    "How fresh is this data?",
    "Could stale cache cause this?",
    "After I cleared app cache.",
    "I'm troubleshooting invest errors.",
    "Before I pause my SIP.",
    "Before I redeem units.",
    "I'm planning a lumpsum.",
    "For my monthly review.",
    "My advisor asked me to confirm.",
    "I want to avoid double debits.",
    "I think something looks off.",
    "Everything else looks fine though.",
    "Only this part is confusing.",
    "Can you point me to the screen?",
    "Which menu should I open?",
    "Is this the same as Transactions?",
    "Does Goals use this number?",
    "Will this update overnight?",
    "Should I wait 24 hours?",
    "I can share a screenshot if needed.",
    "No rush  whenever you can.",
    "Thanks for looking into this.",
    "Appreciate a clear answer.",
    "I'm stuck on this step.",
    "What should I do next?",
    "Is an agent required for this?",
    "Can the bot fix this automatically?",
    "I prefer chat over calling.",
    "I'm logged in right now.",
    "Same account as always.",
    "This is my primary Zynd account.",
    "I haven't changed banks recently.",
    "I recently changed my phone.",
    "I linked Google last week.",
    "I use Apple sign-in sometimes.",
    "MFA is enabled on my account.",
    "I'm not asking for investment advice.",
    "I only want my account facts.",
    "Please don't guess any amounts.",
    "Use only what you see on my profile.",
    "If missing, tell me honestly.",
    "Escalate if you cannot confirm.",
    "I read the FAQ but still unsure.",
    "The error message was unclear.",
    "I didn't get an email confirmation.",
    "SMS OTP worked fine though.",
    "My bank shows a debit already.",
    "AMC hasn't reflected it yet.",
    "Is allotment still pending?",
    "Could this be a holiday delay?",
    "Weekend payment  still processing?",
    "I tried twice by mistake.",
    "I want to cancel the duplicate.",
    "Which order went through?",
    "Show me the latest status only.",
    "Ignore older failed attempts.",
    "Focus on the most recent SIP.",
    "What about the previous month?",
    "Has this happened before?",
    "Is my mandate still active?",
    "Did the bank reject autopay?",
    "UPI vs mandate  which applies?",
    "I switched networks on my phone.",
    "Traveling  could that matter?",
    "I'm back in India now.",
    "Using WiFi not mobile data.",
    "I updated the app today.",
    "Running latest Android version.",
    "Running latest iOS version.",
    "Desktop Chrome on macOS.",
    "Safari private window issue?",
    "Incognito mode  still ok?",
    "Dark mode  same data?",
    "Language is English in app.",
    "Can I get dates in IST?",
    "Use simple words please.",
    "One sentence is enough.",
    "Bullet points ok if clearer.",
    "Don't include internal codes.",
    "Customer-friendly reply only.",
    "I'm testing the help bot.",
    "Is this the automated assistant?",
    "Will a human see this later?",
    "Please keep PII minimal.",
    "Don't repeat my full email.",
    "Mask sensitive details.",
    "Confirm flags yes/no only.",
    "Numbers and dates are enough.",
    "I'm ok with escalation.",
    "Open a ticket if needed.",
    "I'll wait for an agent.",
    "Continue in this chat please.",
    "Don't start a new ticket.",
    "Same issue as my last chat.",
    "That ticket was marked resolved.",
    "Starting fresh conversation now.",
    "Resolution prompt confused me.",
    "I tapped No by accident.",
    "I meant Yes  issue fixed.",
    "Issue is NOT fixed actually.",
    "Still need help on this.",
    "Partial answer only so far.",
    "You answered half my question.",
    "What about the other part?",
    "Also curious about timing.",
    "And the amount if available.",
    "Any failure reason recorded?",
    "Which step failed exactly?",
    "Is PAN step green?",
    "Is bank step still yellow?",
    "DigiLocker timed out earlier.",
    "Nominee saved or not?",
    "Signature uploaded successfully?",
    "Review submitted already?",
    "Readiness code still blocking?",
    "External KYC pending still?",
    "Registrar delay  normal?",
    "Can I invest small amount test?",
    "Minimum invest not my question.",
    "Focus on status only please.",
    "I'll stop here  thanks.",
]

TYPO_RULES: list[tuple[str, str]] = [
    ("", ""),
    ("status", "staus"),
    ("verification", "verifcation"),
    ("portfolio", "portfoilo"),
    ("installment", "instalment"),
    ("referral", "referal"),
    ("SIP", "sip"),
    ("KYC", "kyc"),
]

MULTI_TOPIC_QUESTIONS: list[tuple[list[str], list[str], str, str, bool]] = [
    (
        ["kyc", "payment"],
        ["kyc.overall_status", "kyc.readiness_code", "payments.sip_plans.status"],
        "KYC looks done but I cannot start a SIP  why?",
        "Check readiness_code and SIP plan or mandate status from context; no invented blockers.",
        True,
    ),
    (
        ["payment", "portfolio"],
        ["payments.recent_orders", "portfolio.has_pending_orders"],
        "I paid but my portfolio did not update yet.",
        "Explain pending allotment using recent_orders and has_pending_orders.",
        True,
    ),
    (
        ["account", "kyc"],
        ["account.email_verified", "account.phone_verified", "kyc.overall_status"],
        "What do I still need before I can invest?",
        "Checklist from email_verified, phone_verified, and kyc.overall_status.",
        True,
    ),
    (
        ["goals", "payment"],
        ["goals.goals.progress_pct", "payments.sip_plans"],
        "Is my goal linked to my SIP?",
        "Describe goal progress and SIP plans from context; link only if data shows it.",
        True,
    ),
    (
        ["referrals", "account"],
        ["referrals.signup_count", "referrals.kyc_verified_count", "account.email_verified"],
        "Why is my referral reward still pending?",
        "Use referral counts and qualification; do not invent reward amounts.",
        True,
    ),
    (
        ["family", "goals"],
        ["family_groups.groups", "goals.goals"],
        "Do we have a shared family goal?",
        "List family groups and goals from context.",
        True,
    ),
    (
        ["portfolio", "payment", "kyc"],
        ["portfolio.holdings_count", "payments.sip_plans", "kyc.overall_status"],
        "SIP is active but I hold zero funds  is that expected?",
        "Explain first debit timing vs holdings_count; quote sip_plans status.",
        True,
    ),
    (
        ["account", "payment"],
        ["account.phone_verified", "payments.recent_orders.failure_reason"],
        "Payment failed after OTP  what went wrong?",
        "Use failure_reason on recent order and phone_verified flag.",
        True,
    ),
    (
        ["kyc", "portfolio"],
        ["kyc.overall_status", "portfolio.status"],
        "KYC complete but portfolio will not load.",
        "portfolio.status and kyc.overall_status; escalate if status error persists.",
        False,
    ),
    (
        ["kyc", "payment", "portfolio", "account"],
        ["kyc.overall_status", "portfolio.current_value", "payments.sip_plans", "account.email_verified"],
        "Give me a short account health summary.",
        "One paragraph from listed fields only; warm tone; no investment advice.",
        True,
    ),
]

REFUSAL_SPECS: list[tuple[list[str], str, str]] = [
    (["payment"], "Which mutual fund will give highest return?", "Out of scope: no investment advice; suggest exploring funds in app."),
    (["portfolio"], "Should I sell all my funds today?", "Refuse advice; explain total_return only or escalate."),
    (["kyc"], "What is my full PAN number?", "Never repeat full PAN; use verification status only."),
    (["account"], "What is my password?", "Never handle passwords; direct to reset flow."),
    (["payment"], "Transfer my money to another broker now.", "Cannot move funds via chat; escalate or explain redemption flow."),
    (["referrals"], "How do I hack referral rewards?", "Refuse; legitimate referral rules only."),
]


@dataclass(frozen=True)
class Spec:
    topics: tuple[str, ...]
    fields: tuple[str, ...]
    label: str
    intent_id: str
    question_template: str
    solution_template: str
    can_answer: bool
    kind: str  # field | multi | refusal | hinglish | module


def _slugify(text: str, max_len: int = 48) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len] or "row"


def iter_specs() -> Iterator[Spec]:
    for topic, fields in FIELD_BY_TOPIC.items():
        for path, label in fields:
            for intent_id, q_tpl, sol_tpl, can in INTENT_TEMPLATES:
                yield Spec(
                    topics=(topic,),
                    fields=(path,),
                    label=label,
                    intent_id=intent_id,
                    question_template=q_tpl,
                    solution_template=sol_tpl,
                    can_answer=can,
                    kind="field",
                )
    for topics, fields, question, solution, can in MULTI_TOPIC_QUESTIONS:
        yield Spec(
            topics=tuple(topics),
            fields=tuple(fields),
            label="account",
            intent_id="multi",
            question_template=question,
            solution_template=solution,
            can_answer=can,
            kind="multi",
        )
    for topics, question, solution in REFUSAL_SPECS:
        yield Spec(
            topics=tuple(topics),
            fields=(),
            label="policy",
            intent_id="refusal",
            question_template=question,
            solution_template=solution,
            can_answer=False,
            kind="refusal",
        )


SPECS: tuple[Spec, ...] = tuple(iter_specs())


def iter_expansion_specs() -> Iterator[Spec]:
    """Hinglish + in-app module phrasing (used for corpus rows 30k+)."""
    for topic, fields in FIELD_BY_TOPIC.items():
        for path, label in fields:
            for intent_id, q_tpl, can in HINGLISH_FIELD_TEMPLATES:
                yield Spec(
                    topics=(topic,),
                    fields=(path,),
                    label=label,
                    intent_id=intent_id,
                    question_template=q_tpl,
                    solution_template="Answer using {fields} from context; reply clearly in English.",
                    can_answer=can,
                    kind="hinglish",
                )
            for nav_tpl in MODULE_NAV_TEMPLATES.get(topic, []):
                yield Spec(
                    topics=(topic,),
                    fields=(path,),
                    label=label,
                    intent_id="module-nav",
                    question_template=nav_tpl,
                    solution_template="Direct to the module/screen for {label}; quote {fields} from context.",
                    can_answer=True,
                    kind="module",
                )
    for topics, fields, question, solution, can in HINGLISH_MULTI:
        yield Spec(
            topics=tuple(topics),
            fields=tuple(fields),
            label="account",
            intent_id="hi-multi",
            question_template=question,
            solution_template=solution,
            can_answer=can,
            kind="hinglish",
        )


EXPANSION_SPECS: tuple[Spec, ...] = tuple(iter_expansion_specs())


def _use_expansion_pool(seq: int, focus: str) -> bool:
    if focus in {"hinglish", "modules", "expansion"}:
        return True
    if focus == "modules_only":
        return True
    if focus == "auto" and seq >= EXPANSION_START_SEQ:
        return True
    return False


def _pick_spec(seq: int, focus: str) -> Spec:
    if _use_expansion_pool(seq, focus):
        if focus == "modules_only":
            pool = [s for s in EXPANSION_SPECS if s.kind == "module"] or list(EXPANSION_SPECS)
            return pool[seq % len(pool)]
        return EXPANSION_SPECS[seq % len(EXPANSION_SPECS)]
    return SPECS[seq % len(SPECS)]


def _apply_typo(text: str, variant: int) -> str:
    if variant % 7 != 3:
        return text
    out = text
    for src, dst in TYPO_RULES:
        if src and dst:
            out = out.replace(src, dst)
    return out


def build_question(spec: Spec, variant: int, rng: random.Random, *, seq: int, focus: str = "auto") -> str:
    expansion = spec.kind in {"hinglish", "module"} or _use_expansion_pool(seq, focus)

    if spec.kind in {"multi", "refusal", "hinglish", "module"}:
        base = spec.question_template.format(label=spec.label) if "{label}" in spec.question_template else spec.question_template
    else:
        base = spec.question_template.format(label=spec.label)

    if expansion and spec.kind in {"hinglish", "module"}:
        question = base
    else:
        frame = HINGLISH_FRAMES[variant % len(HINGLISH_FRAMES)]
        if spec.kind in {"multi", "refusal"}:
            question = frame.format(base=base, base_lower=base.lower(), label=spec.label)
            if question == base or "{" in question:
                question = base
        else:
            base_lower = base[0].lower() + base[1:] if base else base
            question = frame.format(base=base, base_lower=base_lower, label=spec.label)
            if "{" in question:
                question = base

    question = _apply_typo(question, variant)
    if expansion:
        phrase = HINGLISH_DISAMBIG[seq % len(HINGLISH_DISAMBIG)]
        question = f"{question}  {phrase}"
    else:
        band = seq // max(len(SPECS), 1)
        if band > 0 or seq % 3 != 0:
            phrase = DISAMBIG_PHRASES[seq % len(DISAMBIG_PHRASES)]
            question = f"{question} {phrase}"
    return question[:500]


def build_solution(spec: Spec) -> str:
    fields_str = ", ".join(spec.fields) if spec.fields else "playbook"
    return spec.solution_template.format(fields=fields_str, label=spec.label)


def build_row(
    *,
    batch: int,
    seq: int,
    spec: Spec,
    variant: int,
    rng: random.Random,
    focus: str = "auto",
) -> dict:
    from generate_help_bot_training_batch import _row

    question = build_question(spec, variant, rng, seq=seq, focus=focus)
    slug_parts = [_slugify(spec.intent_id)]
    if spec.fields:
        slug_parts.append(_slugify(spec.fields[0].split(".")[-1]))
    slug = f"{'-'.join(slug_parts)}-{seq:05d}"
    paraphrases: list[str] = []
    if variant % 13 == 0 and spec.kind == "field":
        alt = build_question(spec, variant + 1, rng, seq=seq + 1, focus=focus)
        if alt != question:
            paraphrases.append(alt[:500])
    return _row(
        batch,
        slug,
        list(spec.topics),
        question,
        context_fields=list(spec.fields),
        solution=build_solution(spec),
        can_answer=spec.can_answer,
        paraphrases=paraphrases,
        escalate_if_missing=None if spec.can_answer else "Required context fields missing in pack.",
    )


def generate_rows(count: int, *, start_seq: int, seed: int, focus: str = "auto") -> list[dict]:
    if count <= 0:
        return []
    rng = random.Random(seed)
    if not SPECS or not EXPANSION_SPECS:
        raise RuntimeError("No corpus specs defined")
    rows: list[dict] = []
    seen_questions: set[str] = set()
    seq = start_seq
    attempts = 0
    max_attempts = count * 3
    while len(rows) < count and attempts < max_attempts:
        attempts += 1
        spec = _pick_spec(seq, focus)
        variant = seq + (seed % 97)
        batch = 1 + (len(rows) + start_seq) // 1000  # placeholder; caller reassigns batch
        row = build_row(batch=batch, seq=seq, spec=spec, variant=variant, rng=rng, focus=focus)
        q_key = row["question"].strip().lower()
        if q_key in seen_questions:
            seq += 1
            continue
        seen_questions.add(q_key)
        rows.append(row)
        seq += 1
    if len(rows) < count:
        raise RuntimeError(f"Could only generate {len(rows)} unique rows, needed {count}")
    return rows
