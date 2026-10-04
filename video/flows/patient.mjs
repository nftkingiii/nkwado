// Phone-sized flow: open the patient link from the main flow's session and show the voucher.
// Run with --url set to the patient link (read from assets/capture/session.json) and --size=390x844.
export default async (page, { pause, mark }) => {
  await page.waitForSelector('.patient .voucher', { timeout: 30000 });
  await pause(1500);
  mark('voucher');
  await pause(4000);
  await page.mouse.wheel(0, 300);
  await pause(3000);
  mark('end');
};
