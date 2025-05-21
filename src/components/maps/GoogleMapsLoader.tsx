'use client';

import { LoadScript, LoadScriptProps } from '@react-google-maps/api';
import React, { memo } from 'react';

// Memoize the libraries array to prevent re-creation on re-renders
const libraries: LoadScriptProps['libraries'] = ['places'];

interface GoogleMapsLoaderProps {
  children: React.ReactNode;
}

const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = memo(({ children }) => {
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key is not set');
    return <>{children}</>;
  }

  return (
    <LoadScript
      googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
      libraries={libraries}
      loadingElement={<div>Loading...</div>}
    >
      {children}
    </LoadScript>
  );
});

GoogleMapsLoader.displayName = 'GoogleMapsLoader';

export default GoogleMapsLoader;
