# Testnet evidence

All transactions below are on **Stellar Testnet**. They were produced by scripted CLI runs (`stellar contract invoke`) on 2026-10-03, not through the web app. The contract is unaudited.

| Item | Value |
|---|---|
| Contract | [`CCKTVAAAPMZZ2M5VJUAXQSAXHWZM6MH5XJ767JHSYQ5XCLL73YYPRAEM`](https://stellar.expert/explorer/testnet/contract/CCKTVAAAPMZZ2M5VJUAXQSAXHWZM6MH5XJ767JHSYQ5XCLL73YYPRAEM) |
| Deploy tx | [8c18f5c6…](https://stellar.expert/explorer/testnet/tx/8c18f5c699ef20b89e2805e39035916ff06c4bcd2e73c482236ffaaf5997164a) |
| Pledge asset | Circle testnet USDC (`USDC:GBBD47IF…FLA5`), Stellar Asset Contract `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Demo clinic A | Udi Hills Diagnostics (fictional), `GB7WCD6FJOHLJJMUVTDPCAFNELUZIJJCVXMPNHYBVF5OXCR4OCJMSOBR` |
| Demo clinic B | Lagoon Imaging (fictional), `GDM7ARBCYRQE3BBKKY2BB5GAFF53A6BOXLY37MO4IICZ2B7D727KHR2F` |
| Demo sender | `GC5FBAXUH7CAHL6LV44GVQ7JHM3QCZ7XRNGBUWXZFWAMGDDKFXEEE4DM` |

## Happy path: pledge #1 (chest X-ray, 15 USDC)
1. Sender bought 40 USDC with ~42.28 XLM through a testnet DEX path payment: [2af5d996…](https://stellar.expert/explorer/testnet/tx/2af5d996c9d2a47019f2337955dd6f80574d8b495de4dfdde0ef131ff4e9fe16)
2. Pledge created, 15 USDC locked for `XRAY_CHEST` at clinic A: [121c4dff…](https://stellar.expert/explorer/testnet/tx/121c4dffd41d624ca861bd7479af1acd2015e47bb49f7036d3f144eebd67380b)
3. Clinic B tried to redeem: rejected in simulation with `WrongClinic` (#8).
4. Clinic A tried a wrong code: rejected with `BadCode` (#10).
5. Clinic A redeemed with the patient's code; 15 USDC paid to clinic A: [3ec7bfec…](https://stellar.expert/explorer/testnet/tx/3ec7bfecf67fff4984e6def16d72a3c7cd8968d988881c197e16f1f891b72680)
6. A second redeem was rejected with `NotOpen` (#7).

## No-show path: pledge #2 (pelvic ultrasound, 10 USDC, 2-minute demo window)
1. Pledge created: [eb912d76…](https://stellar.expert/explorer/testnet/tx/eb912d76d1511b0bcfe3f0f4cb56d07a5d99a2aef7b629bd468dd76827e4f5de)
2. Refund before expiry rejected with `NotExpired` (#11).
3. After expiry, refund returned 10 USDC to the sender: [c078af9a…](https://stellar.expert/explorer/testnet/tx/c078af9a8fe69fa5c83484226c06ade057e6cc349f75b2c922dc1eb44a99d3d0)
