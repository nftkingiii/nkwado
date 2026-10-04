# Review log

## Round 1 (contact sheet every 2.5 s)
- Pass: hook, voucher push-in, issue with QR + code, enlarge pop-out, phone view, clinic mismatch check, contract refusal toast, Track stamps, end card.
- Fix: fund shot cropped the voucher at the frame edge → reframed to the funding panel (z 1.9).
- Fix: explorer proof barely zoomed, "Successful" unreadable → faster camera to Status + redeem call, gold underline.
- Fix: Track header clipped by zoom → eased zoom.
- Fix: diagram type too small → larger nodes and labels.

## Round 2 (fixed-time sheet)
- Click rings land on the Lagoon Imaging and Pelvic ultrasound cards. Fund panel readable. Explorer underline under "Status: Successful". Diagram reads.
- Truthfulness gate: pass. Every number on screen comes from the recorded session (No. 0010, 20 USDC, tx eaa7e23a…). App footer label "Demo mode: real Stellar Testnet transactions…" visible in full-frame shots; end card repeats "Stellar Testnet · unaudited · fictional demo clinics".
- Determinism: `npm run verify` identical at 12 seam times.
