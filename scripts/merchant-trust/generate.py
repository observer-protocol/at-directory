#!/usr/bin/env python3
"""
AT Directory merchant-trust generator — Phase 1 CLI.

Generates merchant DID documents, MerchantTrustCredentials, and the
BitstringStatusListCredential. Outputs static files to
apps/web/public/ for Netlify deployment.

Usage:
  python generate.py keygen
      Generate a new Ed25519 keypair (prints hex private key + multibase
      public key). Run twice for AT_MERCHANT_VC_SIGNING_KEY and
      AT_MERCHANT_DID_SERVICE_KEY.

  python generate.py issue <merchant-id> [--vm VM_URI]
      Issue a MerchantTrustCredential for a single merchant.

  python generate.py issue-all [--vm VM_URI]
      Issue credentials for every merchant in data/merchants/.

  python generate.py did <merchant-id>
      Generate the DID document for a single merchant (no signing key needed).

  python generate.py did-all
      Generate DID documents for all merchants.

  python generate.py status-list [--vm VM_URI] [--revoke IDX,IDX,...]
      Generate (or regenerate) the BitstringStatusListCredential.

  python generate.py verify <merchant-id>
      Verify an issued credential using the embedded proof and the public
      key embedded in the local status.

Environment variables:
  AT_MERCHANT_VC_SIGNING_KEY  — hex Ed25519 private key for signing credentials.
                                 For staging: a throwaway key.
                                 For production: op-vps #key-6 bytes.
  AT_MERCHANT_DID_SERVICE_KEY — hex Ed25519 private key for the AT service key
                                 embedded in merchant DID documents. The public
                                 key is published; keep the private key secure.
  AT_MERCHANT_VC_VM           — default verificationMethod URI (overridden by --vm).
                                 Staging default: did:web:observerprotocol.org#staging-key-1
                                 Production: did:web:observerprotocol.org#key-6

All outputs land in apps/web/public/ relative to the at-directory repo root.
"""

import argparse
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).parent
REPO_ROOT = HERE.parent.parent
MERCHANTS_DIR = REPO_ROOT / "data" / "merchants"
PUBLIC_DIR = REPO_ROOT / "apps" / "web" / "public"
STATUS_INDEX_FILE = HERE / "status-index.json"

STAGING_VM = "did:web:observerprotocol.org#staging-key-1"
PRODUCTION_VM = "did:web:observerprotocol.org#key-6"

sys.path.insert(0, str(HERE))
from signing import (
    generate_key,
    load_key_from_env,
    load_key_from_hex,
    public_key_multibase,
    verify_eddsa_jcs_2022,
)
from issuance import (
    build_merchant_did_document,
    build_merchant_trust_credential,
    build_status_list_credential,
)


# ────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────

def _load_merchant(merchant_id: str) -> dict:
    path = MERCHANTS_DIR / f"{merchant_id}.json"
    if not path.exists():
        sys.exit(f"error: no merchant file at {path}")
    with open(path) as f:
        return json.load(f)


def _all_merchant_ids() -> list[str]:
    return sorted(p.stem for p in MERCHANTS_DIR.glob("*.json"))


def _load_status_index() -> dict[str, int]:
    if STATUS_INDEX_FILE.exists():
        with open(STATUS_INDEX_FILE) as f:
            return json.load(f)
    return {}


def _save_status_index(index: dict[str, int]) -> None:
    with open(STATUS_INDEX_FILE, "w") as f:
        json.dump(index, f, indent=2, sort_keys=True)
    print(f"status index written: {STATUS_INDEX_FILE}")


def _assign_slot(merchant_id: str, index: dict[str, int]) -> int:
    if merchant_id not in index:
        # Assign the next available slot (never 0 — it is the sentinel)
        next_slot = max(index.values(), default=0) + 1
        index[merchant_id] = next_slot
    return index[merchant_id]


def _did_service_pubkey() -> str:
    key_hex = os.environ.get("AT_MERCHANT_DID_SERVICE_KEY")
    if not key_hex:
        sys.exit(
            "error: AT_MERCHANT_DID_SERVICE_KEY not set.\n"
            "Run 'python generate.py keygen' to generate a key, then:\n"
            "  export AT_MERCHANT_DID_SERVICE_KEY=<hex>"
        )
    priv = load_key_from_hex(key_hex)
    return public_key_multibase(priv.public_key())


def _vc_signing_key_and_vm(args) -> tuple:
    key_hex = os.environ.get("AT_MERCHANT_VC_SIGNING_KEY")
    if not key_hex:
        sys.exit(
            "error: AT_MERCHANT_VC_SIGNING_KEY not set.\n"
            "Run 'python generate.py keygen' and set the env var."
        )
    signing_key = load_key_from_hex(key_hex)
    vm = getattr(args, "vm", None) or os.environ.get("AT_MERCHANT_VC_VM") or STAGING_VM
    if vm == PRODUCTION_VM:
        print("NOTE: using production VM (did:web:observerprotocol.org#key-6). "
              "Ensure the Phase 1 pre-issuance checklist has been completed.")
    else:
        print(f"NOTE: using staging VM ({vm}). "
              "These credentials will not pass the strict schema verificationMethod check.")
    return signing_key, vm


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"wrote: {path.relative_to(REPO_ROOT)}")


# ────────────────────────────────────────────
# Commands
# ────────────────────────────────────────────

def cmd_keygen(args):
    key = generate_key()
    priv_bytes = key.private_bytes_raw()
    pub_mb = public_key_multibase(key.public_key())
    print()
    print("=== NEW Ed25519 KEYPAIR ===")
    print(f"Private key (hex, 32 bytes): {priv_bytes.hex()}")
    print(f"Public key (multibase):      {pub_mb}")
    print()
    print("Store the private key as AT_MERCHANT_VC_SIGNING_KEY or")
    print("AT_MERCHANT_DID_SERVICE_KEY (never commit it to git).")
    print("Record the public key multibase for the DID document or key-scoping.json.")


def cmd_did(args):
    service_pubkey = _did_service_pubkey()
    mid = args.merchant_id
    merchant = _load_merchant(mid)
    doc = build_merchant_did_document(mid, service_pubkey)
    out = PUBLIC_DIR / "merchants" / mid / "did.json"
    _write_json(out, doc)
    print(f"DID: {doc['id']}")
    print(f"Resolves at: https://agenticterminal.ai/merchants/{mid}/did.json")


def cmd_did_all(args):
    service_pubkey = _did_service_pubkey()
    for mid in _all_merchant_ids():
        merchant = _load_merchant(mid)
        doc = build_merchant_did_document(mid, service_pubkey)
        out = PUBLIC_DIR / "merchants" / mid / "did.json"
        _write_json(out, doc)
    print(f"DID documents written for {len(_all_merchant_ids())} merchants.")


def cmd_issue(args):
    signing_key, vm = _vc_signing_key_and_vm(args)
    mid = args.merchant_id
    merchant = _load_merchant(mid)

    status_index = _load_status_index()
    slot = _assign_slot(mid, status_index)

    vc = build_merchant_trust_credential(merchant, slot, signing_key, vm)
    out = PUBLIC_DIR / "merchants" / mid / "trust-credential.jsonld"
    _write_json(out, vc)
    _save_status_index(status_index)

    pubkey = public_key_multibase(signing_key.public_key())
    from signing import verify_eddsa_jcs_2022
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    ok = verify_eddsa_jcs_2022(vc, signing_key.public_key())
    print(f"self-verify: {'PASS' if ok else 'FAIL'}")
    print(f"slot index: {slot}")
    print(f"signing pubkey: {pubkey}")


def cmd_issue_all(args):
    signing_key, vm = _vc_signing_key_and_vm(args)
    ids = _all_merchant_ids()
    status_index = _load_status_index()

    issued = 0
    for mid in ids:
        merchant = _load_merchant(mid)
        slot = _assign_slot(mid, status_index)
        vc = build_merchant_trust_credential(merchant, slot, signing_key, vm)
        out = PUBLIC_DIR / "merchants" / mid / "trust-credential.jsonld"
        _write_json(out, vc)
        issued += 1

    _save_status_index(status_index)
    print(f"\nIssued {issued} credentials. Run 'status-list' to regenerate the status list.")


def cmd_status_list(args):
    signing_key, vm = _vc_signing_key_and_vm(args)
    revoked = []
    if args.revoke:
        revoked = [int(x.strip()) for x in args.revoke.split(",") if x.strip()]

    sl = build_status_list_credential(signing_key, vm, revoked_indices=revoked)
    out = PUBLIC_DIR / "status" / "merchant-trust" / "v1.json"
    _write_json(out, sl)

    pubkey = public_key_multibase(signing_key.public_key())
    ok = verify_eddsa_jcs_2022(sl, signing_key.public_key())
    print(f"self-verify: {'PASS' if ok else 'FAIL'}")
    print(f"revoked slots: {revoked or 'none'}")
    print(f"signing pubkey: {pubkey}")


def cmd_verify(args):
    mid = args.merchant_id
    vc_path = PUBLIC_DIR / "merchants" / mid / "trust-credential.jsonld"
    if not vc_path.exists():
        sys.exit(f"error: no credential at {vc_path}")

    with open(vc_path) as f:
        vc = json.load(f)

    # Derive public key from the signing key env var for local self-verification.
    # For an end-to-end external verification, you'd resolve the issuer DID document
    # and extract the key from there.
    key_hex = os.environ.get("AT_MERCHANT_VC_SIGNING_KEY")
    if not key_hex:
        sys.exit("error: AT_MERCHANT_VC_SIGNING_KEY not set for local verification.")
    signing_key = load_key_from_hex(key_hex)

    try:
        ok = verify_eddsa_jcs_2022(vc, signing_key.public_key())
        status = "VERIFIED" if ok else "INVALID"
    except Exception as e:
        status = f"ERROR: {e}"

    print(f"credential: {vc_path.relative_to(REPO_ROOT)}")
    print(f"subject:    {vc['credentialSubject']['id']}")
    print(f"trustTier:  {vc['credentialSubject']['trustTier']}")
    print(f"tierBasis:  {vc['credentialSubject']['tierBasis']}")
    print(f"validFrom:  {vc['validFrom']}")
    print(f"validUntil: {vc['validUntil']}")
    print(f"result:     {status}")


# ────────────────────────────────────────────
# Entrypoint
# ────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AT Directory merchant-trust generator (Phase 1)"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("keygen", help="Generate a new Ed25519 keypair")

    p_did = sub.add_parser("did", help="Generate DID document for one merchant")
    p_did.add_argument("merchant_id")

    sub.add_parser("did-all", help="Generate DID documents for all merchants")

    p_issue = sub.add_parser("issue", help="Issue MerchantTrustCredential for one merchant")
    p_issue.add_argument("merchant_id")
    p_issue.add_argument("--vm", help="verificationMethod URI (default: staging VM)")

    p_issue_all = sub.add_parser("issue-all", help="Issue credentials for all merchants")
    p_issue_all.add_argument("--vm", help="verificationMethod URI (default: staging VM)")

    p_sl = sub.add_parser("status-list", help="Generate BitstringStatusListCredential")
    p_sl.add_argument("--vm", help="verificationMethod URI (default: staging VM)")
    p_sl.add_argument("--revoke", help="Comma-separated slot indices to mark revoked")

    p_verify = sub.add_parser("verify", help="Verify an issued credential locally")
    p_verify.add_argument("merchant_id")

    args = parser.parse_args()

    dispatch = {
        "keygen": cmd_keygen,
        "did": cmd_did,
        "did-all": cmd_did_all,
        "issue": cmd_issue,
        "issue-all": cmd_issue_all,
        "status-list": cmd_status_list,
        "verify": cmd_verify,
    }
    dispatch[args.command](args)


if __name__ == "__main__":
    main()
