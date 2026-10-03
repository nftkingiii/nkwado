// Two explicit ways to sign: the user's own wallet, or Nkwado's testnet demo
// accounts (signed server-side, scoped to this contract). Never a silent fallback.
import { NETWORK } from './config.js';

let kitPromise;
async function kit() {
  if (!kitPromise) {
    kitPromise = (async () => {
      const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit/sdk');
      const { defaultModules } = await import('@creit.tech/stellar-wallets-kit/modules/utils');
      const { Networks } = await import('@creit.tech/stellar-wallets-kit/types');
      StellarWalletsKit.init({ modules: defaultModules(), network: Networks.TESTNET });
      return StellarWalletsKit;
    })();
  }
  return kitPromise;
}

export async function connectWallet() {
  const k = await kit();
  const { address } = await k.authModal();
  return {
    kind: 'wallet',
    address,
    label: 'Your wallet',
    async sign(xdr) {
      const { signedTxXdr } = await k.signTransaction(xdr, {
        networkPassphrase: NETWORK.passphrase,
        address,
      });
      return signedTxXdr;
    },
  };
}

export async function disconnectWallet() {
  try {
    const k = await kit();
    await k.disconnect?.();
  } catch {
    /* ignore */
  }
}

let demoAccounts;
export async function getDemoAccounts() {
  if (!demoAccounts) {
    const r = await fetch('/api/demo/accounts');
    demoAccounts = r.ok ? await r.json() : {};
  }
  return demoAccounts;
}

export async function demoSigner(role, label) {
  const accounts = await getDemoAccounts();
  const address = accounts[role];
  if (!address) throw new Error('Demo signer is not configured on this server.');
  return {
    kind: 'demo',
    role,
    address,
    label,
    async sign(xdr) {
      const r = await fetch('/api/demo/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, xdr }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Demo signer refused');
      return body.signedTxXdr;
    },
  };
}
