import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Folio — Library workspace', description: 'A thoughtful workspace for books, borrowers, and everything in between.', icons: {icon:'/favicon.svg'} };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
