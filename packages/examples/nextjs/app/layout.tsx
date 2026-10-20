import type { ReactNode } from 'react';
import './style.css';
export const metadata = { title: 'Kinstate · Next.js', description: 'Ordinary classes. Reactive state.' };
export default function Layout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
