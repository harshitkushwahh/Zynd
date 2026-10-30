from app.application.support.help_bot_module_replies import try_module_deterministic_reply


def _pack(**blocks):
    out = {}
    for key, payload in blocks.items():
        out[key] = {"available": True, **payload}
    return out


def test_google_linked_yes() -> None:
    reply = try_module_deterministic_reply(
        "Is my Google account linked to Zynd?",
        _pack(account={"google_account_linked": True, "has_password_login": True}),
        ("account",),
    )
    assert reply is not None
    assert "Yes" in reply
    assert "Google" in reply


def test_risk_profile_tier() -> None:
    reply = try_module_deterministic_reply(
        "meri risk profile kitni bani hai",
        _pack(
            risk_profile={
                "has_profile": True,
                "tier": "moderate",
                "tier_label": "Moderate",
                "display_score": 42,
                "computed_at": "2026-10-08T12:00:00+00:00",
            }
        ),
        ("risk_profile",),
    )
    assert reply is not None
    assert "Moderate" in reply or "moderate" in reply
    assert "2026-10-08" in reply


def test_nominee_settings_update_date() -> None:
    reply = try_module_deterministic_reply(
        "nahi mene vapis settings mai se nominee update kiya tha",
        _pack(
            settings={
                "nominee_count": 1,
                "nominee_last_updated_at": "2026-10-15T10:00:00+00:00",
                "nominee_last_update_source": "user",
            }
        ),
        ("account",),
    )
    assert reply is not None
    assert "2026-10-15" in reply
    assert "Settings" in reply


def test_last_report_not_kyc() -> None:
    reply = try_module_deterministic_reply(
        "last report kab generate hui hai",
        _pack(
            reports={
                "report_count": 1,
                "last_generated": {
                    "kind": "account_statement",
                    "kind_label": "Account statement",
                    "status": "completed",
                    "generated_at": "2026-10-12T09:00:00+00:00",
                },
            }
        ),
        ("reports",),
    )
    assert reply is not None
    assert "2026-10-12" in reply
    assert "Account statement" in reply or "account" in reply.lower()


def test_zynd_pin_reset_how_to() -> None:
    reply = try_module_deterministic_reply(
        "zynd pin kese reset kre",
        _pack(account={"pin_enrolled": True}, settings={"pin_enrolled": True, "pin_set_at": "2026-09-01T00:00:00+00:00"}),
        ("account",),
    )
    assert reply is not None
    assert "Settings" in reply
    assert "PIN" in reply
