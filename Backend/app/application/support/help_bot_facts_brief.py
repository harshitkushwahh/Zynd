"""Turn masked context packs into short prose the model (and fallbacks) can use."""

from __future__ import annotations

from typing import Any


def _slice(pack: dict[str, Any], key: str) -> dict[str, Any] | None:
    block = pack.get(key)
    if isinstance(block, dict) and block.get("available"):
        return block
    return None


def build_customer_facts_brief(pack: dict[str, Any]) -> str:
    lines: list[str] = []

    kyc = _slice(pack, "kyc")
    if kyc:
        status = kyc.get("overall_status") or "unknown"
        line = f"KYC overall status is {status}."
        if kyc.get("completed_at"):
            line += f" Completed on {str(kyc['completed_at'])[:10]}."
        if kyc.get("readiness_reason"):
            line += f" Invest readiness: {kyc['readiness_reason']}."
        lines.append(line)

    payments = _slice(pack, "payments")
    if payments:
        ok = payments.get("recent_payment_completed_orders") or payments.get("recent_successful_orders") or []
        bad = payments.get("recent_failed_orders") or []
        lines.append(
            f"Recent orders: {len(ok)} with completed payment, {len(bad)} failed in the latest window."
        )
        if payments.get("last_sip_debit"):
            debit = payments["last_sip_debit"]
            lines.append(
                f"Last successful SIP debit: {debit.get('amount')} on "
                f"{str(debit.get('settled_at') or debit.get('created_at') or '')[:10]}."
            )
        if payments.get("last_sip_failure"):
            fail = payments["last_sip_failure"]
            lines.append(
                f"Last failed SIP attempt: {fail.get('amount')} "
                f"({fail.get('failure_code') or 'no code'}: {fail.get('failure_reason') or 'no reason'})."
            )
        active_sips = [
            p for p in (payments.get("sip_plans") or []) if str(p.get("status")).upper() == "ACTIVE"
        ]
        if active_sips:
            lines.append(f"Active SIP plans: {len(active_sips)}.")

    portfolio = _slice(pack, "portfolio")
    if portfolio:
        lines.append(
            f"Portfolio value {portfolio.get('current_value') or '—'}, "
            f"invested {portfolio.get('invested') or '—'}, "
            f"{portfolio.get('holdings_count') or 0} holdings."
        )
        if portfolio.get("has_pending_orders"):
            lines.append("Some orders are still processing; holdings may update after settlement.")

    account = _slice(pack, "account")
    if account:
        providers = account.get("linked_sign_in_providers") or []
        google = bool(account.get("google_account_linked"))
        apple = bool(account.get("apple_account_linked"))
        mfa_when = str(account.get("mfa_enrolled_at") or "")[:10]
        lines.append(
            f"Account {account.get('account_status') or 'active'}; "
            f"email verified: {bool(account.get('email_verified'))}; "
            f"phone verified: {bool(account.get('phone_verified'))}; "
            f"MFA: {bool(account.get('mfa_enrolled'))}"
            + (f" (since {mfa_when})" if mfa_when else "")
            + f"; Google linked: {google}; Apple linked: {apple}; "
            f"Zynd PIN set: {bool(account.get('pin_enrolled'))}; "
            f"sign-in: {', '.join(providers) if providers else 'password or pending setup'}."
        )

    settings = _slice(pack, "settings")
    if settings:
        nom_when = str(settings.get("nominee_last_updated_at") or "")[:10]
        if settings.get("nominee_count"):
            src = settings.get("nominee_last_update_source") or "profile"
            lines.append(
                f"Nominees on file: {settings.get('nominee_count')}"
                + (f"; last updated {nom_when} (source {src})." if nom_when else ".")
            )
        if settings.get("backup_codes_total"):
            lines.append(
                f"MFA backup codes: {settings.get('backup_codes_remaining')} remaining "
                f"of {settings.get('backup_codes_total')} issued."
            )

    risk = _slice(pack, "risk_profile")
    if risk and risk.get("has_profile"):
        when = str(risk.get("computed_at") or risk.get("updated_at") or "")[:10]
        lines.append(
            f"Risk profile tier: {risk.get('tier_label') or risk.get('tier')} "
            f"(score {risk.get('display_score') or risk.get('score')})"
            + (f", computed {when}." if when else ".")
        )

    reports = _slice(pack, "reports")
    if reports:
        last = reports.get("last_generated")
        if isinstance(last, dict) and last.get("generated_at"):
            lines.append(
                f"Last investor report: {last.get('kind_label') or last.get('kind')} "
                f"generated {str(last['generated_at'])[:10]} ({last.get('status')})."
            )
        elif int(reports.get("report_count") or 0) == 0:
            lines.append("No investor reports generated yet.")

    cart = _slice(pack, "cart")
    if cart is not None:
        lines.append(f"Cart items: {int(cart.get('item_count') or 0)}.")

    goals = _slice(pack, "goals")
    if goals:
        items = goals.get("goals") or []
        if items:
            titles = ", ".join(str(g.get("title") or "Goal") for g in items[:3])
            lines.append(f"Personal goals on file: {titles}.")

    family = _slice(pack, "family_groups")
    if family:
        groups = family.get("groups") or []
        if groups:
            lines.append(f"Family groups: {len(groups)}.")

    referrals = _slice(pack, "referrals")
    if referrals:
        lines.append(
            f"Referral program: code active={bool(referrals.get('has_code'))}, "
            f"signups={referrals.get('signup_count')}, "
            f"KYC verified referrals={referrals.get('kyc_verified_count')}."
        )

    if not lines:
        return "No live account slices were available for this question."
    return " ".join(lines)
