from app.core.config import Settings


def test_brevo_resolves_smtp_when_placeholders_present() -> None:
    settings = Settings(
        smtp_host="smtp.yourprovider.com",
        smtp_username="...",
        smtp_password="...",
        email_from="security@zynd.co",
        brevo_smtp_key="xsmtpsib-test",
        brevo_smtp_login="af649e001@smtp-brevo.com",
        brevo_from="Zynd Support <support@zynd.shop>",
    )

    assert settings.smtp_host == "smtp-relay.brevo.com"
    assert settings.smtp_username == "af649e001@smtp-brevo.com"
    assert settings.smtp_password == "xsmtpsib-test"
    assert settings.email_from == "Zynd Support <support@zynd.shop>"


def test_explicit_smtp_overrides_brevo_host() -> None:
    settings = Settings(
        smtp_host="mail.example.com",
        smtp_username="user@example.com",
        smtp_password="secret",
        email_from="noreply@example.com",
        brevo_smtp_key="xsmtpsib-test",
        brevo_smtp_login="af649e001@smtp-brevo.com",
        brevo_from="Zynd Support <support@zynd.shop>",
    )

    assert settings.smtp_host == "mail.example.com"
    assert settings.smtp_username == "user@example.com"
    assert settings.smtp_password == "secret"
    assert settings.email_from == "noreply@example.com"


def test_brevo_ignored_without_smtp_key() -> None:
    settings = Settings(
        smtp_host="",
        brevo_smtp_key="",
        brevo_smtp_login="af649e001@smtp-brevo.com",
        brevo_from="Zynd Support <support@zynd.shop>",
    )

    assert settings.smtp_host == ""
    assert settings.email_from == ""
