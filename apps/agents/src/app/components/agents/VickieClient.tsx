'use client';

import dynamic from 'next/dynamic';

const Vickie = dynamic(() => import('./Vickie'), { ssr: false });

export default function VickieClient() {
  return <Vickie />;
}
