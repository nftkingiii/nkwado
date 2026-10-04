import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Voucher from './Voucher.jsx';
import { CLINICS, SERVICES, WINDOWS, serviceName, clinicByAddress } from './config.js';
import * as S from './stellar.js';
import { connectWallet, disconnectWallet, demoSigner, getDemoAccounts } from './signer.js';

const TABS = [
  { id: 'send', label: 'Send care' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'track', label: 'Track' },
];

function useHashRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return hash;
}

const fmtTime = (secs) =>
  new Date(secs * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function relative(secs, now) {
  const d = secs - now;
  const a = Math.abs(d);
  const unit = a >= 86400 ? [Math.round(a / 86400), 'day'] : a >= 3600 ? [Math.round(a / 3600), 'hour'] : a >= 60 ? [Math.round(a / 60), 'minute'] : [a, 'second'];
  const s = `${unit[0]} ${unit[1]}${unit[0] === 1 ? '' : 's'}`;
  return d >= 0 ? `in ${s}` : `${s} ago`;
}

function useNow() {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ---------------------------------------------------------------- shell

export default function App() {
  const hash = useHashRoute();
  const redeemRoute = useMemo(() => S.parseRedeem(hash), [hash]);
  const tab = hash.startsWith('#tab/') && TABS.some((t) => `#tab/${t.id}` === hash) ? hash.slice(5) : 'send';
  const [mode, setMode] = useState('demo'); // 'demo' | 'wallet'
  const [wallet, setWallet] = useState(null);
  const [demoClinicRole, setDemoClinicRole] = useState('clinic');
  const [demoReady, setDemoReady] = useState(null);
  const [handoff, setHandoff] = useState(null); // redeem payload handed to the clinic tab

  useEffect(() => {
    getDemoAccounts().then((a) => setDemoReady(Boolean(a.sender))).catch(() => setDemoReady(false));
  }, []);

  const signerFor = useCallback(
    async (purpose) => {
      if (mode === 'wallet') {
        if (!wallet) throw new Error('Connect a wallet first.');
        return wallet;
      }
      if (purpose === 'clinic') {
        const c = CLINICS[demoClinicRole === 'clinic' ? 0 : 1];
        return demoSigner(demoClinicRole, `Demo clinic: ${c.name}`);
      }
      return demoSigner('sender', 'Demo sender');
    },
    [mode, wallet, demoClinicRole],
  );

  const go = (id) => {
    location.hash = `tab/${id}`;
  };

  if (redeemRoute) {
    return (
      <Frame tab={null} onTab={go} mode={mode} setMode={setMode} wallet={wallet} setWallet={setWallet} demoReady={demoReady}>
        <PatientCard
          route={redeemRoute}
          onClinic={() => {
            setHandoff(redeemRoute);
            go('clinic');
          }}
        />
      </Frame>
    );
  }

  return (
    <Frame tab={tab} onTab={go} mode={mode} setMode={setMode} wallet={wallet} setWallet={setWallet} demoReady={demoReady}>
      {tab === 'send' && <SendTab signerFor={signerFor} mode={mode} wallet={wallet} />}
      {tab === 'clinic' && (
        <ClinicTab
          signerFor={signerFor}
          mode={mode}
          wallet={wallet}
          demoClinicRole={demoClinicRole}
          setDemoClinicRole={setDemoClinicRole}
          handoff={handoff}
          clearHandoff={() => setHandoff(null)}
        />
      )}
      {tab === 'track' && <TrackTab signerFor={signerFor} />}
    </Frame>
  );
}

function Frame({ tab, onTab, mode, setMode, wallet, setWallet, demoReady, children }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const connect = async () => {
    setErr('');
    setBusy(true);
    try {
      const w = await connectWallet();
      setWallet(w);
      setMode('wallet');
    } catch (e) {
      setErr(S.explainError(e).text);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="app">
      <header className="top">
        <a className="mark" href="#" onClick={(e) => { e.preventDefault(); onTab('send'); }}>
          <Logo /> <span>Nkwado</span>
        </a>
        <nav className="tabs" role="tablist" aria-label="Workflows">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => onTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="signer">
          <div className="seg" role="group" aria-label="Signing mode">
            <button className={mode === 'demo' ? 'on' : ''} onClick={() => setMode('demo')} disabled={demoReady === false}>
              Demo
            </button>
            <button className={mode === 'wallet' ? 'on' : ''} onClick={() => (wallet ? setMode('wallet') : connect())} disabled={busy}>
              {wallet ? S.short(wallet.address) : busy ? 'Connecting…' : 'Wallet'}
            </button>
          </div>
          {wallet && mode === 'wallet' && (
            <button className="link" onClick={async () => { await disconnectWallet(); setWallet(null); setMode('demo'); }}>
              Disconnect
            </button>
          )}
        </div>
      </header>
      {err && <p className="toast err">{err}</p>}
      <main>{children}</main>
      <footer className="foot">
        <span>
          {mode === 'demo'
            ? 'Demo mode: real Stellar Testnet transactions, signed by Nkwado demo accounts.'
            : 'Wallet mode: you sign every transaction on Stellar Testnet.'}
        </span>
        <span>
          Testnet only · unaudited · fictional demo clinics ·{' '}
          <a href={S.contractUrl()} target="_blank" rel="noreferrer">contract</a>
        </span>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">
      <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h21A1.5 1.5 0 0 1 25 2.5v4a2.5 2.5 0 0 0 0 5v4a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 1 15.5v-4a2.5 2.5 0 0 0 0-5z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 5.5v7M9.5 9h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------- send

function SendTab({ signerFor, mode, wallet }) {
  const [step, setStep] = useState(1);
  const [clinic, setClinic] = useState(CLINICS[0].address);
  const [service, setService] = useState(SERVICES[0].code);
  const [win, setWin] = useState(WINDOWS[0].secs);
  const [verified, setVerified] = useState({});
  const [bal, setBal] = useState(null);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [topupTx, setTopupTx] = useState(null);

  const svc = SERVICES.find((s) => s.code === service);
  const clinicInfo = clinicByAddress(clinic);

  useEffect(() => {
    CLINICS.forEach((c) =>
      S.getClinic(c.address)
        .then((r) => setVerified((v) => ({ ...v, [c.address]: Boolean(r?.active) })))
        .catch(() => setVerified((v) => ({ ...v, [c.address]: false }))),
    );
  }, []);

  const loadFunds = useCallback(async () => {
    setErr('');
    setBal(null);
    setQuote(null);
    try {
      const s = await signerFor('send');
      const b = await S.balances(s.address);
      setBal({ ...b, address: s.address, label: s.label });
      const shortfall = svc.price - (b.usdc || 0);
      if (shortfall > 0) {
        const q = await S.quoteXlmForUsdc(shortfall);
        setQuote(q ? { ...q, usdc: shortfall } : { none: true, usdc: shortfall });
      }
    } catch (e) {
      setErr(S.explainError(e).text);
    }
  }, [signerFor, svc.price]);

  useEffect(() => {
    if (step === 2) loadFunds();
  }, [step, mode, wallet, loadFunds]);

  const topUp = async () => {
    setBusy('topup');
    setErr('');
    try {
      const s = await signerFor('send');
      const r = await S.topUpWithXlm(s, quote.usdc, quote.xlm * 1.05, bal.usdc === null);
      setTopupTx(r.hash);
      await loadFunds();
    } catch (e) {
      setErr(S.explainError(e).text);
    } finally {
      setBusy('');
    }
  };

  const send = async () => {
    setBusy('pledge');
    setErr('');
    try {
      const s = await signerFor('send');
      const secret = S.newSecret();
      const codeHash = await S.sha256Hex(secret);
      const now = await S.ledgerNow();
      const expiresAt = now + win + 30;
      const r = await S.pledge(s, { clinic, service, amount: svc.price, expiresAt, codeHash });
      S.saveCode(r.id, secret);
      setDone({ ...r, secret, expiresAt, clinic, service, amount: svc.price, topupTx });
      setStep(4);
    } catch (e) {
      setErr(S.explainError(e).text);
    } finally {
      setBusy('');
    }
  };

  const reset = () => {
    setDone(null);
    setTopupTx(null);
    setStep(1);
  };

  const enough = bal && (bal.usdc || 0) >= svc.price;
  const winLabel = WINDOWS.find((w) => w.secs === win).label.split(' (')[0];

  return (
    <section className="pane send">
      <div className="lede">
        <h1>A scan, paid in advance.</h1>
        <p>
          Lock money for one named service at one verified clinic. The patient carries the voucher. Only that clinic can
          redeem it, and only by seeing them. If they never go, it comes back to you.
        </p>
      </div>

      <div className="send-grid">
      <aside className="preview" aria-label="Voucher preview">
        {done ? (
          <Voucher id={done.id} service={done.service} clinic={done.clinic} amount={done.amount} expiresAt={done.expiresAt} status="Open" qrText={S.formatCode(done.id, done.secret) || S.redeemLink(done.id, done.secret)} code={S.formatCode(done.id, done.secret)} size="lg" />
        ) : (
          <Voucher service={service} clinic={clinic} amount={svc.price} status="Draft" windowLabel={winLabel} size="lg" />
        )}
        <p className="preview-note">
          {done ? 'Issued on Stellar Testnet.' : 'Only a fingerprint of the patient code goes on-chain. No names, no medical details.'}
        </p>
      </aside>

      <ol className="steps">
        <Step n={1} title="Choose the care" active={step === 1} done={step > 1} onEdit={step < 4 ? () => setStep(1) : null}
          summary={`${svc.name} · ${clinicInfo.name}, ${clinicInfo.city} · ${svc.price} USDC`}>
          <fieldset>
            <legend>Clinic</legend>
            <div className="choices">
              {CLINICS.map((c) => (
                <label key={c.address} className={`choice ${clinic === c.address ? 'on' : ''}`}>
                  <input type="radio" name="clinic" checked={clinic === c.address} onChange={() => setClinic(c.address)} />
                  <strong>{c.name}</strong>
                  <span>{c.city}</span>
                  <em className={verified[c.address] ? 'ok' : 'muted'}>
                    {verified[c.address] === undefined ? 'checking registry…' : verified[c.address] ? 'Verified in registry' : 'Not verified'}
                  </em>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Service</legend>
            <div className="choices four">
              {SERVICES.map((s) => (
                <label key={s.code} className={`choice ${service === s.code ? 'on' : ''}`}>
                  <input type="radio" name="service" checked={service === s.code} onChange={() => setService(s.code)} />
                  <strong>{s.name}</strong>
                  <span>{s.price} USDC</span>
                </label>
              ))}
            </div>
            <p className="hint">Illustrative testnet prices.</p>
          </fieldset>
          <fieldset>
            <legend>Refund if unused after</legend>
            <div className="pills">
              {WINDOWS.map((w) => (
                <button key={w.secs} className={win === w.secs ? 'on' : ''} onClick={() => setWin(w.secs)}>
                  {w.label}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="primary" onClick={() => setStep(2)} disabled={!verified[clinic]}>
            Continue
          </button>
        </Step>

        <Step n={2} title="Fund it" active={step === 2} done={step > 2} summary={bal ? `${S.short(bal.address)} · ${bal.usdc ?? 0} USDC` : ''}>
          {!bal && !err && <p className="muted">Checking balance…</p>}
          {bal && (
            <div className="funds">
              <p>
                Paying from <strong>{bal.label}</strong>{' '}
                <a href={S.accountUrl(bal.address)} target="_blank" rel="noreferrer">{S.short(bal.address)}</a>
              </p>
              <dl>
                <div><dt>USDC</dt><dd>{bal.usdc === null ? 'no trustline yet' : bal.usdc.toFixed(2)}</dd></div>
                <div><dt>XLM</dt><dd>{bal.xlm.toFixed(2)}</dd></div>
                <div><dt>Needed</dt><dd>{svc.price.toFixed(2)} USDC</dd></div>
              </dl>
              {!bal.exists && <p className="warn">This account is not funded on testnet yet. Fund it with Friendbot first.</p>}
              {quote && !quote.none && (
                <div className="topup">
                  <p>
                    Short by <strong>{quote.usdc.toFixed(2)} USDC</strong>. Buy it with about{' '}
                    <strong>{quote.xlm.toFixed(2)} XLM</strong> on the Stellar DEX (path payment, 5% slippage cap)
                    {bal.usdc === null ? ', adding the USDC trustline in the same transaction' : ''}.
                  </p>
                  <button className="secondary" onClick={topUp} disabled={busy === 'topup' || bal.xlm < quote.xlm * 1.05 + 2}>
                    {busy === 'topup' ? 'Buying USDC…' : `Buy ${quote.usdc.toFixed(2)} USDC with XLM`}
                  </button>
                </div>
              )}
              {quote?.none && <p className="warn">No DEX path for XLM to USDC right now.</p>}
              {topupTx && <p className="ok">Bought USDC · <a href={S.txUrl(topupTx)} target="_blank" rel="noreferrer">view transaction</a></p>}
              {enough && <button className="primary" onClick={() => setStep(3)}>Continue</button>}
            </div>
          )}
        </Step>

        <Step n={3} title="Lock it for the patient" active={step === 3} done={step > 3}>
          <div className="review">
            <p>
              <strong>{svc.price} USDC</strong> for <strong>{svc.name}</strong> at <strong>{clinicInfo.name}</strong>. Refundable{' '}
              {WINDOWS.find((w) => w.secs === win).label} after it is locked if nobody redeems it.
            </p>
            <p className="muted">
              Your browser makes a one-time code for the patient and keeps it. The contract stores only its SHA-256
              fingerprint.
            </p>
            <button className="primary" onClick={send} disabled={busy === 'pledge'}>
              {busy === 'pledge' ? 'Locking on Stellar…' : `Lock ${svc.price} USDC`}
            </button>
          </div>
        </Step>

        <Step n={4} title="Hand the voucher to the patient" active={step === 4} done={false}>
          {done && <Receipt done={done} onAgain={reset} />}
        </Step>
      </ol>
      </div>
      {err && <p className="toast err">{err}</p>}
    </section>
  );
}

function Step({ n, title, active, done, summary, onEdit, children }) {
  return (
    <li className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
      <div className="step-head">
        <span className="num" aria-hidden="true">{done ? '✓' : ['i', 'ii', 'iii', 'iv'][n - 1]}</span>
        <h2>{title}</h2>
        {done && summary && <span className="sum">{summary}</span>}
        {done && onEdit && <button className="link" onClick={onEdit}>Change</button>}
      </div>
      {active && <div className="step-body">{children}</div>}
    </li>
  );
}

function Receipt({ done, onAgain }) {
  const link = S.redeemLink(done.id, done.secret);
  const code = S.formatCode(done.id, done.secret);
  const c = clinicByAddress(done.clinic);
  const message = `Your ${serviceName(done.service)} at ${c.name}, ${c.city} is paid. At reception, give this voucher code: ${code}. Your voucher with its QR code: ${link}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const [copied, setCopied] = useState('');
  const copy = (what, text) => navigator.clipboard.writeText(text).then(() => setCopied(what));
  return (
    <div className="receipt">
      <div>
        <p className="big">Voucher No. {String(done.id).padStart(4, '0')} is issued.</p>
        <p>
          {done.amount} USDC for {serviceName(done.service)} at {c.name}. Refundable after {fmtTime(done.expiresAt)}.
        </p>
        <p className="code-big" aria-label="Voucher code">{code}</p>
        <p className="muted">
          The patient gives this code at reception, or shows the QR code on the voucher. Anyone holding it can use it, so
          share it privately.
        </p>
        <div className="row">
          <button className="primary" onClick={() => copy('code', code)}>{copied === 'code' ? 'Code copied' : 'Copy code'}</button>
          <a className="secondary" href={wa} target="_blank" rel="noreferrer">Share on WhatsApp</a>
          <button className="secondary" onClick={() => copy('link', link)}>{copied === 'link' ? 'Link copied' : 'Copy voucher link'}</button>
          <a className="secondary" href={link} target="_blank" rel="noreferrer">Open patient view</a>
        </div>
        <p className="tx">
          <a href={S.txUrl(done.hash)} target="_blank" rel="noreferrer">Pledge transaction</a>
          {done.topupTx && <> · <a href={S.txUrl(done.topupTx)} target="_blank" rel="noreferrer">USDC purchase</a></>}
        </p>
        <button className="link" onClick={onAgain}>Send another</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- patient

function PatientCard({ route, onClinic }) {
  const [p, setP] = useState(null);
  const [match, setMatch] = useState(null);
  const [err, setErr] = useState('');
  const now = useNow();
  useEffect(() => {
    (async () => {
      try {
        const pl = await S.getPledge(route.id);
        setP(pl);
        const ok = (await S.sha256Hex(route.secret)) === pl.codeHash;
        if (ok) S.saveCode(route.id, route.secret);
        setMatch(ok);
      } catch (e) {
        setErr(S.explainError(e).text);
      }
    })();
  }, [route]);
  const c = p && clinicByAddress(p.clinic);
  return (
    <section className="pane patient">
      {err && <p className="toast err">{err}</p>}
      {p && (
        <div className="card">
          <Voucher id={p.id} service={p.service} clinic={p.clinic} amount={p.amount} expiresAt={p.expiresAt} closedAt={p.closedAt} status={voucherStatus(p, now)} qrText={p.status === 'Open' ? S.formatCode(route.id, route.secret) || S.redeemLink(route.id, route.secret) : null} code={p.status === 'Open' ? S.formatCode(route.id, route.secret) : null} size="lg" />
          <StatusLine p={p} now={now} />
          {match === false && <p className="warn">This code does not match voucher No. {p.id}.</p>}
          <p className="muted">At reception{c ? ` at ${c.name}` : ''}, give the code or show the QR. It works once, only there, until {fmtTime(p.expiresAt)}.</p>
          <button className="link" onClick={onClinic}>I work at the clinic</button>
        </div>
      )}
      {!p && !err && <p className="muted">Loading voucher…</p>}
    </section>
  );
}

function voucherStatus(p, now) {
  if (p.status === 'Redeemed' || p.status === 'Refunded') return p.status;
  return now >= p.expiresAt ? 'Expired' : 'Open';
}

function StatusLine({ p, now }) {
  const expired = now >= p.expiresAt;
  if (p.status === 'Redeemed') return <p className="status done">Used on {fmtTime(p.closedAt)}. Paid to the clinic.</p>;
  if (p.status === 'Refunded') return <p className="status back">Refunded to the sender on {fmtTime(p.closedAt)}.</p>;
  if (expired) return <p className="status back">Expired {relative(p.expiresAt, now)}. Waiting for refund.</p>;
  return <p className="status open">Paid and waiting · {p.amount} USDC · expires {relative(p.expiresAt, now)}</p>;
}

// ---------------------------------------------------------------- clinic

function ClinicTab({ signerFor, mode, wallet, demoClinicRole, setDemoClinicRole, handoff, clearHandoff }) {
  const [input, setInput] = useState('');
  const [route, setRoute] = useState(null);
  const [p, setP] = useState(null);
  const [match, setMatch] = useState(null);
  const [me, setMe] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(null);
  const [scan, setScan] = useState(false);
  const now = useNow();

  useEffect(() => {
    if (handoff) {
      setInput(S.formatCode(handoff.id, handoff.secret) || S.redeemLink(handoff.id, handoff.secret));
      setRoute(handoff);
      clearHandoff();
    }
  }, [handoff, clearHandoff]);

  useEffect(() => {
    signerFor('clinic').then((s) => setMe(s)).catch(() => setMe(null));
  }, [signerFor, mode, wallet, demoClinicRole]);

  const load = useCallback(async (r) => {
    setErr('');
    if (!r) return;
    try {
      const pl = await S.getPledge(r.id);
      setP(pl);
      setMatch((await S.sha256Hex(r.secret)) === pl.codeHash);
    } catch (e) {
      setErr(S.explainError(e).text);
    }
  }, []);

  useEffect(() => {
    setOk(null);
    setP(null);
    setMatch(null);
    load(route);
  }, [route, load]);

  const submitInput = (text) => {
    const r = S.parseRedeem(text);
    if (!r) {
      setErr('That code is not in the right format. It looks like 0005-K7QF-M2XA-9TPR-HD3W.');
      return;
    }
    setRoute(r);
  };

  const doRedeem = async () => {
    setBusy(true);
    setErr('');
    try {
      const s = await signerFor('clinic');
      const r = await S.redeem(s, route);
      setOk(r.hash);
      await load(route);
    } catch (e) {
      setErr(S.explainError(e).text);
    } finally {
      setBusy(false);
    }
  };

  const meClinic = me && clinicByAddress(me.address);
  const forMe = p && me && p.clinic === me.address;
  const pc = p && clinicByAddress(p.clinic);

  return (
    <section className="pane">
      <div className="lede">
        <h1>A patient at reception.</h1>
        <p>Type the code the patient gives you, or scan the QR on their voucher. Nkwado checks it against the contract on Stellar. Redeeming pays your clinic at once.</p>
      </div>

      <div className="clinic-as">
        {mode === 'demo' ? (
          <label>
            Acting as{' '}
            <select value={demoClinicRole} onChange={(e) => setDemoClinicRole(e.target.value)}>
              <option value="clinic">{CLINICS[0].name} (demo)</option>
              <option value="clinic2">{CLINICS[1].name} (demo)</option>
            </select>
          </label>
        ) : (
          <p>
            Acting as <strong>{meClinic ? meClinic.name : 'your wallet'}</strong> {me && S.short(me.address)}
            {me && !meClinic && <span className="muted"> · not a registered demo clinic</span>}
          </p>
        )}
      </div>

      <div className="scanbox">
        <div className="row">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="0005-K7QF-M2XA-9TPR-HD3W" aria-label="Voucher code" autoCapitalize="characters" autoComplete="off" spellCheck={false} onKeyDown={(e) => e.key === 'Enter' && submitInput(input)} />
          <button className="secondary" onClick={() => submitInput(input)}>Check code</button>
          <button className="secondary" onClick={() => setScan((v) => !v)}>{scan ? 'Stop camera' : 'Scan QR'}</button>
        </div>
        {scan && (
          <Scanner
            onResult={(t) => {
              setScan(false);
              setInput(t);
              submitInput(t);
            }}
          />
        )}
      </div>

      {p && (
        <div className="verify">
          <Voucher id={p.id} service={p.service} clinic={p.clinic} amount={p.amount} expiresAt={p.expiresAt} closedAt={p.closedAt} status={voucherStatus(p, now)} />
          <div className="verify-side">
          <h2>Checked against Stellar</h2>
          <ul className="checks">
            <Check ok={match} label={match ? 'Code matches the on-chain fingerprint' : 'Code does not match'} />
            <Check ok={p.status === 'Open'} label={p.status === 'Open' ? 'Voucher is open' : `Voucher is ${p.status.toLowerCase()}`} />
            <Check ok={now < p.expiresAt} label={now < p.expiresAt ? `Not expired (${relative(p.expiresAt, now)})` : 'Expired'} />
            <Check ok={forMe} label={forMe ? 'Addressed to your clinic' : `Addressed to ${pc ? pc.name : 'another clinic'}, not you`} />
          </ul>
          {ok ? (
            <p className="ok big">Paid {p.amount} USDC to your clinic. <a href={S.txUrl(ok)} target="_blank" rel="noreferrer">View transaction</a></p>
          ) : (
            <>
              <button className="primary" onClick={doRedeem} disabled={busy || p.status !== 'Open'}>
                {busy ? 'Redeeming on Stellar…' : `Redeem ${p.amount} USDC`}
              </button>
              {!forMe && p.status === 'Open' && (
                <p className="hint">You can still try: the contract itself will refuse, and nothing moves.</p>
              )}
            </>
          )}
          </div>
        </div>
      )}
      {err && <p className="toast err">{err}</p>}
    </section>
  );
}

function Check({ ok, label }) {
  return <li className={ok ? 'yes' : 'no'}><span aria-hidden="true">{ok ? '✓' : '✕'}</span>{label}</li>;
}

function Scanner({ onResult }) {
  const ref = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let scanner;
    let stopped = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode('qr-reader');
        await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
          if (stopped) return;
          stopped = true;
          scanner.stop().catch(() => {});
          onResult(text);
        });
      } catch (e) {
        setErr('Camera unavailable. Paste the link instead.');
      }
    })();
    return () => {
      stopped = true;
      scanner?.isScanning && scanner.stop().catch(() => {});
    };
  }, [onResult]);
  return (
    <div>
      <div id="qr-reader" ref={ref} className="reader" />
      {err && <p className="warn">{err}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- track

function TrackTab({ signerFor }) {
  const [items, setItems] = useState(null);
  const [details, setDetails] = useState({});
  const [lookup, setLookup] = useState('');
  const [one, setOne] = useState(null);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState('');
  const now = useNow();

  const load = useCallback(async () => {
    setErr('');
    try {
      const ev = await S.recentActivity(60);
      const byId = {};
      for (const e of ev) (byId[e.id] ||= []).push(e);
      const ids = Object.keys(byId).map(Number).sort((a, b) => b - a).slice(0, 12);
      setItems(ids.map((id) => ({ id, events: byId[id].sort((a, b) => a.ledger - b.ledger) })));
      const d = {};
      await Promise.all(ids.map(async (id) => { try { d[id] = await S.getPledge(id); } catch { /* */ } }));
      setDetails(d);
    } catch (e) {
      setErr(S.explainError(e).text);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const find = async () => {
    setErr('');
    setOne(null);
    try {
      setOne(await S.getPledge(Number(lookup)));
    } catch (e) {
      setErr(S.explainError(e).text);
    }
  };

  const doRefund = async (id) => {
    setBusy(id);
    setErr('');
    try {
      const s = await signerFor('send');
      await S.refund(s, id);
      await load();
      if (one?.id === id) setOne(await S.getPledge(id));
    } catch (e) {
      setErr(S.explainError(e).text);
    } finally {
      setBusy(0);
    }
  };

  return (
    <section className="pane">
      <div className="lede">
        <h1>Every voucher, on the record.</h1>
        <p>Each voucher ends one of two ways: redeemed by the named clinic, or returned to the sender. Both are public on Stellar.</p>
      </div>
      <div className="row lookup">
        <input value={lookup} onChange={(e) => setLookup(e.target.value.replace(/\D/g, ''))} placeholder="Voucher number" aria-label="Voucher number" onKeyDown={(e) => e.key === 'Enter' && find()} />
        <button className="secondary" onClick={find} disabled={!lookup}>Look up</button>
        <button className="link" onClick={load}>Refresh</button>
      </div>
      {one && <ul className="shelf single"><PledgeRow p={one} now={now} onRefund={doRefund} busy={busy} /></ul>}
      {err && <p className="toast err">{err}</p>}
      <h2 className="sub">Recent vouchers</h2>
      {items === null && <p className="muted">Reading contract events…</p>}
      {items?.length === 0 && <p className="muted">No vouchers issued in the last few days.</p>}
      <ul className="shelf">
        {items?.map(({ id, events }) =>
          details[id] ? <PledgeRow key={id} p={details[id]} events={events} now={now} onRefund={doRefund} busy={busy} /> : null,
        )}
      </ul>
    </section>
  );
}

const EVENT_LABEL = { pledged: 'Issued', redeemed: 'Redeemed', refunded: 'Returned' };

function PledgeRow({ p, events = [], now, onRefund, busy }) {
  const canRefund = p.status === 'Open' && now >= p.expiresAt;
  const status = voucherStatus(p, now);
  const secret = S.savedCode(p.id);
  const code = secret && status === 'Open' ? S.formatCode(p.id, secret) : null;
  return (
    <li className="prow">
      <Voucher id={p.id} service={p.service} clinic={p.clinic} amount={p.amount} expiresAt={p.expiresAt} closedAt={p.closedAt} status={status} size="sm"
        qrText={secret && status === 'Open' ? code || S.redeemLink(p.id, secret) : null} code={code} />
      {secret && <p className="mine">{code ? 'Code saved in this browser only.' : 'Sent or opened in this browser.'}</p>}
      <StatusLine p={p} now={now} />
      <div className="pev">
        {events.map((e) => (
          <a key={e.tx + e.kind} href={S.txUrl(e.tx)} target="_blank" rel="noreferrer">{EVENT_LABEL[e.kind] || e.kind} tx</a>
        ))}
        {canRefund && (
          <button className="secondary sm" onClick={() => onRefund(p.id)} disabled={busy === p.id}>
            {busy === p.id ? 'Refunding…' : 'Refund to sender'}
          </button>
        )}
      </div>
    </li>
  );
}
