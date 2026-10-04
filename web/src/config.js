export const NETWORK = {
  name: 'Testnet',
  passphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  explorer: 'https://stellar.expert/explorer/testnet',
};

export const CONTRACT_ID = 'CCKTVAAAPMZZ2M5VJUAXQSAXHWZM6MH5XJ767JHSYQ5XCLL73YYPRAEM';

export const USDC = {
  code: 'USDC',
  issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  sac: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
};

// Any funded testnet account works as the source for read-only simulations.
export const READ_SOURCE = 'GDGTYBBVN32OFHITF5GCDFM6YPO4ZQB5YH43PEHYS7MGNLKANIBXD3TZ';

// Fictional demo clinics, verified in the contract's clinic registry.
export const CLINICS = [
  { address: 'GB7WCD6FJOHLJJMUVTDPCAFNELUZIJJCVXMPNHYBVF5OXCR4OCJMSOBR', name: 'Udi Hills Diagnostics', city: 'Enugu' },
  { address: 'GDM7ARBCYRQE3BBKKY2BB5GAFF53A6BOXLY37MO4IICZ2B7D727KHR2F', name: 'Lagoon Imaging', city: 'Lagos' },
];

// Illustrative testnet prices in USDC.
export const SERVICES = [
  { code: 'XRAY_CHEST', name: 'Chest X-ray', price: 15 },
  { code: 'US_PELVIC', name: 'Pelvic ultrasound', price: 20 },
  { code: 'US_ABDO', name: 'Abdominal ultrasound', price: 25 },
  { code: 'CT_HEAD', name: 'CT head', price: 90 },
];

export const WINDOWS = [
  { label: '7 days', secs: 7 * 86400 },
  { label: '14 days', secs: 14 * 86400 },
  { label: '30 days', secs: 30 * 86400 },
  { label: '3 minutes (shows the refund)', secs: 180 },
];

export const ERRORS = {
  1: 'Contract already initialised.',
  2: 'Contract not initialised.',
  3: 'That clinic is not verified in the registry.',
  4: 'Amount must be above zero.',
  5: 'Expiry must be between one minute and 90 days from now.',
  6: 'No voucher with that number.',
  7: 'This voucher is already closed (redeemed or returned).',
  8: 'This voucher belongs to a different clinic. Only the named clinic can redeem it.',
  9: 'This voucher has expired. It can only be returned to the sender now.',
  10: 'The code does not match this voucher.',
  11: 'This voucher has not expired yet, so it cannot be returned.',
};

export const serviceName = (code) => SERVICES.find((s) => s.code === code)?.name || code;
export const clinicByAddress = (a) => CLINICS.find((c) => c.address === a);
