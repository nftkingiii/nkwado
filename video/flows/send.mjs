// Desktop flow on the live app (demo mode, Stellar Testnet). Creates one real testnet voucher.
// Send care → fund → lock → enlarge the issued voucher.
// Writes the session's voucher number, code and patient link to assets/capture/session.json.
import { writeFileSync, mkdirSync } from 'node:fs';

const btn = (page, name) => page.getByRole('button', { name, exact: false }).first();

export default async (page, { pause, mark }) => {
  await page.waitForSelector('text=Verified in registry', { timeout: 30000 });
  await pause(2500);
  mark('send-start');

  // 1. choose the care
  await page.locator('label.choice', { hasText: 'Lagoon Imaging' }).click();
  mark('clinic-picked');
  await pause(1600);
  await page.locator('label.choice', { hasText: 'Pelvic ultrasound' }).click();
  mark('service-picked');
  await pause(1800);
  await page.locator('.pills button', { hasText: '7 days' }).click();
  await pause(1200);
  await btn(page, 'Continue').click();
  mark('fund-open');

  // 2. fund it (buy the shortfall with XLM if needed)
  await page.waitForSelector('.funds', { timeout: 30000 });
  await pause(2500);
  const buy = page.getByRole('button', { name: /^Buy .* USDC with XLM$/ });
  if (await buy.count()) {
    mark('buy');
    await buy.click();
    await page.waitForSelector('text=Bought USDC', { timeout: 60000 });
    mark('bought');
    await pause(2500);
  }
  await btn(page, 'Continue').click();
  await pause(2000);

  // 3. lock
  mark('lock');
  await page.getByRole('button', { name: /^Lock \d+ USDC$/ }).click();
  await page.waitForSelector('.code-big', { timeout: 90000 });
  mark('issued');
  await pause(4000);

  const code = (await page.locator('.code-big').innerText()).trim();
  const link = await page.getByRole('link', { name: 'Open patient view' }).getAttribute('href');
  const pledgeTx = await page.getByRole('link', { name: 'Pledge transaction' }).getAttribute('href');
  const id = Number(code.split('-')[0]);
  mkdirSync('assets/capture', { recursive: true });
  writeFileSync('assets/capture/session.json', JSON.stringify({ id, code, link, pledgeTx }, null, 1));

  // enlarge the voucher
  await page.locator('.preview article[role=button]').click();
  mark('enlarged');
  await pause(4500);
  await page.keyboard.press('Escape');
  await pause(1500);

  mark('end');
};
