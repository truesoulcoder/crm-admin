'use client';

import { useJsApiLoader, Libraries } from '@react-google-maps/api';
import React, { memo } from 'react';

// Define the libraries array with the correct type
const libraries: Libraries = ['places', 'geocoding', 'streetView'];

interface GoogleMapsLoaderProps {
  children: React.ReactNode;
}

const GoogleMapsLoader: React.FC<GoogleMapsLoaderProps> = memo(({ children }) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  // Call useJsApiLoader unconditionally at the top
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-maps-script-main-loader', // Ensures the script is loaded only once
    googleMapsApiKey: apiKey || '', // Pass empty string if apiKey is undefined, hook might handle it or error out
    libraries,
    preventGoogleFontsLoading: true, 
  });

  // Now, handle API key check
  if (!apiKey) {
    console.error('Google Maps API key is not set. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        Error: Google Maps API key is not configured. Mapping features will be unavailable.
      </div>
    );
  }

  // Continue with loadError and isLoaded checks as before
  // Note: The original useJsApiLoader call was here, it's now moved up.
  // The config for useJsApiLoader is now part of the moved block.


  if (loadError) {
    console.error('GoogleMapsLoader: useJsApiLoader error:', loadError);
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'orange' }}>
        Error loading Google Maps: {loadError.message}. Some map features might be unavailable.
      </div>
    );
  }

  if (!isLoaded) {
    // console.log('GoogleMapsLoader: API loading via useJsApiLoader...'); // Optional diagnostic
    return <div>Loading Google Maps via hook...</div>; // Or any other loading indicator
  }

  // console.log('GoogleMapsLoader: API loaded successfully via useJsApiLoader. Rendering children.'); // Optional diagnostic
  return <>{children}</>;

});

GoogleMapsLoader.displayName = 'GoogleMapsLoader';

export default GoogleMapsLoader;
