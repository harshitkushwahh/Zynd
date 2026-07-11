from __future__ import annotations

NOMINEE_RELATIONSHIP_OPTIONS = [
    {"label": "Father", "value": "father"},
    {"label": "Mother", "value": "mother"},
    {"label": "Spouse", "value": "spouse"},
    {"label": "Son", "value": "son"},
    {"label": "Daughter", "value": "daughter"},
    {"label": "Brother", "value": "brother"},
    {"label": "Sister", "value": "sister"},
    {"label": "Grandfather", "value": "grandfather"},
    {"label": "Grandmother", "value": "grandmother"},
    {"label": "Other", "value": "others"},
]

NOMINEE_SOURCE_OF_WEALTH_OPTIONS = [
    {"label": "Salary", "value": "salary"},
    {"label": "Business", "value": "business"},
    {"label": "Gift", "value": "gift"},
    {"label": "Ancestral property", "value": "ancestral_property"},
    {"label": "Rental income", "value": "rental_income"},
    {"label": "Prize money", "value": "prize_money"},
    {"label": "Royalty", "value": "royalty"},
    {"label": "Other", "value": "others"},
]

NOMINEE_DOCUMENT_TYPE_OPTIONS = [
    {"label": "PAN", "value": "pan"},
    {"label": "Aadhaar", "value": "aadhaar"},
    {"label": "Passport", "value": "passport"},
    {"label": "Driving licence", "value": "driving_licence"},
    {"label": "Voter ID", "value": "voter_id"},
]


def nominee_master_data_enums() -> dict[str, list[dict[str, str]]]:
    return {
        "relationships": NOMINEE_RELATIONSHIP_OPTIONS,
        "sourceOfWealth": NOMINEE_SOURCE_OF_WEALTH_OPTIONS,
        "documentTypes": NOMINEE_DOCUMENT_TYPE_OPTIONS,
    }
