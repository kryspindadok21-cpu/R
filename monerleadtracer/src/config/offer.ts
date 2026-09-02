import type { OfferConfig } from '@/lib/types';

/**
 * Kto pisze i co sprzedaje. Bez tego wiadomości byłyby generyczne.
 *
 * Wszystko da się nadpisać zmiennymi środowiskowymi — kod nie wymaga edycji,
 * żeby zmienić cenę albo podpis.
 */
export const OFFER: OfferConfig = {
  senderName: process.env.SENDER_NAME?.trim() || 'Krzysiek',
  product:
    process.env.OFFER_PRODUCT?.trim() ||
    'prosta strona-wizytówka + uporządkowana wizytówka w Google',
  price: Number(process.env.OFFER_PRICE ?? 890),
  leadTime: process.env.OFFER_LEAD_TIME?.trim() || '3-5 dni',
  freebie:
    process.env.OFFER_FREEBIE?.trim() || 'podgląd gotowej strony, zanim cokolwiek zapłacicie',
};

/** Formatowanie kwot do HUD-u: 12460 → "12 460 zł". */
export function formatPln(amount: number): string {
  return `${Math.round(amount).toLocaleString('pl-PL').replace(/ /g, ' ')} zł`;
}
