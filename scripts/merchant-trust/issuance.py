"""
Builds MerchantTrustCredentials, merchant DID documents, and the
BitstringStatusListCredential for the AT Directory portable-trust Phase 1.

All signed artifacts use eddsa-jcs-2022 (DataIntegrityProof). None of the
functions here make network calls; signing is pure local crypto.
"""

import base64
import gzip
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from signing import (
    Ed25519PrivateKey,
    public_key_multibase,
    sign_eddsa_jcs_2022,
)

# ────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────

DIRECTORY_URL = "https://agenticterminal.ai"
ISSUER_DID = "did:web:observerprotocol.org"
# NO credentialSchema. The schema this named — https://observerprotocol.org/schemas/merchant-trust/v1.json
# — was never authored and returns 404. A credentialSchema pointing at a document that does not exist
# is worse than none: it is a claim that the credential was validated against something, aimed at a
# URL a verifier cannot fetch, so the check it invites can only ever fail or be skipped.
#
# Merchant trust belongs to agenticterminal.ai, the merchant directory, which is not maintained here,
# so the schema is not being written. `credentialSchema` is optional in W3C VC 2.0 and its absence is
# the honest state: nothing validates these against a schema, and now nothing says otherwise.
STATUS_LIST_URL = f"{DIRECTORY_URL}/status/merchant-trust/v1.json"
VC_VALIDITY_DAYS = 90
STATUS_LIST_SIZE_BITS = 131072  # W3C minimum (16 KB)


# ────────────────────────────────────────────
# Merchant DID documents
# ────────────────────────────────────────────

def merchant_did(merchant_id: str) -> str:
    return f"did:web:agenticterminal.ai:merchants:{merchant_id}"


def build_merchant_did_document(
    merchant_id: str,
    service_pubkey_multibase: str,
    merchant_controlled_key_multibase: Optional[str] = None,
) -> dict:
    """
    Produce a minimal DID document for an AT-hosted merchant DID.

    The DID resolves at:
      https://agenticterminal.ai/merchants/<merchant_id>/did.json

    service_pubkey_multibase  — the AT Directory service public key (Multikey,
                                multicodec-prefixed Ed25519, multibase base58btc).
                                The same key is used for all AT-hosted merchant DIDs.
                                Controls the DID on AT's behalf.
    merchant_controlled_key_multibase — optional. When a merchant or agent holds
                                        their own key, include it as a second VM
                                        to enable holder-binding and Phase 4 A2A.
    """
    did = merchant_did(merchant_id)
    at_vm_id = f"{did}#at-key-1"

    vm_list = [
        {
            "id": at_vm_id,
            "type": "Multikey",
            "controller": did,
            "publicKeyMultibase": service_pubkey_multibase,
        }
    ]

    if merchant_controlled_key_multibase:
        merchant_vm_id = f"{did}#merchant-key-1"
        vm_list.append(
            {
                "id": merchant_vm_id,
                "type": "Multikey",
                "controller": did,
                "publicKeyMultibase": merchant_controlled_key_multibase,
            }
        )

    return {
        "@context": [
            "https://www.w3.org/ns/did/v1",
            "https://w3id.org/security/multikey/v1",
        ],
        "id": did,
        "verificationMethod": vm_list,
        "authentication": [at_vm_id],
        "assertionMethod": [at_vm_id],
    }


# ────────────────────────────────────────────
# BitstringStatusListCredential
# ────────────────────────────────────────────

def _encode_bitstring(bits: bytearray) -> str:
    """GZIP-compress a bitstring, then base64url-encode (no padding) per W3C spec."""
    compressed = gzip.compress(bytes(bits), compresslevel=9)
    return base64.urlsafe_b64encode(compressed).rstrip(b"=").decode()


def build_status_list_credential(
    signing_key: Ed25519PrivateKey,
    vm_uri: str,
    revoked_indices: Optional[list[int]] = None,
    issued_at: Optional[datetime] = None,
) -> dict:
    """
    Build and sign a fresh BitstringStatusListCredential.

    revoked_indices — list of credential slot indices to mark as revoked.
                      Index 0 is the reserved sentinel; never pass 0 here.
    vm_uri          — verificationMethod URI for the proof (e.g.
                      "did:web:observerprotocol.org#key-6").
    """
    now = issued_at or datetime.now(timezone.utc)
    ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    bits = bytearray(STATUS_LIST_SIZE_BITS // 8)
    for idx in (revoked_indices or []):
        if idx == 0:
            raise ValueError("Index 0 is the reserved sentinel; it must never be issued or revoked.")
        byte_pos, bit_pos = divmod(idx, 8)
        bits[byte_pos] |= 1 << (7 - bit_pos)

    credential = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://www.w3.org/ns/credentials/status/v1",
        ],
        "id": STATUS_LIST_URL,
        "type": ["VerifiableCredential", "BitstringStatusListCredential"],
        "issuer": ISSUER_DID,
        "validFrom": ts,
        "credentialSubject": {
            "id": f"{STATUS_LIST_URL}#list",
            "type": "BitstringStatusList",
            "statusPurpose": "revocation",
            "encodedList": _encode_bitstring(bits),
        },
    }
    return sign_eddsa_jcs_2022(credential, signing_key, vm=vm_uri, created=ts)


def revocation_status_entry(merchant_id: str, slot_index: int) -> dict:
    """Produce the credentialStatus block for a MerchantTrustCredential."""
    if slot_index == 0:
        raise ValueError("Index 0 is the reserved sentinel; it must never be issued.")
    return {
        "id": f"{STATUS_LIST_URL}#{slot_index}",
        "type": "BitstringStatusListEntry",
        "statusPurpose": "revocation",
        "statusListIndex": str(slot_index),
        "statusListCredential": STATUS_LIST_URL,
    }


# ────────────────────────────────────────────
# MerchantTrustCredential
# ────────────────────────────────────────────

def _rails_from_merchant(merchant: dict) -> list[str]:
    seen = set()
    out = []
    for r in merchant.get("rails", []):
        name = r.get("rail")
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out or ["btc"]


def build_merchant_trust_credential(
    merchant: dict,
    slot_index: int,
    signing_key: Ed25519PrivateKey,
    vm_uri: str,
    issued_at: Optional[datetime] = None,
    validity_days: int = VC_VALIDITY_DAYS,
) -> dict:
    """
    Build and sign a MerchantTrustCredential for a single AT Directory merchant.

    merchant    — merchant dict as loaded from data/merchants/<id>.json
    slot_index  — position in the BitstringStatusList (≥ 1; 0 is the sentinel)
    vm_uri      — verificationMethod URI for the proof; MUST be the production
                  #key-6 URI for live issuance. Staging may use a throwaway VM.
    """
    now = issued_at or datetime.now(timezone.utc)
    expiry = now + timedelta(days=validity_days)
    valid_from = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    valid_until = expiry.strftime("%Y-%m-%dT%H:%M:%SZ")

    mid = merchant["id"]
    subject_did = merchant_did(mid)

    credential = {
        "@context": [
            "https://www.w3.org/ns/credentials/v2",
            "https://observerprotocol.org/contexts/v1",
        ],
        "id": f"{DIRECTORY_URL}/merchants/{mid}/trust-credential.jsonld",
        "type": ["VerifiableCredential", "MerchantTrustCredential"],
        "issuer": ISSUER_DID,
        "validFrom": valid_from,
        "validUntil": valid_until,
        "credentialStatus": revocation_status_entry(mid, slot_index),
        "credentialSubject": {
            "id": subject_did,
            "trustTier": merchant.get("op_trust_tier", 1),
            "tierBasis": "at-directory-listing",
            "directoryId": mid,
            "directoryUrl": f"{DIRECTORY_URL}/merchants/{mid}",
            "issuedByDirectory": DIRECTORY_URL,
            "railsAccepted": _rails_from_merchant(merchant),
            "transactionEvidenceBucket": None,
            "attestationSetRef": None,
            "merchantControlledKeyRef": None,
            "continuityAnchor": None,
        },
    }
    return sign_eddsa_jcs_2022(credential, signing_key, vm=vm_uri, created=valid_from)
