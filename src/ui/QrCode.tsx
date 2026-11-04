// QR Code em canvas usando a lib qrcode.
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QrCode({ value, size = 320 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) {
      QRCode.toCanvas(ref.current, value, { width: size, margin: 1 }).catch(() => {});
    }
  }, [value, size]);
  return <canvas ref={ref} />;
}
