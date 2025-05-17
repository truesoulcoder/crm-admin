'use client';
import dynamic from 'next/dynamic';
import React from 'react';

const TemplatesView = dynamic(() => import('@/components/views/TemplatesView'), { ssr: false });

export default function TemplatesPage() {
  return <TemplatesView />;
}