import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { serviceName, clinicByAddress } from './config.js';
import { short } from './stellar.js';

// Each service gets its own cloth colour, like a row of book spines.
const CLOTH = {
  XRAY_CHEST: 'var(--cloth-navy)',
  US_PELVIC: 'var(--cloth-red)',
  US_ABDO: 'var(--cloth-green)',
  CT_HEAD: 'var(--cloth-ochre)',
};
export const clothFor = (service) => CLOTH[service] || 'var(--cloth-navy)';

const fmtDay = (secs) =>
  secs * 1000 - Date.now() < 2 * 86400_000
    ? new Date(secs * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : new Date(secs * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtShort = (secs) => new Date(secs * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const pad4 = (id) => String(id).padStart(4, '0');

export function QR({ text, size = 120 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(text, { width: size * 3, margin: 0, color: { dark: '#201819', light: '#00000000' } }).then(setSrc);
  }, [text, size]);
  return src ? (
    <img className="qr" src={src} width={size} height={size} alt="Patient code" />
  ) : (
    <span className="qr" style={{ width: size, height: size }} />
  );
}

const STAMPS = {
  Redeemed: 'Redeemed',
  Refunded: 'Returned',
  Expired: 'Expired',
};

// status: 'Draft' | 'Open' | 'Expired' | 'Redeemed' | 'Refunded'
export function VoucherFace({ id, service, clinic, amount, expiresAt, closedAt, status = 'Draft', qrText, code, size = 'md', windowLabel, faceRef, ...rest }) {
  const c = clinicByAddress(clinic);
  const stamp = STAMPS[status];
  const qrSize = size === 'xl' ? 168 : size === 'lg' ? 132 : 84;
  return (
    <article ref={faceRef} className={`voucher v-${size} s-${status.toLowerCase()}`} style={{ '--cloth': clothFor(service) }} {...rest}>
      <div className="v-spine" aria-hidden="true">
        <span>{id ? `No. ${pad4(id)}` : 'Draft'}</span>
      </div>
      <div className="v-face">
        <div className="v-meta">
          <span>{id ? `No. ${pad4(id)}` : 'Not yet issued'}</span>
          <span>
            {status === 'Draft'
              ? windowLabel ? `Refundable after ${windowLabel}` : ''
              : status === 'Redeemed' || status === 'Refunded'
                ? `Closed ${fmtShort(closedAt)}`
                : `${status === 'Expired' ? 'Expired' : 'Valid until'} ${fmtDay(expiresAt)}`}
          </span>
        </div>
        <h3 className="v-service">{serviceName(service)}</h3>
        <p className="v-clinic">{c ? `${c.name}, ${c.city}` : short(clinic)}</p>
        <div className="v-foot">
          <span className="v-amount">
            {Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <small>USDC</small>
          </span>
          {qrText ? <QR text={qrText} size={qrSize} /> : <span className="v-perf" aria-hidden="true" />}
        </div>
        {code && (
          <p className="v-code">
            <span>Code</span>
            <strong>{code}</strong>
          </p>
        )}
      </div>
      {stamp && (
        <span className="v-stamp" aria-hidden="true">
          {stamp}
        </span>
      )}
    </article>
  );
}

// html-to-image can't read cross-origin Google Fonts rules, so build the
// @font-face CSS ourselves with the Latin font files inlined as data URLs.
let fontCssPromise;
function embeddedFontCss() {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const href = document.querySelector('link[href*="fonts.googleapis.com/css2"]')?.href;
      if (!href) return '';
      const css = await (await fetch(href)).text();
      const blocks = css.split(/(?=\/\*)/).filter((b) => /^\/\* latin \*\//.test(b));
      const inlined = await Promise.all(
        blocks.map(async (b) => {
          const url = b.match(/url\((https:[^)]+)\)/)?.[1];
          if (!url) return b;
          const blob = await (await fetch(url)).blob();
          const data = await new Promise((res) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(blob);
          });
          return b.replace(url, data);
        }),
      );
      return inlined.join('\n');
    })().catch(() => '');
  }
  return fontCssPromise;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// The voucher on the page. Clicking it lifts an enlarged copy out of the same
// spot (a FLIP animation), with print and save-as-image actions.
export default function Voucher(props) {
  const { id, service } = props;
  const srcRef = useRef(null);
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true);
  return (
    <>
      <VoucherFace
        {...props}
        faceRef={srcRef}
        role="button"
        tabIndex={0}
        aria-label={`Voucher ${id ? `No. ${pad4(id)}` : 'draft'}, ${serviceName(service)}. Open larger view`}
        aria-haspopup="dialog"
        data-open={open || undefined}
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            show();
          }
        }}
      />
      {open && <VoucherViewer {...props} srcRef={srcRef} onClose={() => setOpen(false)} />}
    </>
  );
}

function VoucherViewer({ srcRef, onClose, ...props }) {
  const { id, service } = props;
  const bigRef = useRef(null);
  const backRef = useRef(null);
  const closeRef = useRef(null);
  const closing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  // Transform that maps the enlarged voucher back onto the small one.
  const delta = useCallback(() => {
    const a = srcRef.current?.getBoundingClientRect();
    const b = bigRef.current?.getBoundingClientRect();
    if (!a || !b || !b.width) return null;
    return `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})`;
  }, [srcRef]);

  useEffect(() => {
    const prevFocus = document.activeElement;
    document.body.classList.add('v-viewing');
    closeRef.current?.focus({ preventScroll: true });
    if (!reducedMotion()) {
      const from = delta();
      if (from) {
        bigRef.current.animate(
          [
            { transform: from, opacity: 0.7 },
            { transform: 'translate(0, -6px) scale(1.015)', offset: 0.72, opacity: 1 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        );
      }
      backRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
    }
    return () => {
      document.body.classList.remove('v-viewing');
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [delta]);

  const close = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    if (!reducedMotion()) {
      const to = delta();
      const anims = [backRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' })];
      if (to) anims.push(bigRef.current.animate([{ transform: 'none' }, { transform: to }], { duration: 340, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }));
      // Never let a paused or throttled animation keep the viewer open.
      await Promise.race([
        Promise.all(anims.filter(Boolean).map((a) => a.finished.catch(() => {}))),
        new Promise((r) => setTimeout(r, 450)),
      ]);
    }
    onClose();
  }, [delta, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const items = [...document.querySelectorAll('.v-modal button')];
        const i = items.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          items[items.length - 1]?.focus();
        } else if (!e.shiftKey && i === items.length - 1) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [close]);

  const saveImage = async () => {
    setBusy(true);
    setNote('');
    try {
      const { toPng } = await import('html-to-image');
      const fontEmbedCSS = await embeddedFontCss();
      const opts = { pixelRatio: 3, cacheBust: true, fontEmbedCSS, style: { transform: 'none', margin: '0' } };
      // The first render often paints before the embedded fonts are ready.
      await toPng(bigRef.current, { ...opts, pixelRatio: 1 });
      const url = await toPng(bigRef.current, opts);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nkwado-voucher-${id ? pad4(id) : 'draft'}-${service.toLowerCase()}.png`;
      a.click();
      setNote('Image saved.');
    } catch {
      setNote('Could not make the image here. Use Print and choose "Save as PDF" instead.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="v-modal" role="dialog" aria-modal="true" aria-label={`Voucher ${id ? `No. ${pad4(id)}` : 'draft'}`}>
      <div className="v-backdrop" ref={backRef} onClick={close} />
      <div className="v-stage">
        <VoucherFace {...props} size="xl" faceRef={bigRef} />
        <div className="v-actions">
          <button className="primary" onClick={() => window.print()}>Print</button>
          <button className="secondary" onClick={saveImage} disabled={busy}>{busy ? 'Saving…' : 'Save image'}</button>
          <button className="secondary" ref={closeRef} onClick={close}>Close</button>
        </div>
        <p className="v-note" role="status">
          {note || (props.code ? 'Anyone holding this code can use it. Print or share it privately.' : '')}
        </p>
      </div>
    </div>,
    document.body,
  );
}
