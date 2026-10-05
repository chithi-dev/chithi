---
icon: lucide/lock
---

# Cryptography Architecture (Scheme v3)

## Overview

Chithi is an end-to-end encrypted file-sharing app inspired by Firefox Send. All
cryptographic work happens **client-side** — the Django backend is a dumb store and
never sees plaintext, passwords, or key material.

There are exactly **two interoperable crypto implementations**, and they produce
byte-identical output:

| Platform | Language | Primitives |
|---|---|---|
| **Frontend** | TypeScript (SvelteKit) | Web Crypto API (`crypto.subtle`) + `argon2-browser` (WASM) |
| **CLI** | Python | `cryptography` (HKDF, AES-GCM) + `argon2-cffi` |

Both implementations share the same scheme constants (defined in
`src/frontend/src/lib/consts/encryption.ts` and mirrored in
`src/cli/app/helpers/crypto.py`). The wire format and key derivation are identical,
so data encrypted on one platform decrypts on the other. This is verified by
cross-language interop tests.

**Core properties:**
- **Zero-knowledge** — the server stores only ciphertext.
- **Password optional** — a random 32-byte IKM (the share-URL secret) or a
  user-supplied password both work.
- **Authenticated** — every 64 KiB record carries a 16-byte AES-GCM tag.
- **Streaming** — files are split into 64 KiB records (RFC 8188 / ECE model) and
  processed record-by-record in a worker, so memory stays bounded.
- **Real per-file salt** — a fresh random 16-byte salt travels in the ciphertext
  header and feeds **both** Argon2id (password path) and HKDF (all paths), so the
  same password over different uploads yields different keys and ciphertexts.

> **Scheme v3 is a breaking change.** Ciphertexts produced under v3 (AES-256-GCM +
> Argon2id + 21-byte header) cannot be decrypted by the earlier v2 code (AES-128-GCM
> + PBKDF2 + 20-byte header), and vice-versa. There is no back-compat shim — the
> version byte in the header is the single dispatch point.

---

## 1. Wire Format (ECE, RFC 8188)

```
┌────────────────────────────────────────────────────────────┐
│ Header (21 bytes)                                          │
│   [ 16-byte random salt ] [ 1-byte version = 3 ]           │
│   [ 4-byte record size, big-endian = 65536 ]               │
├────────────────────────────────────────────────────────────┤
│ record_0   = AES-256-GCM(plaintext_0, nonce_0) + 16B tag  │
│ record_1   = AES-256-GCM(plaintext_1, nonce_1) + 16B tag  │
│ ...                                                        │
│ record_N   = AES-256-GCM(plaintext_N, nonce_N) + 16B tag  │
└────────────────────────────────────────────────────────────┘
```

- **Record size:** 64 KiB of plaintext. Each full record is 65 552 bytes of
  ciphertext (64 KiB + 16-byte GCM tag). The final record may be shorter.
- **Header:** 21 bytes total — a 16-byte random salt, a 1-byte version (currently
  `3`), and a 4-byte big-endian record size.
- **Nonce per record:** `nonce_base` (12 bytes) with the record sequence number
  XOR'd into the final 4 bytes, big-endian.

```
nonce_base = SHA-256(file_key)[0:12]
nonce[i]   = nonce_base, with nonce_base[8:12] XOR= i (as u32 BE)
```

Because every nonce is a pure function of `(file_key, i)`, both encrypt and
decrypt derive the exact same nonces from the same key — no counter state is
carried across records, and records can be processed in any order or on any
thread.

---

## 2. Key Derivation

```
                 ┌─────────────────────────────────────────────┐
  password ─────►│ Argon2id(password, salt, t=3, m=64 MiB, p=1) │──► 32-byte IKM
                 └─────────────────────────────────────────────┘
  secret ─────────────────────────────────────────────────────────  32-byte IKM
                 (zero-knowledge path — the IKM itself is the secret)

  32-byte IKM ──► HKDF-SHA-256(salt=header_salt, info="chithi-file-key-v3")
                 ──────────────────────────────────────────────────────►
                                                              32-byte AES-256 file key
```

Two entry points feed the same HKDF:

1. **Password path** — the user's password is stretched with Argon2id against the
   per-file header salt, producing a 32-byte IKM.
2. **Secret path** — a random 32-byte IKM is generated once and carried in the
   share-URL fragment. This is the zero-knowledge "link" the sender shares.

Either way, HKDF-SHA-256 expands the IKM into a 32-byte AES-256 key using the
**header salt** as the HKDF salt and a fixed `info` string for domain separation.

### Argon2id Parameters

| Parameter | Value | Note |
|---|---|---|
| Type | Argon2id | Hybrid (data-independent + data-dependent) |
| Time cost `t` | **3** | OWASP 2024 minimum for interactive password hashing |
| Memory cost `m` | **64 MiB** (`64 * 1024` KiB) | OWASP 2024 minimum |
| Parallelism `p` | 1 | |
| Output length | 32 bytes | Feeds HKDF |

> **Upgraded from v2:** v2 used PBKDF2-SHA-256 (100 000 iterations, 16-byte output)
> with a *fixed* salt string. v3 replaces it with Argon2id (memory-hard, GPU-resistant)
> and a **real per-file random salt**, so there is no shared static salt to precompute
> a rainbow table against.

### HKDF

| Parameter | Value |
|---|---|
| Hash | SHA-256 |
| Salt | the 16-byte header salt (random, per file) |
| Info | `"chithi-file-key-v3"` |
| Output length | 32 bytes (AES-256) |

---

## 3. Why AES-256-GCM

v3 moved from AES-128-GCM to **AES-256-GCM** (32-byte key). GCM provides
authenticated encryption — the 16-byte tag per record is a one-shot MAC over the
record, so any tampering, truncation, or reordering is rejected at decrypt time
with a hard error (not silent corruption). AES-GCM is hardware-accelerated in
browsers (`AES-NI`) and in the `cryptography` library, and both implementations
agree byte-for-byte.

| Property | v2 (old) | v3 (current) |
|---|---|---|
| Cipher | AES-128-GCM | **AES-256-GCM** |
| Key length | 16 B | **32 B** |
| Password KDF | PBKDF2-SHA-256, 100k iters | **Argon2id, t=3, m=64 MiB** |
| KDF salt | fixed string `chithi-salt-v2` | **real 16-byte random (per file)** |
| HKDF salt | fixed string | **header salt** |
| Header | 20 B (`salt` + `record_size`) | **21 B (`salt` + `version` + `record_size`)** |
| Version byte | none | **present (= 3)** |

---

## 4. Two-Platform Implementation

### Frontend (TypeScript)

- `src/frontend/src/lib/consts/encryption.ts` — the v3 constants (single source of truth).
- `src/frontend/src/lib/functions/encryption.ts` — `generateSecret`, `passwordToIkM`
  (Argon2id via `argon2-browser`), `deriveFileKey` (HKDF → AES-256 `CryptoKey`),
  `computeNonceBase`.
- `src/frontend/src/lib/workers/crypto.worker.ts` — a dedicated worker that derives
  the file key on `init` and encrypts/decrypts each record. Keeps the heavy work
  off the main thread.
- `src/frontend/src/lib/functions/streams.ts` — `createEncryptedStream` /
  `createDecryptedStream`: slice the input stream into 64 KiB records, dispatch to
  the worker in order, and prepend/strip the 21-byte header.

### CLI (Python)

- `src/cli/app/helpers/crypto.py` — pure Python mirror.
  - `password_to_ikm` — `argon2-cffi` (`hash_secret_raw`, `Type.ID`)
  - `derive_file_key` — `cryptography` HKDF → 32-byte key
  - `ece_encrypt` / `ece_decrypt` — `cryptography` `AESGCM`, 64 KiB records
  - `encrypt_files` / `decrypt_bundle` — zip (`zipfile`, level 6) + ECE
  - `encrypt_data` / `decrypt_data` — raw bytes, ECE only
- `src/cli/app/helpers/archive.py` — thin wrappers for file/dir read + write.

### Cross-language interop

Because both sides derive the file key with identical HKDF parameters and the
nonce with identical `SHA-256(key)[0:12]` + XOR-index logic, output is
byte-compatible. Verified:

- TS `deriveFileKey` and Python `derive_file_key` produce the **same 32 bytes**
  for the same IKM + salt.
- TS `nonceBase` and Python `compute_nonce_base` match.
- A 3-record ciphertext produced by the CLI decrypts correctly in the TypeScript
  pipeline, and vice-versa.

---

## 5. Threat Model

| Threat | Mitigation |
|---|---|
| Server compromise | Server holds ciphertext only; IKM/secret never sent to server |
| Network eavesdropping | All records AES-256-GCM; keys derived client-side |
| Tampering / truncation | Per-record 16-byte GCM tag rejects any modified record |
| Record reordering | Nonces are a pure function of index; reordering fails tag verification |
| Password brute-force | Argon2id, memory-hard (64 MiB) + real per-file salt defeats precomputation |
| Cross-upload rainbow tables | Per-file random salt feeds Argon2id **and** HKDF |
| Secret leakage via URL | Secret travels only in the `#fragment`, which browsers never send to the server |

---

## 6. Parameter Summary (v3)

```
SCHEME_VERSION          = 3
HKDF_FILE_INFO          = "chithi-file-key-v3"
ARGON2_TIME_COST        = 3
ARGON2_MEMORY_COST_KIB  = 64 * 1024      // 64 MiB
ARGON2_PARALLELISM      = 1
ARGON2_HASH_LENGTH      = 32             // → IKM
FILE_KEY_LENGTH         = 32             // AES-256
RECORD_SIZE             = 64 * 1024      // 64 KiB plaintext per record
SALT_LENGTH             = 16
VERSION_LENGTH          = 1
RECORD_SIZE_FIELD_LENGTH= 4
HEADER_LENGTH           = 21
TAG_LENGTH              = 16             // AES-GCM auth tag
NONCE_LENGTH            = 12
```

---

## 7. Testing

- **Frontend** (`src/frontend/src/lib/functions/encryption.client.test.ts`):
  base64/base64url, `generateSecret` (32 B), `deriveFileKey` (AES-256, salt-sensitive),
  `passwordToIkM` (Argon2id, salt-sensitive), AES-256-GCM roundtrip.
- **CLI** (`src/cli/test/test_crypto.py`): 14 tests covering IKM/file-key derivation,
  nonce base, record nonce, header format (version 3), encrypt/decrypt roundtrips
  (password + secret), file bundle roundtrip, and rejection of wrong password /
  empty input / short ciphertext.
- **Cross-language interop:** manual check confirming TS and Python key + nonce
  derivation are byte-identical and that a CLI-produced ciphertext decrypts in TS.
