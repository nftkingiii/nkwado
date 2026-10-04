// Clinic + Track flow on the live app. Run after send.mjs and patient.mjs; reads the voucher code from session.json.
// Wrong clinic types the code and is refused by the contract; the named clinic redeems; then the Track shelf.
import { readFileSync, writeFileSync } from 'node:fs';

const btn = (page, name) => page.getByRole('button', { name, exact: false }).first();

export default async (page, { pause, mark }) => {
  const session = JSON.parse(readFileSync('assets/capture/session.json', 'utf8'));
  const { id, code, link, pledgeTx } = session;
  await page.waitForSelector('.scanbox', { timeout: 30000 });
  await pause(2000);
  // 4. clinic: wrong clinic first
  mark('clinic-tab');
  await page.locator('.clinic-as select').selectOption('clinic'); // Udi Hills (not the named clinic)
  await pause(1200);
  await page.getByLabel('Voucher code').click();
  await page.getByLabel('Voucher code').pressSequentially(code, { delay: 70 });
  await pause(600);
  await btn(page, 'Check code').click();
  await page.waitForSelector('.checks', { timeout: 30000 });
  mark('checks-wrong');
  await pause(3500);
  await page.getByRole('button', { name: /^Redeem/ }).click();
  await page.waitForSelector('.toast.err', { timeout: 60000 });
  mark('refused');
  await pause(4000);

  // right clinic
  await page.locator('.clinic-as select').selectOption('clinic2'); // Lagoon Imaging
  await pause(2500);
  mark('checks-right');
  await page.getByRole('button', { name: /^Redeem/ }).click();
  await page.waitForSelector('.verify-side .ok', { timeout: 90000 });
  mark('paid');
  const redeemTx = await page.locator('.verify-side .ok a').getAttribute('href');
  writeFileSync('assets/capture/session.json', JSON.stringify({ id, code, link, pledgeTx, redeemTx }, null, 1));
  await pause(4000);

  // 5. track
  await page.getByRole('tab', { name: 'Track' }).click();
  mark('track');
  await page.waitForSelector('.shelf li', { timeout: 60000 });
  await pause(3000);
  await page.mouse.wheel(0, 420);
  await pause(3500);
  await page.mouse.wheel(0, 420);
  await pause(3000);
  mark('end');
};
