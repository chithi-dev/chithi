---
icon: lucide/house
---

# Frontend

The frontend performs client-side encryption and supports background-safe uploads (Service Worker + IndexedDB).

The diagram below shows the major components and flows — note that the backend never sees unencrypted keys or plaintext:

```mermaid
flowchart TD
  %% Actors
  User[User]
  UI[Svelte UI]

  %% Client subgraph
  subgraph Client["Client — Browser (Svelte)"]
    WC["WebCrypto API\n(AES-GCM, PBKDF2/Argon2)"]
    Select["Select / Pick Files"]
    Prep["(Optional) Zip / Chunk & Stream"]
    KeyGen["Generate random File Key (IKM)"]
    BuildSN["Build SN1 Header\n(IKM + metadata)"]
    Encrypt["Stream Encrypt (AES‑GCM)"]
    Wrap["Wrap IKM\n(Password or Direct Key)"]
    Link["Shareable Link\nKey in URL fragment"]
    SW["Service Worker (optional)\nbackground upload / retry"]
    IDB["IndexedDB (cache / queued uploads)"]

    Fetch["Fetch Encrypted Blob"]
    ParseSN["Parse SN1 Header"]
    PromptPW["Prompt for Password"]
    Derive["Derive Wrapping Key"]
    Unwrap["Unwrap IKM"]
    Decrypt["Stream Decrypt"]
    Unzip["Unzip / Restore Files"]
    Error["Show Error / Integrity Fail"]
  end

  %% Server subgraph (untrusted)
  subgraph Server["Server — Untrusted Backend"]
    UploadAPI[Upload API]
    Storage[(Encrypted Blob Storage)]
    Meta[(Metadata DB)]
  end

  %% Upload flow (Client)
  User --> UI --> Select --> Prep --> KeyGen --> BuildSN --> Encrypt --> UploadAPI --> Storage
  Encrypt -->|produces encrypted blob| UploadAPI
  BuildSN --> Encrypt
  Encrypt --> Link --> User
  Wrap --> BuildSN

  %% Background upload support
  UI --> SW --> IDB
  SW -->|retry / resume| UploadAPI
  IDB --> SW
  UploadAPI --> Meta

  %% Download flow (Client)
  User --> UI --> Fetch --> UploadAPI --> Storage --> Fetch
  Fetch --> ParseSN
  ParseSN -->|password protected| PromptPW --> Derive --> Unwrap --> Decrypt
  ParseSN -->|no password| Unwrap
  Unwrap --> Decrypt -->|auth ok| Unzip --> User
  Decrypt -->|auth fail| Error

  %% Crypto implementation
  KeyGen --> WC
  Encrypt --> WC
  Decrypt --> WC
  Derive --> WC
  Unwrap --> WC

  %% Security note
  Server -.->|Never sees keys or plaintext| Client

  %% Visual groupings
  classDef note fill:#fff7db,stroke:#e6c07a
  class Link note

```

<small>
    The [backend architecture](../backend/architecture.md) and the [overall architecture](../architecture/index.md)
</small>
