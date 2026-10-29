from __future__ import annotations

import base64
import hashlib
import json
import os
from typing import Any
from urllib.parse import quote

from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.asymmetric.padding import PKCS1v15
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


class MfCentralCryptoError(Exception):
    pass


def _b64url_decode(value: str) -> bytes:
    padded = value + ("=" * (-len(value) % 4))
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_uint(value: str) -> int:
    return int.from_bytes(_b64url_decode(value), "big")


def api_aes_key(encryption_key: str) -> bytes:
    return hashlib.sha256(encryption_key.encode("utf-8")).digest()[:32]


def _pkcs7_pad(data: bytes) -> bytes:
    padder = padding.PKCS7(128).padder()
    return padder.update(data) + padder.finalize()


def _pkcs7_unpad(data: bytes) -> bytes:
    unpadder = padding.PKCS7(128).unpadder()
    return unpadder.update(data) + unpadder.finalize()


def encrypt_api_payload(payload: dict[str, Any], *, encryption_key: str, iv: str) -> str:
    iv_bytes = iv.encode("utf-8")
    if len(iv_bytes) != 16:
        raise MfCentralCryptoError("MF Central AES IV must be 16 bytes")
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    cipher = Cipher(algorithms.AES(api_aes_key(encryption_key)), modes.CBC(iv_bytes))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(_pkcs7_pad(raw)) + encryptor.finalize()
    return _b64url_encode(ciphertext)


def decrypt_api_payload(ciphertext: str, *, encryption_key: str, iv: str) -> dict[str, Any]:
    iv_bytes = iv.encode("utf-8")
    if len(iv_bytes) != 16:
        raise MfCentralCryptoError("MF Central AES IV must be 16 bytes")
    try:
        encrypted = _b64url_decode(ciphertext)
    except Exception as exc:
        raise MfCentralCryptoError("MF Central ciphertext is not base64") from exc
    cipher = Cipher(algorithms.AES(api_aes_key(encryption_key)), modes.CBC(iv_bytes))
    decryptor = cipher.decryptor()
    try:
        raw = _pkcs7_unpad(decryptor.update(encrypted) + decryptor.finalize())
        parsed = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise MfCentralCryptoError("MF Central response could not be decrypted") from exc
    if not isinstance(parsed, dict):
        raise MfCentralCryptoError("MF Central response was not a JSON object")
    return parsed


def encrypt_launch_payload(payload: dict[str, Any], *, url_key: str) -> str:
    key = url_key.encode("utf-8")
    if len(key) != 32:
        raise MfCentralCryptoError("MF Central URL encryption key must be 32 bytes")
    iv = os.urandom(16)
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(_pkcs7_pad(raw)) + encryptor.finalize()
    combined = f"{iv.hex()}:{ciphertext.hex()}"
    return quote(combined, safe="")


def load_private_key(raw: str) -> tuple[rsa.RSAPrivateKey, str]:
    parsed = _load_jwk_json(raw)
    key = parsed["keys"][0] if isinstance(parsed, dict) and isinstance(parsed.get("keys"), list) else parsed
    if not isinstance(key, dict):
        raise MfCentralCryptoError("MF Central private key is not a JWK")
    try:
        private_numbers = rsa.RSAPrivateNumbers(
            p=_b64url_uint(str(key["p"])),
            q=_b64url_uint(str(key["q"])),
            d=_b64url_uint(str(key["d"])),
            dmp1=_b64url_uint(str(key["dp"])),
            dmq1=_b64url_uint(str(key["dq"])),
            iqmp=_b64url_uint(str(key["qi"])),
            public_numbers=rsa.RSAPublicNumbers(
                e=_b64url_uint(str(key["e"])),
                n=_b64url_uint(str(key["n"])),
            ),
        )
        private_key = private_numbers.private_key()
    except Exception as exc:
        raise MfCentralCryptoError("MF Central private key could not be loaded") from exc
    kid = str(key.get("kid") or "")
    if not kid:
        raise MfCentralCryptoError("MF Central private key is missing kid")
    return private_key, kid


def load_public_key(raw: str) -> rsa.RSAPublicKey:
    parsed = _load_jwk_json(raw)
    key = parsed["keys"][0] if isinstance(parsed, dict) and isinstance(parsed.get("keys"), list) else parsed
    if not isinstance(key, dict):
        raise MfCentralCryptoError("MF Central public key is not a JWK")
    try:
        return rsa.RSAPublicNumbers(
            e=_b64url_uint(str(key["e"])),
            n=_b64url_uint(str(key["n"])),
        ).public_key()
    except Exception as exc:
        raise MfCentralCryptoError("MF Central public key could not be loaded") from exc


def sign_detached(payload: str, *, private_key: rsa.RSAPrivateKey, kid: str) -> str:
    header = {"alg": "RS256", "kid": kid, "b64": False}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    signing_input = header_b64.encode("ascii") + b"." + payload.encode("utf-8")
    signature = private_key.sign(signing_input, PKCS1v15(), hashes.SHA256())
    return f"{header_b64}..{_b64url_encode(signature)}"


def verify_detached(signature: str, payload: str, *, public_key: rsa.RSAPublicKey) -> None:
    parts = signature.split(".")
    if len(parts) != 3 or not parts[0] or not parts[2]:
        raise MfCentralCryptoError("MF Central signature is not a detached JWS")
    header_b64, _middle, sig_b64 = parts
    try:
        header = json.loads(_b64url_decode(header_b64))
    except Exception as exc:
        raise MfCentralCryptoError("MF Central signature header is invalid") from exc
    if header.get("b64") is False:
        signing_input = header_b64.encode("ascii") + b"." + payload.encode("utf-8")
    else:
        signing_input = f"{header_b64}.{_b64url_encode(payload.encode('utf-8'))}".encode("ascii")
    try:
        public_key.verify(_b64url_decode(sig_b64), signing_input, PKCS1v15(), hashes.SHA256())
    except Exception as exc:
        raise MfCentralCryptoError("MF Central signature verification failed") from exc


def _load_jwk_json(raw: str) -> Any:
    text = raw.strip()
    if len(text) >= 2 and text[0] == text[-1] and text[0] in {"'", '"'}:
        text = text[1:-1]
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise MfCentralCryptoError("MF Central key is not valid JSON") from exc
