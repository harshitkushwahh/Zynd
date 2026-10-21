"""Canonical context-pack field catalog for coverage and eval (Phase 0)."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

TOPICS = ("kyc", "payment", "portfolio", "family", "goals", "account", "referrals")


@dataclass(frozen=True)
class FieldSpec:
    path: str
    topic: str
    label: str
    value_type: str
    question_hints: tuple[str, ...]


def _hints(*items: str) -> tuple[str, ...]:
    return items


CATALOG: tuple[FieldSpec, ...] = (
    # KYC
    FieldSpec("kyc.overall_status", "kyc", "KYC status", "enum", _hints("What is my KYC status?", "Is KYC complete?")),
    FieldSpec("kyc.completed_at", "kyc", "KYC completion date", "datetime", _hints("When was KYC completed?")),
    FieldSpec("kyc.status_last_updated_at", "kyc", "KYC last update", "datetime", _hints("When did KYC status change?")),
    FieldSpec("kyc.steps.pan", "kyc", "PAN step", "enum", _hints("Is PAN verification done?")),
    FieldSpec("kyc.steps.digilocker", "kyc", "DigiLocker step", "enum", _hints("DigiLocker status?")),
    FieldSpec("kyc.steps.address", "kyc", "address step", "enum", _hints("Address proof status?")),
    FieldSpec("kyc.steps.personal", "kyc", "personal details step", "enum", _hints("Personal details step status?")),
    FieldSpec("kyc.steps.nominee", "kyc", "nominee step", "enum", _hints("Nominee step submitted?")),
    FieldSpec("kyc.steps.bank", "kyc", "bank step", "enum", _hints("Bank verification step?")),
    FieldSpec("kyc.steps.signature", "kyc", "signature step", "enum", _hints("Signature uploaded?")),
    FieldSpec("kyc.steps.review", "kyc", "review step", "enum", _hints("KYC review submitted?")),
    FieldSpec("kyc.last_completed_step", "kyc", "last completed step", "string", _hints("Where do I resume KYC?")),
    FieldSpec("kyc.readiness_code", "kyc", "readiness code", "enum", _hints("Why can't I invest?")),
    FieldSpec("kyc.readiness_reason", "kyc", "readiness reason", "string", _hints("What is blocking invest?")),
    FieldSpec("kyc.pan_verification_status", "kyc", "PAN verification", "enum", _hints("PAN verified?")),
    FieldSpec("kyc.bank_verification_status", "kyc", "bank verification", "enum", _hints("Bank verified?")),
    FieldSpec("kyc.external_kyc_status", "kyc", "external KYC", "enum", _hints("Registrar KYC status?")),
    FieldSpec("kyc.kyc_already_registered", "kyc", "existing KYC flag", "bool", _hints("Already registered elsewhere?")),
    # Payments
    FieldSpec(
        "payments.last_sip_debit.settled_at",
        "payment",
        "last SIP debit date",
        "datetime",
        _hints("When was my last SIP debit?"),
    ),
    FieldSpec(
        "payments.last_sip_debit.amount",
        "payment",
        "last SIP debit amount",
        "money",
        _hints("How much was last SIP debit?"),
    ),
    FieldSpec(
        "payments.last_sip_debit.status",
        "payment",
        "last SIP debit status",
        "enum",
        _hints("Did last SIP succeed?"),
    ),
    FieldSpec(
        "payments.last_sip_failure.failure_reason",
        "payment",
        "last SIP failure reason",
        "string",
        _hints("Why did SIP fail?"),
    ),
    FieldSpec(
        "payments.last_sip_failure.failed_at",
        "payment",
        "last SIP failure time",
        "datetime",
        _hints("When did SIP last fail?"),
    ),
    FieldSpec("payments.recent_orders", "payment", "recent orders", "list", _hints("Latest order status?")),
    FieldSpec(
        "payments.recent_orders.failure_reason",
        "payment",
        "order failure reason",
        "string",
        _hints("Why did payment fail?"),
    ),
    FieldSpec("payments.sip_plans", "payment", "SIP plans", "list", _hints("List my SIPs")),
    FieldSpec("payments.sip_plans.status", "payment", "SIP plan status", "enum", _hints("Is my SIP active?")),
    FieldSpec(
        "payments.sip_plans.next_installment_date",
        "payment",
        "next SIP date",
        "date",
        _hints("When is next SIP?"),
    ),
    FieldSpec("payments.sip_plans.frequency", "payment", "SIP frequency", "enum", _hints("Monthly or weekly SIP?")),
    FieldSpec("payments.sip_plans.amount", "payment", "SIP amount", "money", _hints("SIP installment amount?")),
    FieldSpec("payments.failed_sip_plans", "payment", "failed SIP plans", "list", _hints("Any failed SIP plans?")),
    # Portfolio
    FieldSpec("portfolio.status", "portfolio", "portfolio status", "enum", _hints("Portfolio loading error?")),
    FieldSpec(
        "portfolio.has_pending_orders",
        "portfolio",
        "pending orders",
        "bool",
        _hints("Why portfolio pending after payment?"),
    ),
    FieldSpec("portfolio.current_value", "portfolio", "current value", "money", _hints("Portfolio worth today?")),
    FieldSpec("portfolio.invested", "portfolio", "invested amount", "money", _hints("Total invested?")),
    FieldSpec("portfolio.total_return", "portfolio", "total return", "money", _hints("Gain or loss?")),
    FieldSpec("portfolio.holdings_count", "portfolio", "holdings count", "int", _hints("How many funds?")),
    FieldSpec("portfolio.active_sips_count", "portfolio", "active SIP count", "int", _hints("How many active SIPs?")),
    FieldSpec("portfolio.monthly_sip", "portfolio", "monthly SIP total", "money", _hints("Monthly SIP total?")),
    FieldSpec("portfolio.as_on", "portfolio", "as-on date", "datetime", _hints("How fresh is portfolio data?")),
    # Account
    FieldSpec("account.account_status", "account", "account status", "enum", _hints("Is account restricted?")),
    FieldSpec("account.email_verified", "account", "email verified", "bool", _hints("Email verified?")),
    FieldSpec("account.email_verified_at", "account", "email verified date", "datetime", _hints("When email verified?")),
    FieldSpec("account.phone_verified", "account", "phone verified", "bool", _hints("Phone verified for OTP?")),
    FieldSpec("account.phone_verified_at", "account", "phone verified date", "datetime", _hints("When phone verified?")),
    FieldSpec("account.mfa_enrolled", "account", "MFA enrolled", "bool", _hints("Is MFA on?")),
    FieldSpec("account.has_password_login", "account", "password login", "bool", _hints("Password login enabled?")),
    FieldSpec(
        "account.google_account_linked",
        "account",
        "Google linked",
        "bool",
        _hints("Google sign-in linked?"),
    ),
    FieldSpec(
        "account.apple_account_linked",
        "account",
        "Apple linked",
        "bool",
        _hints("Apple sign-in linked?"),
    ),
    FieldSpec(
        "account.linked_sign_in_providers",
        "account",
        "sign-in providers",
        "list",
        _hints("How do I sign in?"),
    ),
    FieldSpec("account.country_code", "account", "country code", "string", _hints("Account country?")),
    # Goals
    FieldSpec("goals.goals", "goals", "goals list", "list", _hints("What goals do I have?")),
    FieldSpec("goals.goals.progress_pct", "goals", "goal progress", "float", _hints("Goal progress percent?")),
    FieldSpec("goals.goals.target_amount", "goals", "goal target", "money", _hints("Goal target amount?")),
    FieldSpec("goals.goals.current_amount", "goals", "goal current amount", "money", _hints("Goal saved so far?")),
    FieldSpec("goals.goals.target_date", "goals", "goal target date", "date", _hints("Goal deadline?")),
    FieldSpec("goals.goals.status", "goals", "goal status", "enum", _hints("Is goal active?")),
    FieldSpec("goals.goals.title", "goals", "goal title", "string", _hints("Goal name?")),
    # Family
    FieldSpec("family_groups.groups", "family", "family groups", "list", _hints("Am I in a family group?")),
    FieldSpec("family_groups.groups.my_role", "family", "family role", "enum", _hints("Am I family head?")),
    FieldSpec("family_groups.groups.member_count", "family", "member count", "int", _hints("Family member count?")),
    FieldSpec("family_groups.groups.status", "family", "group status", "enum", _hints("Family group status?")),
    FieldSpec("family_groups.groups.title", "family", "group title", "string", _hints("Family group name?")),
    # Referrals
    FieldSpec("referrals.has_code", "referrals", "has referral code", "bool", _hints("Do I have referral code?")),
    FieldSpec("referrals.click_count", "referrals", "referral clicks", "int", _hints("Referral link clicks?")),
    FieldSpec("referrals.signup_count", "referrals", "referral signups", "int", _hints("Friends signed up?")),
    FieldSpec(
        "referrals.kyc_verified_count",
        "referrals",
        "referrals KYC done",
        "int",
        _hints("Referrals completed KYC?"),
    ),
    FieldSpec(
        "referrals.first_investment_count",
        "referrals",
        "referrals invested",
        "int",
        _hints("Referrals who invested?"),
    ),
)

PATH_TO_SPEC: dict[str, FieldSpec] = {spec.path: spec for spec in CATALOG}

# Back-compat for parametric corpus generator
FIELD_BY_TOPIC: dict[str, list[tuple[str, str]]] = {}
for spec in CATALOG:
    FIELD_BY_TOPIC.setdefault(spec.topic, []).append((spec.path, spec.label))


def catalog_as_json() -> list[dict[str, Any]]:
    return [asdict(spec) for spec in CATALOG]


def all_paths() -> frozenset[str]:
    return frozenset(PATH_TO_SPEC)


def prefix_match_path(field_ref: str) -> str | None:
    """Map training context_fields entry to a catalog path (exact or best prefix)."""
    cleaned = field_ref.strip()
    if cleaned in PATH_TO_SPEC:
        return cleaned
    parts = cleaned.split(".")
    for end in range(len(parts), 0, -1):
        candidate = ".".join(parts[:end])
        if candidate in PATH_TO_SPEC:
            return candidate
    return None
