import {
  rpc,
  Horizon,
  TransactionBuilder,
  Contract,
  Address,
  Asset,
  Operation,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { NETWORK, CONTRACT_ID, USDC, READ_SOURCE, ERRORS } from './config.js';

export const server = new rpc.Server(NETWORK.rpcUrl);
export const horizon = new Horizon.Server(NETWORK.horizonUrl);
const contract = new Contract(CONTRACT_ID);
const DEPLOY_LEDGER = 5002022;
export const usdcAsset = new Asset(USDC.code, USDC.issuer);

const STROOPS = 10_000_000n;
export const toStroops = (n) => BigInt(Math.round(Number(n) * 1e7));
export const fromStroops = (s) => Number(BigInt(s)) / 1e7;

// ---------- codes ----------

// Patient codes are 16 Crockford base32 characters (80 bits), short enough to
// read out at reception. Only the SHA-256 of the code goes on-chain, and the
// clinic's signature is still required to redeem.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newSecret() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => CROCKFORD[x & 31]).join('');
}

// Undo common misreads (O→0, I/L→1) and drop separators.
function normalizeCode(raw) {
  return String(raw).toUpperCase().replace(/[\s\-·.]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

const pad4 = (id) => String(id).padStart(4, '0');

// "0005-K7QF-M2XA-9TPR-HD3W": voucher number, then the code in groups of four.
export function formatCode(id, secret) {
  if (secret.length !== 16) return null; // vouchers issued before short codes existed
  return `${pad4(id)}-${secret.match(/.{4}/g).join('-')}`;
}

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const hexToBytes = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

export function redeemLink(id, secret) {
  return `${location.origin}/#redeem/${id}/${secret}`;
}

// Accepts a typed or scanned code ("0005-K7QF-M2XA-9TPR-HD3W", any spacing or
// case) and patient links, including the older 32-hex-character links.
export function parseRedeem(text) {
  const s = String(text).trim();
  const legacy = s.match(/redeem\/(\d+)\/([0-9a-f]{32})(?![0-9a-z])/i);
  if (legacy) return { id: Number(legacy[1]), secret: legacy[2].toLowerCase() };
  const link = s.match(/redeem\/(\d+)\/([0-9a-z]{16})(?![0-9a-z])/i);
  if (link) return { id: Number(link[1]), secret: normalizeCode(link[2]) };
  const code = s.match(/^(\d{1,10})[\s\-·.]+([0-9a-z\s\-·.]+)$/i);
  if (code) {
    const secret = normalizeCode(code[2]);
    if (secret.length === 16 && [...secret].every((ch) => CROCKFORD.includes(ch))) return { id: Number(code[1]), secret };
  }
  return null;
}

// ---------- errors ----------

export function explainError(err) {
  const msg = String(err?.message || err);
  const m = msg.match(/Error\(Contract, #(\d+)\)/);
  if (m && ERRORS[m[1]]) return { code: Number(m[1]), text: ERRORS[m[1]] };
  if (/rejected|declined|cancel/i.test(msg)) return { code: null, text: 'Signing was cancelled in the wallet.' };
  return { code: null, text: msg.length > 240 ? msg.slice(0, 240) + '…' : msg };
}

// ---------- reads ----------

async function simulateRead(method, ...args) {
  const source = await server.getAccount(READ_SOURCE);
  const tx = new TransactionBuilder(source, { fee: '100', networkPassphrase: NETWORK.passphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return scValToNative(sim.result.retval);
}

export async function getPledge(id) {
  const p = await simulateRead('get_pledge', nativeToScVal(BigInt(id), { type: 'u64' }));
  return normalizePledge(p);
}

function normalizePledge(p) {
  const status = Array.isArray(p.status) ? p.status[0] : p.status;
  return {
    id: Number(p.id),
    sender: p.sender,
    clinic: p.clinic,
    service: p.service,
    amount: fromStroops(p.amount),
    createdAt: Number(p.created_at),
    expiresAt: Number(p.expires_at),
    closedAt: Number(p.closed_at),
    codeHash: Buffer.from(p.code_hash).toString('hex'),
    status,
  };
}

export async function getClinic(address) {
  return simulateRead('get_clinic', new Address(address).toScVal());
}

export async function nextId() {
  return Number(await simulateRead('next_id'));
}

export async function balances(address) {
  try {
    const acc = await horizon.loadAccount(address);
    const xlm = acc.balances.find((b) => b.asset_type === 'native');
    const usdc = acc.balances.find((b) => b.asset_code === USDC.code && b.asset_issuer === USDC.issuer);
    return { exists: true, xlm: Number(xlm?.balance || 0), usdc: usdc ? Number(usdc.balance) : null };
  } catch (e) {
    if (e?.response?.status === 404) return { exists: false, xlm: 0, usdc: null };
    throw e;
  }
}

export async function quoteXlmForUsdc(usdcAmount) {
  const res = await horizon
    .strictReceivePaths([Asset.native()], usdcAsset, Number(usdcAmount).toFixed(7))
    .call();
  const best = res.records.sort((a, b) => Number(a.source_amount) - Number(b.source_amount))[0];
  return best ? { xlm: Number(best.source_amount), path: best.path } : null;
}

export async function ledgerNow() {
  const l = await horizon.ledgers().order('desc').limit(1).call();
  return Math.floor(new Date(l.records[0].closed_at).getTime() / 1000);
}

// Recent contract activity from RPC events (testnet RPC keeps about 7 days).
export async function recentActivity(limit = 25) {
  // RPC scans a bounded ledger range per request, so walk forward in chunks
  // from the later of the deploy ledger and the retention window.
  const latest = (await server.getLatestLedger()).sequence;
  const CHUNK = 8000;
  let start = Math.max(DEPLOY_LEDGER, latest - 17280 * 6);
  const events = [];
  while (start <= latest) {
    const res = await server.getEvents({
      startLedger: start,
      endLedger: Math.min(start + CHUNK, latest + 1),
      filters: [{ type: 'contract', contractIds: [CONTRACT_ID] }],
      limit: 1000,
    });
    events.push(...res.events);
    start += CHUNK;
  }
  const out = [];
  for (const ev of events) {
    try {
      const topics = ev.topic.map((t) => scValToNative(t));
      const kind = topics[0];
      if (!['pledged', 'redeemed', 'refunded'].includes(kind)) continue;
      out.push({ kind, id: Number(topics[1]), tx: ev.txHash, ledger: ev.ledger, at: ev.ledgerClosedAt });
    } catch {
      /* skip undecodable */
    }
  }
  return out.reverse().slice(0, limit);
}

// ---------- writes ----------

async function prepareInvoke(sourceAddr, method, args) {
  const source = await server.getAccount(sourceAddr);
  const tx = new TransactionBuilder(source, { fee: '1000000', networkPassphrase: NETWORK.passphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();
  return server.prepareTransaction(tx);
}

async function submit(signedXdr) {
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase);
  const sent = await server.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error('Submission failed: ' + JSON.stringify(sent.errorResult?._attributes?.result?._switch?.name || sent));
  const hash = sent.hash;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await server.getTransaction(hash);
    if (r.status === 'SUCCESS') return { hash, result: r.returnValue ? scValToNative(r.returnValue) : null };
    if (r.status === 'FAILED') throw new Error(`Transaction ${hash} failed on-chain`);
  }
  throw new Error(`Transaction ${hash} not confirmed yet; check the explorer.`);
}

export async function pledge(signer, { clinic, service, amount, expiresAt, codeHash }) {
  const tx = await prepareInvoke(signer.address, 'pledge', [
    new Address(signer.address).toScVal(),
    new Address(clinic).toScVal(),
    xdr.ScVal.scvSymbol(service),
    nativeToScVal(toStroops(amount), { type: 'i128' }),
    nativeToScVal(BigInt(expiresAt), { type: 'u64' }),
    xdr.ScVal.scvBytes(Buffer.from(hexToBytes(codeHash))),
  ]);
  const signed = await signer.sign(tx.toXDR(), 'pledge');
  const r = await submit(signed);
  return { hash: r.hash, id: Number(r.result) };
}

export async function redeem(signer, { id, secret }) {
  const tx = await prepareInvoke(signer.address, 'redeem', [
    new Address(signer.address).toScVal(),
    nativeToScVal(BigInt(id), { type: 'u64' }),
    xdr.ScVal.scvBytes(Buffer.from(new TextEncoder().encode(secret))),
  ]);
  const signed = await signer.sign(tx.toXDR(), 'redeem');
  return submit(signed);
}

export async function refund(signer, id) {
  const tx = await prepareInvoke(signer.address, 'refund', [nativeToScVal(BigInt(id), { type: 'u64' })]);
  const signed = await signer.sign(tx.toXDR(), 'refund');
  return submit(signed);
}

// Classic: add the USDC trustline if missing and buy exactly `usdcAmount` with XLM.
export async function topUpWithXlm(signer, usdcAmount, maxXlm, needsTrustline) {
  const acc = await horizon.loadAccount(signer.address);
  const b = new TransactionBuilder(acc, { fee: '10000', networkPassphrase: NETWORK.passphrase });
  if (needsTrustline) b.addOperation(Operation.changeTrust({ asset: usdcAsset }));
  b.addOperation(
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: Number(maxXlm).toFixed(7),
      destination: signer.address,
      destAsset: usdcAsset,
      destAmount: Number(usdcAmount).toFixed(7),
      path: [],
    }),
  );
  const tx = b.setTimeout(120).build();
  const signed = await signer.sign(tx.toXDR(), 'topup');
  const res = await horizon.submitTransaction(TransactionBuilder.fromXDR(signed, NETWORK.passphrase));
  return { hash: res.hash };
}

export const txUrl = (h) => `${NETWORK.explorer}/tx/${h}`;
export const accountUrl = (a) => `${NETWORK.explorer}/account/${a}`;
export const contractUrl = () => `${NETWORK.explorer}/contract/${CONTRACT_ID}`;
export const short = (a) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '');
export { STROOPS };
