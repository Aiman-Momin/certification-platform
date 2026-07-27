# Blockchain Certification Prototype — Performing Arts

A two-phase, blockchain-enabled certification prototype:

- **Phase 1 — Workshop Participation Model**: registration → manual payment/attendance verification → approval → **automatic** on-chain certificate minting → **manually-triggered** email delivery.
- **Phase 2 — Evaluation & Certification Model**: performance submission → LMS storage (mocked) → expert evaluation (marks, grade, parameters, comments) → on-chain minting of a graded certificate whose metadata carries the full evaluation record.

Both phases mint the same underlying token type — a **soulbound (non-transferable) ERC-721 certificate** — distinguished on-chain by a `kind` field (`PARTICIPATION` vs `EVALUATION`), so certificates can never be resold or transferred once issued, only verified.

---

## Architecture

```
                         ┌────────────────────────┐
  Registration ─────────►│  data/participants.json│◄── Phase 1 "Google Sheet"
  (manual verify/approve)│  data/submissions.json │◄── Phase 2 "Google Sheet"/LMS
                         └───────────┬────────────┘
                                     │  approvalStatus == "Approved"
                                     │  evaluation.status == "Completed"
                                     ▼
                         ┌────────────────────────┐
                         │   scripts/phase1_mint.js │  auto-mint on approval
                         │   scripts/phase2_mint.js │  mint graded certificate
                         └───────────┬────────────┘
                                     │ issueCertificate(to, kind, name, event, uri)
                                     ▼
                         ┌────────────────────────┐
                         │ contracts/CertificateSBT.sol │  Solidity 0.8.24
                         │ ERC-721 + AccessControl      │  Polygon-ready
                         │ soulbound (non-transferable) │
                         └───────────┬────────────┘
                                     │ CertificateIssued(tokenId, kind, to, ...)
                                     ▼
                         ┌────────────────────────┐
                         │  metadata/*.json         │  ERC-721 metadata +
                         │  (name, attrs, marks,    │  verification link
                         │   grade, comments, etc.) │
                         └───────────┬────────────┘
                                     │
                                     ▼
                         ┌────────────────────────┐
                         │ scripts/phase1_email.js  │  manual trigger only
                         │ (mock SMTP → certificates/*.txt)
                         └────────────────────────┘
```

### Why a Soulbound Token (SBT) instead of a plain NFT?

Certificates should never be tradable or transferable — they represent a
fact about a person, not an asset. `CertificateSBT` overrides ERC-721's
internal `_update` hook so every transfer (except the initial mint) reverts
with `"CertificateSBT: non-transferable (soulbound)"`. This was verified live
in `scripts/verify_demo.js` (see **Sample run log** below).

### Why one contract for both phases?

A single contract keeps verification simple (one address, one explorer page)
while still letting each certificate carry phase-specific metadata. The
`CertKind` enum (`0 = PARTICIPATION`, `1 = EVALUATION`) is stored on-chain per
token; all the rich Phase 2 fields (marks, grade, evaluator, parameters,
comments, audio feedback URL) live in the linked JSON metadata, exactly as
ERC-721 metadata is intended to work.

---

## Repository layout

```
contracts/
  CertificateSBT.sol        Soulbound ERC-721 + AccessControl certificate contract
scripts/
  compile.js                 Compiles the contract via the solc npm package
  deploy.js                  Deploys CertificateSBT (local Hardhat / Polygon Amoy)
  phase1_mint.js              Auto-mints participation certificates on approval
  phase1_email.js             Manually-triggered email delivery step
  phase2_mint.js              Mints graded evaluation certificates
  verify_demo.js              Reads back on-chain state + proves soulbound transfer block
  generate_certificate_images.py  Renders sample certificate PNGs from metadata
  lib/common.js                Shared helpers (contract loader, verification link builder)
data/
  participants.json           Mock "Google Sheet" — Phase 1 registrations
  submissions.json            Mock "Google Sheet"/LMS export — Phase 2 submissions + evaluations
build/
  CertificateSBT.json          Compiled ABI + bytecode
  deployment.json              Deployed contract address + network
metadata/
  participation-*.json         Generated Phase 1 certificate metadata
  evaluation-*.json            Generated Phase 2 certificate metadata
certificates/
  email-*.txt                  Mock delivered emails (Phase 1)
assets/
  sample-participation-certificate.png
  sample-evaluation-certificate.png
```

---

## Technology

| Layer | Choice |
|---|---|
| Smart contract | Solidity `0.8.24`, ERC-721 + AccessControl (OpenZeppelin v5), soulbound |
| Target chain | Polygon (Amoy testnet config included; deploys locally by default for this submission) |
| Backend | Node.js + Hardhat + ethers.js v6 |
| Data store | Mock JSON files (`data/*.json`) standing in for Google Sheets / a DB |
| Metadata | ERC-721 standard JSON (`name`, `description`, `image`, `attributes`) + program-specific fields |

> **Note on compilation:** this sandbox's network egress does not reach
> `binaries.soliditylang.org` (Hardhat's default compiler downloader), so
> `scripts/compile.js` compiles via the `solc` **npm package** directly
> instead of `npx hardhat compile`. Functionally identical output. In an
> environment with normal internet access, `npx hardhat compile` works too.

---

## Setup & running the prototype

```bash
npm install

node scripts/compile.js

npx hardhat node

npx hardhat run scripts/deploy.js --no-compile --network localhost

npx hardhat run scripts/phase1_mint.js --no-compile --network localhost

npx hardhat run scripts/phase1_email.js --no-compile --network localhost

npx hardhat run scripts/phase2_mint.js --no-compile --network localhost

### Deploying to Polygon Amoy testnet instead of locally

1. `cp .env.example .env` and fill in `POLYGON_AMOY_RPC_URL` and
   `DEPLOYER_PRIVATE_KEY` (a funded Amoy testnet wallet — get test MATIC from
   the Polygon faucet).
2. `npx hardhat run scripts/deploy.js --no-compile --network amoy`
3. Re-run steps 4–6 above with `--network amoy` instead of `--network localhost`.
4. `buildVerificationLink()` in `scripts/lib/common.js` will automatically
   point at `amoy.polygonscan.com` — a real, working block explorer link.

---

## How the two requirements are enforced

**"When a participant is marked Approved, the certificate should be minted
automatically."**
`phase1_mint.js` scans `data/participants.json` and mints for every record
where `approvalStatus === "Approved"` and no certificate has been issued yet.
Nothing else triggers a mint — there's no separate "click to mint" step.

**"Email delivery should remain Pending and be triggered manually after the
workshop."**
`phase1_mint.js` never touches `emailStatus`. It's a completely separate
script (`phase1_email.js`) that an admin runs on demand; it only emails
participants whose `certificateStatus === "Issued"` **and**
`emailStatus === "Pending"`.

---

## Sample run log (live Polygon Amoy deployment)

Contract deployed at: 0x5340aCB453B7951a896f238EAAb0EFF74c2DA12A
Network: Polygon Amoy Testnet (Chain ID 80002)
Explorer: https://amoy.polygonscan.com/address/0x5340aCB453B7951a896f238EAAb0EFF74c2DA12A

=== PHASE 1 MINT ===
MINT  P-001 (Ananya Rao) - approvalStatus=Approved -> issuing certificate...
      -> tokenId=1
      -> tx: https://amoy.polygonscan.com/tx/0x1aec5abb738e0966d5ff72be9a3819b430ab2d698efa336b334914f7982317ca
SKIP  P-002 (Rohan Mehta) - approvalStatus=Pending
SKIP  P-003 (Fatima Sheikh) - approvalStatus=Rejected
Done. 1 certificate(s) minted.

=== PHASE 1 EMAIL (manual trigger) ===
SENT  P-001 (Ananya Rao) -> ananya.rao@example.com
Done. 1 email(s) sent.

=== PHASE 2 MINT ===
MINT  S-001 (Ananya Rao)  -> tokenId=2, grade=A  (87/100)
      -> tx: https://amoy.polygonscan.com/tx/0x76bc15b2a0bc21ca5581fa2754813bda88e5084f78e090369f6554adcd748527
MINT  S-002 (Rohan Mehta) -> tokenId=3, grade=B+ (80/100)
      -> tx: https://amoy.polygonscan.com/tx/0x6a20a50df26b0318d611419a8089939db11a0346cd56cdf2e08c30bb8ea87d6f
Done. 2 certificate(s) minted.

All transactions publicly verifiable at the explorer link above.