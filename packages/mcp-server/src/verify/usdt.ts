import { createHash } from 'node:crypto';
import { base58Decode } from './base58.ts';
import type { UsdtChain } from '@at-directory/core';

export interface UsdtEvidence {
  address_valid: boolean;
  chain: string;
  detail: string;
}

const EVM_CHAINS = new Set(['ethereum', 'bsc', 'polygon', 'arbitrum', 'base']);

export function verifyUsdtAddress(address: string, chain: UsdtChain): UsdtEvidence {
  if (chain === 'tron') {
    return { address_valid: isValidTron(address), chain, detail: tronDetail(address) };
  }
  if (chain === 'solana') {
    return { address_valid: isValidSolana(address), chain, detail: 'Solana Ed25519 pubkey' };
  }
  if (EVM_CHAINS.has(chain)) {
    return { address_valid: isValidEvm(address), chain, detail: 'EVM EIP-55 address' };
  }
  return { address_valid: false, chain, detail: `Unsupported chain '${chain}'` };
}

function isValidTron(address: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  const decoded = base58Decode(address);
  if (!decoded || decoded.length !== 25) return false;
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  if (payload[0] !== 0x41) return false;
  const h1 = createHash('sha256').update(payload).digest();
  const h2 = createHash('sha256').update(h1).digest();
  return h2.subarray(0, 4).equals(Buffer.from(checksum));
}

function tronDetail(address: string): string {
  return isValidTron(address)
    ? 'Valid TRC-20 address (Base58Check, 0x41 prefix)'
    : 'Malformed TRC-20 address';
}

function isValidSolana(address: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  const decoded = base58Decode(address);
  return decoded !== null && decoded.length === 32;
}

function isValidEvm(address: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  if (/^0x[0-9a-f]{40}$/.test(address) || /^0x[0-9A-F]{40}$/.test(address)) return true;
  return isEip55(address);
}

function isEip55(address: string): boolean {
  const addr = address.slice(2);
  const hash = keccak256(addr.toLowerCase());
  for (let i = 0; i < 40; i++) {
    const c = addr[i]!;
    if (!/[a-fA-F]/.test(c)) continue;
    const nibble = parseInt(hash[i]!, 16);
    const shouldUpper = nibble >= 8;
    if (shouldUpper && c !== c.toUpperCase()) return false;
    if (!shouldUpper && c !== c.toLowerCase()) return false;
  }
  return true;
}

// Minimal Keccak-256 (FIPS-202 Keccak, not SHA3) for EIP-55 checksum.
function keccak256(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const out = keccak(bytes, 136, 32, 0x01);
  return Buffer.from(out).toString('hex');
}

function keccak(input: Uint8Array, rate: number, outLen: number, pad: number): Uint8Array {
  const state = new Uint8Array(200);
  let offset = 0;
  while (input.length - offset >= rate) {
    for (let i = 0; i < rate; i++) state[i] = state[i]! ^ input[offset + i]!;
    keccakF(state);
    offset += rate;
  }
  const block = new Uint8Array(rate);
  block.set(input.subarray(offset));
  block[input.length - offset] = pad;
  block[rate - 1] = block[rate - 1]! | 0x80;
  for (let i = 0; i < rate; i++) state[i] = state[i]! ^ block[i]!;
  keccakF(state);
  return state.subarray(0, outLen);
}

const RC = [
  0x0000000000000001n,
  0x0000000000008082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x000000000000808bn,
  0x0000000080000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x000000000000008an,
  0x0000000000000088n,
  0x0000000080008009n,
  0x000000008000000an,
  0x000000008000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x000000000000800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x0000000080000001n,
  0x8000000080008008n,
];
const ROT = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14,
];

function keccakF(state: Uint8Array): void {
  const lanes: bigint[] = [];
  const view = new DataView(state.buffer, state.byteOffset, state.byteLength);
  for (let i = 0; i < 25; i++) {
    lanes.push(view.getBigUint64(i * 8, true));
  }
  const MASK = (1n << 64n) - 1n;
  const rotl = (x: bigint, n: number) =>
    n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK;

  for (let round = 0; round < 24; round++) {
    const c: bigint[] = [];
    for (let x = 0; x < 5; x++) {
      c[x] = lanes[x]! ^ lanes[x + 5]! ^ lanes[x + 10]! ^ lanes[x + 15]! ^ lanes[x + 20]!;
    }
    const d: bigint[] = [];
    for (let x = 0; x < 5; x++) {
      d[x] = c[(x + 4) % 5]! ^ rotl(c[(x + 1) % 5]!, 1);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) lanes[x + 5 * y] = lanes[x + 5 * y]! ^ d[x]!;
    }
    const b: bigint[] = new Array(25).fill(0n);
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(lanes[x + 5 * y]!, ROT[x + 5 * y]!);
      }
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        lanes[x + 5 * y] = b[x + 5 * y]! ^ (~b[((x + 1) % 5) + 5 * y]! & b[((x + 2) % 5) + 5 * y]!);
      }
    }
    lanes[0] = lanes[0]! ^ RC[round]!;
  }
  for (let i = 0; i < 25; i++) view.setBigUint64(i * 8, lanes[i]! & MASK, true);
}
