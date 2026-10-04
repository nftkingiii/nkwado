# Nkwado

**Pay for the scan, not the promise.**

Nkwado lets someone abroad pay for one named medical service, such as a chest X-ray, at one verified clinic back home. The money is locked in a Soroban contract on Stellar. The patient gets a one-time code as a QR. Only the named clinic can collect the money, and only by scanning that code before the deadline. If the patient never goes, the sender gets a full refund.

> Status: **Stellar Testnet MVP**, unaudited, built for the Find Your Way hackathon (Stellar Passport). The demo clinics are fictional, and prices are illustrative.

## Why

More than 70% of health spending in Nigeria is paid out of pocket, and family abroad often covers it. Money sent "for the scan" today arrives as general cash: it can be spent on something else, the clinic has no guarantee it will be paid, and the sender can't see what happened. Existing services pay the hospital *after* treatment, through their own platform.

Nkwado moves the guarantee to **before** the visit, and no platform ever holds the funds:

- The **sender** knows the money can only reach the named clinic, for the named service, or come back to them.
- The **clinic** sees the money is already locked before it starts the scan.
- The **patient** carries nothing but a QR code. They don't need a wallet, an app or crypto.

## How Stellar is used

| Need | Stellar feature |
|---|---|
| Stable value | Circle **USDC** through its Stellar Asset Contract |
| Locking, release rules, refund | A **Soroban** contract (`contracts/nkwado`) |
| Paying with whatever you hold | A **path payment** on the Stellar DEX buys the exact USDC with XLM, adding the trustline in the same transaction |
| Trusted clinics | An on-chain clinic registry, managed by an admin |
| Public record | Contract events (`pledged`, `redeemed`, `refunded`) shown in the Track tab |

### The contract

- `pledge(sender, clinic, service, amount, expires_at, code_hash)`: the clinic must be verified and active, and the window must be between 1 minute and 90 days. Moves the USDC into the contract.
- `redeem(clinic, id, code)`: requires the clinic's signature, the pledge's own clinic, a time before expiry, and `sha256(code) == code_hash`. Pays the clinic.
- `refund(id)`: anyone can trigger it after expiry. Returns the USDC to the sender.
- Every rejected case has a named error: wrong clinic, bad code, already closed, expired, not yet expired, unverified clinic.

Only a short service code and the code's SHA-256 fingerprint go on-chain. No names or medical details are stored.

## Try it

**Live app:** https://nkwado.up.railway.app (Stellar Testnet, demo mode by default)

The app has two signing modes, switched in the header:

- **Demo** (the default) signs with Nkwado's testnet demo accounts on the server. Every transaction is real on Stellar Testnet. The server only signs calls to this contract and USDC top-ups, and it rate-limits requests.
- **Wallet** connects your own wallet (Freighter, xBull, Albedo, LOBSTR and others through Stellar Wallets Kit). For the clinic side, the wallet must be a registered clinic.

A three-minute walkthrough:
1. **Send care**: pick a clinic, a service and a refund window. Top up USDC with XLM if needed, then lock the money. You get the patient's QR and link.
2. Open the **patient view** from the link.
3. **Clinic**: choose *Lagoon Imaging* and try to redeem a pledge made for *Udi Hills*. The contract refuses. Switch to Udi Hills and redeem: the USDC moves to the clinic.
4. **Track**: lock a pledge with the "3 minutes" window, wait, then press **Refund to sender**.

Testnet evidence (contract, transactions, rejected cases): [docs/evidence.md](docs/evidence.md).

## Run locally

```bash
# contract
stellar contract build
cargo test

# web (needs Node 20+)
cd web
npm install
npm run build
DEMO_SENDER_SECRET=... DEMO_CLINIC_SECRET=... DEMO_CLINIC2_SECRET=... npm start   # http://localhost:8080
```

The demo secrets are **testnet-only** keys and are read from environment variables. Leave them unset to run in wallet-only mode.

## Limits and next steps

- Testnet only and unaudited. Clinic verification is a single admin key for now.
- The next step is cashing out: clinics withdrawing to naira through a SEP-24 anchor.
- Itemised price lists per clinic, and partial redemption when the final bill differs.
- Sender notifications when the code is used or the money is refunded.

## Design

Each pledge is drawn as a numbered printed voucher. The spine colour is set by the service, and a stamp marks how it ended ("Redeemed" or "Returned"). The art direction adapts [Stripe Press](https://press.stripe.com): a deep oxblood page, book-serif type (Newsreader) with Inter Tight for controls, and gold as the only accent. No branding or assets are copied.

## Layout

```
contracts/nkwado   Soroban contract and tests
web/               Vite + React app, plus server.mjs (static host and demo signer)
docs/evidence.md   Testnet transactions
```
