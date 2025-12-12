import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import './global.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata = {
  title: 'Calendar Scheduler',
  description:
    'Google OAuth Calendar Demo - Schedule and manage your calendar events',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${jetBrainsMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
