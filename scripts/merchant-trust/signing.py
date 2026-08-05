"""
eddsa-jcs-2022 signing primitives — byte-identical to opkey.py and
api/crypto_utils.sign_eddsa_jcs_2022. This module is the server-side
counterpart; it loads keys from a hex env var rather than an encrypted
keyfile.

hashData = SHA-256(JCS(proofConfig)) || SHA-256(JCS(unsecuredDocument))
proofValue = multibase base58btc (prefix 'z')

Deps: cryptography, jcs
"""

import hashlib
import os
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)
from cryptography.exceptions import InvalidSignature

try:
    import jcs as _jcs
except ImportError:
    raise ImportError(
        "The 'jcs' package is required (pip install jcs). "
        "It must match the library used by the deployed verifier."
    )

EDDSA_JCS_2022_TYPE = "DataIntegrityProof"
EDDSA_JCS_2022_CRYPTOSUITE = "eddsa-jcs-2022"

# Ed25519 public key multicodec prefix (varint 0xed01)
ED25519_PUB_MULTICODEC = b"\xed\x01"

_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(data: bytes) -> str:
    num = int.from_bytes(data, "big")
    out = ""
    while num > 0:
        num, rem = divmod(num, 58)
        out = _B58[rem] + out
    pad = len(data) - len(data.lstrip(b"\x00"))
    return "1" * pad + out


def b58decode(s: str) -> bytes:
    num = 0
    for ch in s:
        num = num * 58 + _B58.index(ch)
    result = []
    while num > 0:
        num, rem = divmod(num, 256)
        result.append(rem)
    pad = len(s) - len(s.lstrip("1"))
    return b"\x00" * pad + bytes(reversed(result))


def public_key_multibase(pub: Ed25519PublicKey) -> str:
    raw = pub.public_bytes_raw()
    return "z" + b58encode(ED25519_PUB_MULTICODEC + raw)


def load_key_from_hex(hex_str: str) -> Ed25519PrivateKey:
    return Ed25519PrivateKey.from_private_bytes(bytes.fromhex(hex_str.strip()))


def load_key_from_env(env_var: str) -> Ed25519PrivateKey:
    val = os.environ.get(env_var)
    if not val:
        raise EnvironmentError(f"Environment variable {env_var!r} not set")
    return load_key_from_hex(val)


def generate_key() -> Ed25519PrivateKey:
    return Ed25519PrivateKey.generate()


def _eddsa_jcs_2022_hash_data(document_no_proof: dict, proof_options: dict) -> bytes:
    proof_config = {k: v for k, v in proof_options.items() if k != "proofValue"}
    return (
        hashlib.sha256(_jcs.canonicalize(proof_config)).digest()
        + hashlib.sha256(_jcs.canonicalize(document_no_proof)).digest()
    )


def sign_eddsa_jcs_2022(
    document: dict,
    priv: Ed25519PrivateKey,
    *,
    vm: str,
    created: str,
) -> dict:
    if "#" not in vm:
        raise ValueError("verificationMethod must contain a fragment (#)")
    document_no_proof = {k: v for k, v in document.items() if k != "proof"}
    proof_options = {
        "type": EDDSA_JCS_2022_TYPE,
        "cryptosuite": EDDSA_JCS_2022_CRYPTOSUITE,
        "created": created,
        "verificationMethod": vm,
        "proofPurpose": "assertionMethod",
    }
    if "@context" in document_no_proof:
        proof_options["@context"] = document_no_proof["@context"]
    sig = priv.sign(_eddsa_jcs_2022_hash_data(document_no_proof, proof_options))
    proof_block = dict(proof_options)
    proof_block["proofValue"] = "z" + b58encode(sig)
    signed = dict(document_no_proof)
    signed["proof"] = proof_block
    return signed


def verify_eddsa_jcs_2022(document: dict, pub: Ed25519PublicKey) -> bool:
    proof = document.get("proof") or {}
    if proof.get("type") != EDDSA_JCS_2022_TYPE or proof.get("cryptosuite") != EDDSA_JCS_2022_CRYPTOSUITE:
        raise ValueError(
            f"not an eddsa-jcs-2022 proof: {proof.get('type')}/{proof.get('cryptosuite')}"
        )
    pv = proof.get("proofValue", "")
    if not pv.startswith("z"):
        raise ValueError("proofValue must be multibase base58btc (prefix 'z')")
    sig = b58decode(pv[1:])
    document_no_proof = {k: v for k, v in document.items() if k != "proof"}
    proof_options = {k: v for k, v in proof.items() if k != "proofValue"}
    try:
        pub.verify(sig, _eddsa_jcs_2022_hash_data(document_no_proof, proof_options))
        return True
    except InvalidSignature:
        return False
