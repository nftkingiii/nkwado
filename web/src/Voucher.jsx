import { useEffect, useState } from 'react';
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
export default function Voucher({ id, service, clinic, amount, expiresAt, closedAt, status = 'Draft', qrText, code, size = 'md', windowLabel }) {
  const c = clinicByAddress(clinic);
  const stamp = STAMPS[status];
  return (
    <article className={`voucher v-${size} s-${status.toLowerCase()}`} style={{ '--cloth': clothFor(service) }} aria-label={`Pledge ${id ?? 'draft'}: ${serviceName(service)}`}>
      <div className="v-spine" aria-hidden="true">
        <span>{id ? `No. ${String(id).padStart(4, '0')}` : 'Draft'}</span>
      </div>
      <div className="v-face">
        <div className="v-meta">
          <span>{id ? `No. ${String(id).padStart(4, '0')}` : 'Not yet issued'}</span>
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
          {qrText ? <QR text={qrText} size={size === 'lg' ? 132 : 84} /> : <span className="v-perf" aria-hidden="true" />}
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
