from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()

# Used for constant-time login comparisons when the account does not exist.
TIMING_SAFE_DUMMY_HASH = _hasher.hash("__zynd_timing_safe_dummy__")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
