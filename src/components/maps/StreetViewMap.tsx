// src/components/maps/StreetViewMap.tsx
'use client';

import { GoogleMap, StreetViewPanorama, MarkerF } from '@react-google-maps/api';
import { MapPin, AlertTriangle, Loader2, RefreshCw, Eye, Map } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';

interface StreetViewMapProps {
  address: string;
  containerStyle?: React.CSSProperties;
}

const defaultContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
  marginBottom: '1rem',
  overflow: 'hidden',
  position: 'relative', // For positioning the toggle button
};

const ErrorDisplay: React.FC<{ message: string; style: React.CSSProperties }> = ({ message, style }) => (
  <div style={style} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
    <AlertTriangle className="w-8 h-8 text-error mb-2" />
    <p className="text-error-content">{message}</p>
  </div>
);

const LoadingDisplay: React.FC<{ message: string; style: React.CSSProperties }> = ({ message, style }) => (
  <div style={style} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
    <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
    <p className="text-base-content">{message}</p>
  </div>
);

const StreetViewMap: React.FC<StreetViewMapProps> = ({
  address,
  containerStyle = defaultContainerStyle,
}) => {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [hasStreetView, setHasStreetView] = useState<boolean>(false);
  const [showStreetView, setShowStreetView] = useState<boolean>(true); // Prefer Street View if available
  const [criticalApiError, setCriticalApiError] = useState<string | null>(null);
  const [isApiReady, setIsApiReady] = useState<boolean>(false);

  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const streetViewServiceRef = useRef<google.maps.StreetViewService | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setCriticalApiError('Google Maps API key is not configured.');
      setIsApiReady(false);
      return;
    }
    if (window.google && window.google.maps && window.google.maps.Geocoder && window.google.maps.StreetViewService) {
      geocoderRef.current = new window.google.maps.Geocoder();
      streetViewServiceRef.current = new window.google.maps.StreetViewService();
      setIsApiReady(true);
      setCriticalApiError(null);
    } else {
      // API not yet loaded by parent (GoogleMapsLoader)
      setIsApiReady(false);
      // No critical error here, parent loader should show loading/error
    }
  }, [apiKey]);

  const checkStreetViewAvailability = useCallback(async (latLng: google.maps.LatLngLiteral): Promise<boolean> => {
    if (!streetViewServiceRef.current) return false;
    try {
      const { data } = await streetViewServiceRef.current.getPanorama({
        location: latLng,
        radius: 50,
        source: window.google.maps.StreetViewSource.OUTDOOR, // Prefer outdoor images
      });
      return data.location?.latLng !== undefined;
    } catch (error) {
      console.warn('Street View check failed:', error);
      return false;
    }
  }, []);

  const geocodeAddressAndCheckStreetView = useCallback(async (currentAddress: string) => {
    if (!geocoderRef.current) {
      console.warn('Geocoder not ready.');
      return;
    }

    setIsGeocoding(true);
    setGeocodingError(null);
    setPosition(null);
    setHasStreetView(false);

    try {
      const { results } = await geocoderRef.current.geocode({ address: currentAddress.trim() });
      if (results && results[0] && results[0].geometry && results[0].geometry.location) {
        const location = results[0].geometry.location;
        const latLng = { lat: location.lat(), lng: location.lng() };
        setPosition(latLng);

        const streetViewAvailable = await checkStreetViewAvailability(latLng);
        setHasStreetView(streetViewAvailable);
        setShowStreetView(streetViewAvailable); // Show SV if available, otherwise map
      } else {
        setGeocodingError('Could not find location for this address. Please check the address format.');
      }
    } catch (error: any) {
      console.error('Geocoding error:', error);
      if (error.code === 'ZERO_RESULTS') {
        setGeocodingError('Address not found. Please try a different address.');
      } else {
        setGeocodingError('Error processing the address. Please try again.');
      }
    } finally {
      setIsGeocoding(false);
    }
  }, [checkStreetViewAvailability]); // geocoderRef.current is stable after API ready

  useEffect(() => {
    if (isApiReady && address) {
      const handler = setTimeout(() => {
        void geocodeAddressAndCheckStreetView(address);
      }, 700); // Debounce
      return () => clearTimeout(handler);
    }
  }, [address, isApiReady, geocodeAddressAndCheckStreetView]);

  const toggleViewMode = useCallback(() => {
    if (hasStreetView) { // Only toggle if Street View is an option
      setShowStreetView(prev => !prev);
    }
  }, [hasStreetView]);

  if (criticalApiError) {
    return <ErrorDisplay message={criticalApiError} style={containerStyle} />;
  }

  if (!isApiReady && apiKey) { // API Key is there, but window.google.maps not yet (GoogleMapsLoader might be loading)
    return <LoadingDisplay message="Loading Google Maps interface..." style={containerStyle} />;
  }
  
  if (!isApiReady && !apiKey) { // Should be caught by criticalApiError, but as a fallback
     return <ErrorDisplay message="Google Maps API key not set and API not loaded." style={containerStyle} />;
  }

  if (isGeocoding) {
    return <LoadingDisplay message="Fetching location data..." style={containerStyle} />;
  }

  if (geocodingError) {
    return <ErrorDisplay message={geocodingError} style={containerStyle} />;
  }

  if (!position) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex items-center justify-center">
        <p className="text-base-content/70">Enter an address to see Street View or Map.</p>
      </div>
    );
  }
  
  const panoramaOptions = {
    position,
    pov: { heading: 34, pitch: 10 },
    visible: true,
    disableDefaultUI: true,
    clickToGo: true,
    scrollwheel: true,
  };

  const mapOptions = {
    center: position,
    zoom: 17,
    disableDefaultUI: true,
    gestureHandling: 'cooperative',
  };

  return (
    <div style={containerStyle}>
      {hasStreetView && (
        <button
          onClick={toggleViewMode}
          className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2 z-10 bg-base-100/70 hover:bg-base-100"
          aria-label={showStreetView ? "Switch to Map View" : "Switch to Street View"}
        >
          {showStreetView ? <Map size={18} /> : <Eye size={18} />}
        </button>
      )}

      {showStreetView && hasStreetView ? (
        <StreetViewPanorama
          options={panoramaOptions}
        />
      ) : (
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={position}
          zoom={mapOptions.zoom}
          options={mapOptions}
        >
          <MarkerF position={position} title={address} />
        </GoogleMap>
      )}
       {!hasStreetView && position && (
         <div className="absolute bottom-2 left-2 bg-base-100/70 p-1.5 rounded text-xs text-base-content">
            Street View not available for this location. Showing map.
          </div>
       )}
    </div>
  );
};

export default StreetViewMap;