"""Resolve Indian bank display names from stored metadata or IFSC codes."""

from __future__ import annotations

IFSC_PREFIX_TO_BANK_NAME: dict[str, str] = {
    "HDFC": "HDFC Bank",
    "ICIC": "ICICI Bank",
    "SBIN": "State Bank of India",
    "UTIB": "Axis Bank",
    "KKBK": "Kotak Mahindra Bank",
    "PUNB": "Punjab National Bank",
    "BARB": "Bank of Baroda",
    "CNRB": "Canara Bank",
    "BKID": "Bank of India",
    "MAHB": "Bank of Maharashtra",
    "UBIN": "Union Bank of India",
    "IDFB": "IDFC FIRST Bank",
    "INDB": "IndusInd Bank",
    "YESB": "YES Bank",
    "FDRL": "Federal Bank",
    "CSBK": "CSB Bank",
    "RATN": "RBL Bank",
    "AUBL": "AU Small Finance Bank",
    "BDBL": "Bandhan Bank",
    "IDIB": "Indian Bank",
    "IOBA": "Indian Overseas Bank",
    "PSIB": "Punjab & Sind Bank",
    "UCBA": "UCO Bank",
    "CBIN": "Central Bank of India",
    "KVBL": "Karur Vysya Bank",
    "CIUB": "City Union Bank",
    "ESFB": "Equitas Small Finance Bank",
    "JSFB": "Jana Small Finance Bank",
    "UJVN": "Ujjivan Small Finance Bank",
    "AIRP": "Airtel Payments Bank",
    "PYTM": "Paytm Payments Bank",
    "FINO": "Fino Payments Bank",
    "IPOS": "India Post Payments Bank",
    "IBKL": "IDBI Bank",
    "KARB": "Karnataka Bank",
    "SIBL": "South Indian Bank",
    "SCBL": "Standard Chartered",
    "HSBC": "HSBC",
    "CITI": "Citibank",
    "DEUT": "Deutsche Bank",
    "DBSS": "DBS Bank",
    "NTBL": "Nainital Bank",
    "TMBL": "Tamilnad Mercantile Bank",
    "DCBL": "DCB Bank",
    "DLXB": "Dhanlaxmi Bank",
    "JAKA": "Jammu & Kashmir Bank",
    "ESAF": "ESAF Small Finance Bank",
    "SURY": "Suryoday Small Finance Bank",
    "UTKS": "Utkarsh Small Finance Bank",
    "NSPB": "NSDL Payments Bank",
    "JIOP": "Jio Payments Bank",
    "SYNB": "Canara Bank",
    "CORP": "Union Bank of India",
    "ALLA": "Indian Bank",
    "ORBC": "Bank of Baroda",
}


def resolve_bank_display_name(
    bank_name: str | None,
    ifsc_code: str | None = None,
) -> str | None:
    name = str(bank_name or "").strip()
    if name and name.lower() not in {"bank", "unknown", "unknown bank"}:
        return name

    prefix = str(ifsc_code or "").strip().upper()[:4]
    if prefix:
        resolved = IFSC_PREFIX_TO_BANK_NAME.get(prefix)
        if resolved:
            return resolved

    return name or None


def format_bank_account_label(
    *,
    bank_name: str | None,
    last4: str | None,
    ifsc_code: str | None = None,
) -> str | None:
    resolved_name = resolve_bank_display_name(bank_name, ifsc_code)
    if not resolved_name:
        return None
    last4_digits = str(last4 or "").strip()
    if last4_digits:
        return f"{resolved_name} ....{last4_digits}"
    return resolved_name
