# Nkwado shot list (2:45, 30 fps)

Route A+ capture composite: real recordings of the deployed app, with camera zooms, captions and cues drawn on top. The "how it works" diagram comes only after the product has acted.

| # | Time | Event (start → end) | Reads, in order | Camera / transition | Sound |
|---|---|---|---|---|---|
| 01 Hook | 0:00–0:12 | Black oxblood → two lines of serif type | 1. "Money sent home for a scan often never becomes the scan." (0:01–0:06) 2. "Nkwado: pay for the scan, not the promise." (0:07–0:12) | Type sets on a slow push; line 2 morphs into the app header | low thump on line 2 |
| 02 The voucher | 0:12–0:22 | Live app, Send care tab | 1. The voucher card previews what you're buying (0:13–0:17) 2. Caption: "One named scan · one verified clinic · refund if unused" (0:17–0:22) | Morph from the header; 1.4× push on the draft voucher | soft tick |
| 03 Choose | 0:22–0:40 | Select Lagoon Imaging, pelvic ultrasound, 7-day window | 1. Clinic marked "Verified in registry", read on-chain (0:24–0:29) 2. Voucher spine turns red and the price updates live (0:30–0:35) 3. Refund window (0:35–0:40) | Cursor emphasis; zoom follows the click | click per choice |
| 04 Fund | 0:40–0:58 | Fund step → Buy USDC with XLM → balance covers it | 1. "Short by X USDC" (0:41–0:45) 2. Caption: "Stellar DEX path payment buys the exact USDC" (0:45–0:52) 3. "Bought USDC · view transaction" (0:52–0:58) | Zoom to the funding panel | click, chime on success |
| 05 Lock | 0:58–1:15 | Lock → voucher issued with number, QR and code | 1. "Locking on Stellar…" (0:59–1:02) 2. Voucher No. issued, QR appears (1:03–1:08) 3. Caption: "Only the code's SHA-256 fingerprint goes on-chain" (1:08–1:15) | Push into the voucher; enlarge pop-out plays | stamp thump on issue |
| 06 Patient | 1:15–1:30 | Phone frame: patient opens the link | 1. Voucher with QR and code on a phone (1:16–1:22) 2. "Give the code at reception, or show the QR" (1:22–1:30) | Match cut: voucher shrinks into the phone | swish |
| 07 Wrong clinic | 1:30–1:52 | Clinic tab as Udi Hills, code typed | 1. Code typed, checks run (1:31–1:37) 2. Red check: "Addressed to Lagoon Imaging, not you" (1:37–1:42) 3. Press Redeem anyway → contract refuses (1:42–1:52) | Zoom on the checks, then the error | typing ticks, error tone |
| 08 Right clinic | 1:52–2:12 | Switch to Lagoon Imaging → Redeem → paid | 1. All four checks green (1:53–1:58) 2. "Paid 20 USDC to your clinic" (1:58–2:04) 3. stellar.expert tx page, successful (2:04–2:12) | Cut on action to the explorer still; underline the tx | success chime |
| 09 Track | 2:12–2:27 | Track shelf | 1. Vouchers end in one of two ways: Redeemed or Returned (2:13–2:20) 2. Caption: "Unused vouchers return to the sender after expiry" over a Returned voucher and its tx (2:20–2:27) | Slow pan across the shelf; stamps land in turn | two stamp thumps |
| 10 How it works | 2:27–2:38 | Diagram drawn in the app's style | Sender → Soroban contract locks USDC → clinic redeems with the patient code, or refund after expiry. Stellar parts named: USDC SAC, Soroban, path payments | Diagram builds left to right in three beats | ticks per node |
| 11 Close | 2:38–2:45 (hold to 2:48) | End card | 1. "Nkwado" + nkwado.up.railway.app (2:38–2:42) 2. Labels: "Stellar Testnet · unaudited · fictional demo clinics" and "Next: SEP-24 cash-out to naira" (2:42–2:48) | Hold; slow drift | final soft chime |

Notes
- Captured shots keep the app's own footer label ("Demo mode: real Stellar Testnet transactions…") visible at least once (shots 02 and 07).
- Every on-screen voucher number, amount and tx hash comes from the actual recording session, logged into BRIEF.md's truth sheet after capture.
- Recording shot 05 creates a real testnet voucher. Shot 09's refund can reuse an existing Returned voucher (No. 0005) and its tx rather than waiting for a new expiry on camera.
