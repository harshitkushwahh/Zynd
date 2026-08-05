MAX_FAMILY_GROUPS_PER_USER = 5
MAX_FAMILY_GROUP_MEMBERS = 12
MAX_FAMILY_GROUP_TITLE_LENGTH = 80
MAX_FAMILY_GROUP_DESCRIPTION_LENGTH = 500
MAX_FAMILY_GROUP_TAG_LENGTH = 32
FAMILY_GROUP_INVITE_VALIDITY_DAYS = 7
FAMILY_INVITE_REMINDER_HOURS = 48
MAX_FAMILY_GROUP_NICKNAME_LENGTH = 64

FAMILY_GROUP_BADGE_PRESETS: list[tuple[str, str]] = [
    ("wife", "Wife"),
    ("husband", "Husband"),
    ("son", "Son"),
    ("daughter", "Daughter"),
    ("mother", "Mother"),
    ("father", "Father"),
    ("sibling", "Sibling"),
    ("custom", "Custom"),
]
