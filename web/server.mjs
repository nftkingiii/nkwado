// Static host for the built app plus an explicit demo signer.
// The demo signer holds TESTNET keys (from env vars, never committed) and only
// signs transactions that are scoped to the Nkwado contract or a USDC top-up.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Keypair, TransactionBuilder, Address, Asset } from '@stellar/stellar-sdk';

const PASSPHRASE = 'Test SDF Network ; September 2015';
const CONTRACT_ID = 'CCKTVAAAPMZZ2M5VJUAXQSAXHWZM6MH5XJ767JHSYQ5XCLL73YYPRAEM';
const USDC = new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
const MAX_FEE = 20_000_000; // 2 XLM
const MAX_TOPUP_XLM = 150;

const ROLES = {
  sender: { env: 'DEMO_SENDER_SECRET', fns: ['pledge', 'refund'], topup: true },
  clinic: { env: 'DEMO_CLINIC_SECRET', fns: ['redeem', 'refund'], topup: false },
  clinic2: { env: 'DEMO_CLINIC2_SECRET', fns: ['redeem', 'refund'], topup: false },
};

const keys = {};
for (const [role, r] of Object.entries(ROLES)) {
  const s = process.env[r.env];
  if (s) keys[role] = Keypair.fromSecret(s);
}

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  h.push(now);
  hits.set(ip, h);
  return h.length > 30;
}

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function checkTx(role, xdrStr) {
  const r = ROLES[role];
  const kp = keys[role];
  if (!r || !kp) return 'Demo role not available';
  const tx = TransactionBuilder.fromXDR(xdrStr, PASSPHRASE);
  if (tx.innerTransaction) return 'Fee-bump transactions are not signed';
  if (tx.source !== kp.publicKey()) return 'Transaction source is not the demo account';
  if (Number(tx.fee) > MAX_FEE) return 'Fee too high';
  const ops = tx.operations;
  if (ops.length === 1 && ops[0].type === 'invokeHostFunction') {
    const fn = ops[0].func;
    if (fn.type !== 'hostFunctionTypeInvokeContract') return 'Only contract calls are allowed';
    const ic = fn.invokeContract;
    const target = Address.fromScAddress(ic.contractAddress).toString();
    const name = new TextDecoder().decode(ic.functionName.bytes);
    if (target !== CONTRACT_ID) return 'Only the Nkwado contract can be called';
    if (!r.fns.includes(name)) return `Role ${role} may not call ${name}`;
    return null;
  }
  if (r.topup && ops.length >= 1 && ops.length <= 2) {
    for (const op of ops) {
      if (op.type === 'changeTrust') {
        if (!op.line.equals?.(USDC) && !(op.line.code === 'USDC' && op.line.issuer === USDC.issuer)) return 'Only a USDC trustline is allowed';
      } else if (op.type === 'pathPaymentStrictReceive') {
        if (op.destination !== kp.publicKey()) return 'Top-up must pay the demo account itself';
        if (!op.sendAsset.isNative()) return 'Top-up must spend XLM';
        if (!(op.destAsset.code === 'USDC' && op.destAsset.issuer === USDC.issuer)) return 'Top-up must buy USDC';
        if (Number(op.sendMax) > MAX_TOPUP_XLM) return 'Top-up too large';
      } else return `Operation ${op.type} is not allowed`;
    }
    return null;
  }
  return 'Transaction shape not allowed';
}

async function readBody(req) {
  let data = '';
  for await (const c of req) {
    data += c;
    if (data.length > 64_000) throw new Error('Body too large');
  }
  return JSON.parse(data || '{}');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, network: 'testnet', revision: process.env.APP_REVISION || 'local', demo: Object.keys(keys) });
  if (url.pathname === '/api/demo/accounts') {
    return json(res, 200, Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, v.publicKey()])));
  }
  if (url.pathname === '/api/demo/sign' && req.method === 'POST') {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
    if (limited(ip)) return json(res, 429, { error: 'Too many demo requests; wait a minute.' });
    try {
      const { role, xdr } = await readBody(req);
      const problem = checkTx(role, xdr);
      if (problem) return json(res, 400, { error: problem });
      const tx = TransactionBuilder.fromXDR(xdr, PASSPHRASE);
      tx.sign(keys[role]);
      return json(res, 200, { signedTxXdr: tx.toXDR() });
    } catch (e) {
      return json(res, 400, { error: String(e.message || e) });
    }
  }
  // static
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist)) return json(res, 400, { error: 'bad path' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  const ext = path.extname(file);
  res.writeHead(200, {
    'content-type': types[ext] || 'application/octet-stream',
    'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => console.log(`nkwado on :${port}, demo roles: ${Object.keys(keys).join(', ') || 'none'}`));
