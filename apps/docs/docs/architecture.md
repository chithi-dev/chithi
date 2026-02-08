---
icon: lucide/house
---

Chithi is based on client-server architecture.

# Overall Architecture

The architecture is based on a [zero-trust backend server](https://www.cloudflare.com/learning/security/glossary/what-is-zero-trust/).

```mermaid
flowchart TD
    UserA[Sender Browser]
    UserB[Receiver Browser]

    subgraph Client_Side["Client Side (Browser)"]
        Encrypt[Encrypt File<br/>AES-GCM-256]
        KeyGen[Generate Random Key]
        Hash[Derive File Hash / Metadata]
        Decrypt[Decrypt File]
    end

    subgraph Server_Side["Firefox Send Server (Untrusted)"]
        UploadAPI[Upload API]
        DownloadAPI[Download API]
        Storage[(Encrypted File Storage)]
        MetadataDB[(Metadata DB)]
        Expiry[Expiry / Download Counter]
    end

    %% Sender Flow
    UserA --> KeyGen
    KeyGen --> Encrypt
    UserA --> Encrypt
    Encrypt --> UploadAPI
    Hash --> UploadAPI

    UploadAPI --> Storage
    UploadAPI --> MetadataDB

    %% Link Creation
    Encrypt -->|Key stays in URL fragment| Link[Shareable Link]
    Link --> UserB

    %% Receiver Flow
    UserB --> DownloadAPI
    DownloadAPI --> Storage
    DownloadAPI --> MetadataDB
    Storage --> UserB
    MetadataDB --> Expiry

    %% Decryption
    UserB --> Decrypt
    Decrypt -->|Uses key from URL fragment| UserB

    %% Security Boundary
    Server_Side -. Never sees encryption key .- Client_Side

```

