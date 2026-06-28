import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MichiganCompositionSandbox from './MichiganCompositionSandbox';

export const metadata: Metadata = {
  title: 'Michigan Composition Sandbox | Celebration Atlas Dev',
  description: 'Developer-only map composition sandbox and validation contract.',
  robots: { index: false, follow: false },
};

export default function MichiganCompositionSandboxPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MichiganCompositionSandbox />;
}
