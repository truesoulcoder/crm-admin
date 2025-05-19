// src/app/crm/page.tsx
"use client"; // Assuming CrmView might use client-side hooks or interactivity

import React from 'react';
import CrmView from '@/components/views/CrmView'; // Path alias based on your tsconfig

export default function CrmPage() {
  return <CrmView />;
}
