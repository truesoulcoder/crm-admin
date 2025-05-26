"use client";

import dynamic from 'next/dynamic';
import React from 'react';


const SettingsView = dynamic(() => import('@/components/views/SettingsView'), { ssr: false });

export default function SettingsPage() {
  return <SettingsView />;
}