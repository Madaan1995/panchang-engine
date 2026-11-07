import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Panchang — tithi, nakshatra and muhurat for your city',
  description:
    "Today's panchang (tithi, nakshatra, yoga, karana, Rahu Kaal, choghadiya) computed for your own city and timezone, including daylight saving.",
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
