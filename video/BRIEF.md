# Nkwado demo film: brief

## Goal
- Kind: judge demo, 1:52 as built (hard cap 3:00).
- Audience: Find Your Way hackathon judges (Stellar Passport, General Track). Criteria: technical execution, meaningful use of Stellar, originality, potential impact, UX, presentation quality.
- The one thing they must understand: money sent home "for the scan" is locked to one named scan at one verified clinic on Stellar. It can only become that scan, or come back to the sender.
- Where it appears: the demo video link field of the submission (host: YouTube unlisted or Loom; the user uploads). 1920x1080, 30 fps. A 9:16 cut is optional and not planned.
- Hard limits: max 3 minutes (HACK_EVENT_GATE.json, user report 2026-10-03). Submit before 2026-10-06.

## Truth sheet (the film may only show what is here)
| Claim / number / screen | Evidence | Status |
|---|---|---|
| Soroban contract on Stellar Testnet | `CCKTVAAA…PRAEM`, deploy tx 8c18f5c6… (docs/evidence.md) | testnet, unaudited |
| Pledge asset is Circle testnet USDC via its Stellar Asset Contract | SAC `CBIELTK6…DAMA` (docs/evidence.md) | testnet |
| Sender buys exact USDC with XLM through a DEX path payment | tx 2af5d996…, 67ff0de3… | testnet |
| Wrong clinic cannot redeem (contract error #8) | CLI run + live app run on voucher No. 0007 | testnet |
| Wrong code rejected (#10); double redeem rejected (#7); early refund rejected (#11) | CLI runs (docs/evidence.md) | testnet |
| Named clinic redeems with the patient code; USDC paid to clinic | tx a61ce204… (No. 0007), 3ec7bfec… (No. 0001) | testnet, live app |
| Expired voucher returned to sender | tx c078af9a… (No. 0002), No. 0004, No. 0005 | testnet |
| Only the SHA-256 fingerprint of the patient code is stored on-chain | contracts/nkwado (code_hash field) | code |
| Recording session voucher No. 0010 (pelvic ultrasound, Lagoon Imaging, 20 USDC), code 0010-68SF-4J7N-XHXB-R621 | issue tx 094a76af…, redeem tx eaa7e23a… (Horizon: successful; clinic B credited 20 USDC at 2026-10-04T09:38:47Z) | testnet, live app, recorded 2026-10-04 |
| Wrong-clinic refusal shown in shot 07 | recorded in assets/capture/clinic (toast: "This voucher belongs to a different clinic") | testnet, live app |
| Live app URL | https://nkwado.up.railway.app, /api/health revision | deployed |
| Clinics "Udi Hills Diagnostics" and "Lagoon Imaging" | config.js | fictional demo clinics |
| Service prices (15/20/25/90 USDC) | config.js | illustrative |
| Next steps: SEP-24 cash-out to naira, itemised clinic price lists | README | planned |
- Must stay labeled: Testnet, unaudited, fictional demo clinics, demo signing mode. The app footer already says this; keep it visible in captured shots, and repeat it on the end card.
- Not in the film unless sourced: any out-of-pocket health-spending percentage. The README's "more than 70%" figure has no citation yet.

## Inputs
- Product: https://nkwado.up.railway.app in Demo mode (server-side testnet demo accounts; no passwords or keys in the film).
- Captures (to record with capture.mjs, which creates real testnet transactions using the demo accounts):
  1. `flows/send.mjs`: Send care → choose Lagoon Imaging + pelvic ultrasound → fund (USDC top-up if short) → lock → issued voucher with QR and code → enlarge.
  2. `flows/patient.mjs` at 390x844: open the patient link → voucher with QR and code.
  3. `flows/clinic.mjs`: Clinic tab acting as Udi Hills → type the code → checks show "Addressed to Lagoon Imaging, not you" → Redeem → contract refusal; switch to Lagoon Imaging → Redeem → "Paid 20 USDC".
  4. `flows/track.mjs`: Track shelf with Redeemed and Returned stamps; open one voucher enlarged.
  5. Stills: the stellar.expert pages for the redeem tx and the contract.
- Brand: the app's own tokens (oxblood #201819, paper #f4ebdd, gold #dbc895, Newsreader + Inter Tight), read from brand.json after capture.
- Reference: the app's own Stripe Press-derived voucher world. Grammar only.
- Music: none by default (or a licensed track the user supplies). Sound: synthesized UI cues from sfx.mjs (click, type, stamp thump, chime).
- Voice: Kokoro v1.0 (kokoro-onnx, voice af_heart), generated offline on the GCP VM, no cost. Subtitles burned in from the same lines.

## Beat sheet
See docs/shotlist.md.

## Gates
1. Brief + truth sheet agreed
2. Shot list agreed
3. Stills and contact sheet reviewed (scores logged in docs/review_log.md)
4. Hardest 2-4 s checked with a strip; `--verify` deterministic
5. Full render, mix, check.mjs (contact, phone, loudness), watched with sound
6. Deliverables: out/final.mp4, poster.png, contact.jpg, credits line saying what was captured, what was code-drawn, what was synthesized
