"""Deterministic Help Bot answers for Settings, risk profile, reports, and cart."""

from __future__ import annotations

import re
from typing import Any

_GOOGLE_LINK = re.compile(r"\b(google|gmail)\b.*\b(link|linked|connect|sign-?in)\b|\blink.*google\b", re.I)
_APPLE_LINK = re.compile(r"\bapple\b.*\b(link|linked|connect|sign-?in)\b", re.I)
_MFA_QUESTION = re.compile(
    r"\b(mfa|2fa|two-?factor|authenticator|totp)\b",
    re.I,
)
_BACKUP_CODE_QUESTION = re.compile(
    r"\b(b[aou]*k[aou]*p\s*codes?|backup\s*codes?|recovery\s*codes?)\b",
    re.I,
)
_DEVICE_SESSION_QUESTION = re.compile(
    r"\b(devices?|sessions?|logged\s+in|log(?:ged|)?\s*in|sign[\s-]?in\s+count)\b|"
    r"\bkitne\s+(device|devices|phone|mobile|session|sessions)\b|"
    r"\b(kahan|kaha)\s+(login|logged)\b",
    re.I,
)
_PIN_QUESTION = re.compile(r"\b(zynd pin|pin reset|reset pin|forgot pin|change pin)\b", re.I)
_NOMINEE_QUESTION = re.compile(r"\bnominee\b", re.I)
_NOMINEE_SETTINGS = re.compile(r"\b(settings|setting|profile)\b", re.I)
_RISK_QUESTION = re.compile(
    r"\b(risk profile|risk porfile|risk assessment|risk tier|risk score|meri risk)\b",
    re.I,
)
_REPORT_QUESTION = re.compile(
    r"\b(report|reports|statement|capital gains|account statement|last report)\b",
    re.I,
)
_CART_QUESTION = re.compile(r"\b(cart|basket)\b", re.I)
_EMAIL_UPDATE = re.compile(
    r"\b(email|e-?mail)\b.*\b(update|change|last|when)\b|\b(last|when).*\bemail\b",
    re.I,
)


def _block(pack: dict[str, Any], key: str) -> dict[str, Any] | None:
    node = pack.get(key)
    return node if isinstance(node, dict) and node.get("available") else None


def _date_only(value: str | None) -> str:
    if not value:
        return ""
    return str(value)[:10]


def try_module_deterministic_reply(
    question: str,
    pack: dict[str, Any],
    topics: tuple[str, ...],
) -> str | None:
    normalized = " ".join(question.strip().split())
    account = _block(pack, "account")
    settings = _block(pack, "settings")
    risk = _block(pack, "risk_profile")
    reports = _block(pack, "reports")
    cart = _block(pack, "cart")

    if account and _GOOGLE_LINK.search(normalized):
        if account.get("google_account_linked"):
            return "Yes — a Google sign-in is linked to your Zynd account."
        if account.get("has_password_login"):
            return (
                "No — Google sign-in is not linked on your account. "
                "You can sign in with your email and password, or link Google under Settings → Security."
            )
        return "No — Google sign-in is not linked yet. You can link it from Settings → Security in the app."

    if account and _APPLE_LINK.search(normalized):
        if account.get("apple_account_linked"):
            return "Yes — Apple sign-in is linked to your Zynd account."
        return "No — Apple sign-in is not linked on your account."

    if _BACKUP_CODE_QUESTION.search(normalized):
        if account and not account.get("mfa_enrolled"):
            return (
                "MFA (authenticator) is off, so you don't have backup codes yet. "
                "Turn on MFA under Settings → Security to generate one-time backup codes."
            )
        remaining = settings.get("backup_codes_remaining") if settings else None
        total = settings.get("backup_codes_total") if settings else None
        if remaining is not None and total is not None:
            return (
                f"You have {remaining} unused MFA backup code(s) remaining out of {total} issued on Zynd. "
                "Regenerate or view them under Settings → Security → Backup codes."
            )
        if remaining is not None:
            return (
                f"You have {remaining} unused MFA backup code(s) on file. "
                "Manage them under Settings → Security → Backup codes."
            )
        return (
            "Backup codes are one-time codes you get when MFA (authenticator) is enabled. "
            "Open Settings → Security to view remaining codes or generate new ones."
        )

    if (_MFA_QUESTION.search(normalized) or "authenticator" in normalized.lower()) and account:
        if not account.get("mfa_enrolled"):
            return "Multi-factor authentication (MFA) is off on your account. You can turn it on under Settings → Security."
        when = _date_only(account.get("mfa_enrolled_at"))
        backup = settings.get("backup_codes_remaining") if settings else None
        parts = ["MFA (authenticator) is on for your Zynd account."]
        if when:
            parts.append(f"It was enabled on {when}.")
        if backup is not None:
            parts.append(f"You have {backup} unused backup code(s) on file.")
        parts.append("Manage MFA and backup codes under Settings → Security.")
        return " ".join(parts)

    if _DEVICE_SESSION_QUESTION.search(normalized) and account:
        session_count = account.get("active_session_count")
        device_count = account.get("active_device_count")
        if session_count is not None:
            parts = [f"You have {session_count} active Zynd sign-in session(s) right now."]
            if device_count is not None and device_count != session_count:
                parts.append(f"They span {device_count} device profile(s) (browser/OS combinations).")
            parts.append(
                "Review or sign out devices under Settings → Security → Active sessions. "
                "Use Sign out everywhere if you don't recognize a session."
            )
            return " ".join(parts)
        return (
            "I can't see your active session list from here right now. "
            "Open Settings → Security → Active sessions to see devices and sign out remotely."
        )

    if _PIN_QUESTION.search(normalized) and (account or settings):
        enrolled = bool((account or {}).get("pin_enrolled") or (settings or {}).get("pin_enrolled"))
        when = _date_only((settings or account or {}).get("pin_set_at"))
        how = (
            "To reset your Zynd PIN: open Settings → Security → Zynd PIN, verify with OTP/MFA, "
            "then set a new PIN. If you are locked out, use Forgot PIN on that screen or contact support."
        )
        if enrolled and when:
            return f"Your Zynd PIN is set (last updated {when}). {how}"
        if enrolled:
            return f"Your Zynd PIN is set. {how}"
        return f"You have not set a Zynd PIN yet. Open Settings → Security → Zynd PIN to create one. {how}"

    if _NOMINEE_QUESTION.search(normalized) and settings:
        when = _date_only(settings.get("nominee_last_updated_at"))
        count = int(settings.get("nominee_count") or 0)
        source = settings.get("nominee_last_update_source")
        if count <= 0:
            return "You do not have a nominee on file in Settings yet. Add or update one under Settings → Nominee."
        if _NOMINEE_SETTINGS.search(normalized) or "vapis" in normalized.lower() or "wapas" in normalized.lower():
            src = "Settings" if source == "user" else "your investor profile"
            if when:
                return (
                    f"Your nominee details were last updated on {when} via {src}. "
                    "You can change them anytime under Settings → Nominee."
                )
            return "Your nominee is saved on your account. Open Settings → Nominee to view or edit."

    if (_RISK_QUESTION.search(normalized) or "risk_profile" in topics) and risk:
        if not risk.get("has_profile"):
            return (
                "You have not completed the risk profile questionnaire on Zynd yet. "
                "Open Dashboard → Risk Profile to finish it."
            )
        tier = risk.get("tier_label") or risk.get("tier") or "assigned"
        score = risk.get("display_score") or risk.get("score")
        when = _date_only(risk.get("computed_at") or risk.get("updated_at"))
        score_bit = f" (score {score})" if score is not None else ""
        when_bit = f" Last computed on {when}." if when else ""
        return f"Your Zynd risk profile tier is {tier}{score_bit}.{when_bit} View details under Dashboard → Risk Profile."

    if (_REPORT_QUESTION.search(normalized) or "reports" in topics) and reports:
        last = reports.get("last_generated")
        if not last:
            return (
                "You have not generated an investor report on Zynd yet. "
                "Open Dashboard → Reports to create an account statement, capital gains, or tax report."
            )
        kind = last.get("kind_label") or last.get("kind") or "report"
        when = _date_only(last.get("generated_at"))
        status = last.get("status") or "unknown"
        if status != "completed" or not when:
            return (
                f"Your latest report request ({kind}) is {status}. "
                "Open Dashboard → Reports to download when it shows ready."
            )
        return f"Your last generated report on Zynd was {kind} on {when}. Open Dashboard → Reports to download it again."

    if _CART_QUESTION.search(normalized) and cart:
        count = int(cart.get("item_count") or 0)
        if count == 0:
            return "Your mutual fund cart is empty right now."
        return f"You have {count} product(s) in your cart. Open Mutual Funds → Cart to review or checkout."

    if _EMAIL_UPDATE.search(normalized) and account:
        when = _date_only(account.get("email_changed_at") or account.get("email_verified_at"))
        if when:
            return f"Your email on Zynd was last verified or updated on {when}. Change it under Settings → Profile if needed."
        if account.get("email_verified"):
            return "Your email is verified on Zynd. Update it under Settings → Profile if you need to change it."
        return "Your email is not verified yet. Complete verification under Settings → Profile."

    return None
