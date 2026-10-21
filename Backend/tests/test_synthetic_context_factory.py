from app.application.support.synthetic_context_factory import (
    build_synthetic_context_pack,
    materialize_grounded_answer,
    resolve_context_path,
    seed_from_row_id,
)


def test_seed_stable_per_row_id() -> None:
    assert seed_from_row_id("b001-kyc-01") == seed_from_row_id("b001-kyc-01")
    assert seed_from_row_id("b001-kyc-01") != seed_from_row_id("b001-kyc-02")


def test_build_pack_includes_requested_topics() -> None:
    pack = build_synthetic_context_pack(["kyc", "payment"], row_id="test-row-1")
    assert "kyc" in pack
    assert "payments" in pack
    assert pack["kyc"]["available"] is True


def test_resolve_kyc_completed_at() -> None:
    pack = build_synthetic_context_pack(["kyc"], row_id="test-row-2")
    pack["kyc"]["overall_status"] = "completed"
    pack["kyc"]["completed_at"] = "2026-01-15T10:00:00+00:00"
    assert resolve_context_path(pack, "kyc.completed_at") == "2026-01-15T10:00:00+00:00"


def test_missing_fields_force_cannot_answer() -> None:
    pack = build_synthetic_context_pack(
        ["kyc"],
        row_id="test-row-3",
        context_fields=["kyc.completed_at"],
        can_answer=False,
    )
    can, answer = materialize_grounded_answer(
        question="When was KYC completed?",
        solution="Escalate if missing.",
        context_fields=["kyc.completed_at"],
        pack=pack,
        can_answer=False,
    )
    assert can is False
    assert "Escalate" in answer


def test_grounded_answer_quotes_context() -> None:
    pack = build_synthetic_context_pack(["account"], row_id="test-row-4")
    pack["account"]["email_verified"] = True
    can, answer = materialize_grounded_answer(
        question="Is my email verified?",
        solution="Use email_verified flag.",
        context_fields=["account.email_verified"],
        pack=pack,
        can_answer=True,
    )
    assert can is True
    assert "email verified" in answer.lower()
