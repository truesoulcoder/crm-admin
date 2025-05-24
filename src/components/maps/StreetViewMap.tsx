// src/components/maps/StreetViewMap.tsx
'use client';

import { GoogleMap, StreetViewPanorama, MarkerF } from '@react-google-maps/api';
import { MapPin, AlertTriangle, Loader2, RefreshCw, Eye, Map } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useGoogleMapsApi } from './GoogleMapsLoader'; // Import the context hook

interface StreetViewMapProps {
  address: string;
  containerStyle?: React.CSSProperties;
  // No longer needs criticalApiError as this will be handled by GoogleMapsLoader or context
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

// Renamed isApiReady to isMapsApiLoaded
const StreetViewMapContent: React.FC<StreetViewMapProps & { isMapsApiLoaded: boolean }> = ({
  address,
  containerStyle = defaultContainerStyle,
  isMapsApiLoaded, // Use the new prop name
}) => {
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [hasStreetView, setHasStreetView] = useState<boolean>(false);
  const [showStreetView, setShowStreetView] = useState<boolean>(true);

  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const streetViewServiceRef = useRef<google.maps.StreetViewService | null>(null);

  // Memoize the geocode function to prevent infinite re-renders
  const geocodeAddressAndCheckStreetViewMemoized = useCallback(
    async (addr: string) => {
      if (!geocoderRef.current) {
        console.warn('Geocoder not ready.');
        return;
      }

      setIsGeocoding(true);
      setGeocodingError(null);
      setPosition(null);
      setHasStreetView(false);

      try {
        const { results } = await geocoderRef.current.geocode({ address: addr.trim() });
        if (results && results[0]?.geometry?.location) {
          const location = results[0].geometry.location;
          const latLng = { lat: location.lat(), lng: location.lng() };
          setPosition(latLng);
          
          // Check if Street View is available
          const hasSV = await checkStreetViewAvailability(latLng);
          setHasStreetView(hasSV);
        } else {
          setGeocodingError('No results found for this address.');
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        setGeocodingError('Failed to find this location. Please try another address.');
      } finally {
        setIsGeocoding(false);
      }
    },
    [checkStreetViewAvailability]
  );

  // Initialize services when component mounts or when API is ready
  useEffect(() => {
    // Use isMapsApiLoaded from props
    if (isMapsApiLoaded && window.google?.maps) {
      geocoderRef.current = new window.google.maps.Geocoder();
      streetViewServiceRef.current = new window.google.maps.StreetViewService();
      
      // Initial geocode
      if (address) {
        void geocodeAddressAndCheckStreetViewMemoized(address);
      }
    }
    
    return () => {
      // Cleanup
      geocoderRef.current = null;
      streetViewServiceRef.current = null;
    };
  }, [address, geocodeAddressAndCheckStreetViewMemoized, isMapsApiLoaded]); // Dependency updated

  const checkStreetViewAvailability = useCallback(async (latLng: google.maps.LatLngLiteral): Promise<boolean> => {
    if (!streetViewServiceRef.current || !window.google?.maps?.StreetViewService) return false; // Added window.google.maps.StreetViewService check
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
  }, []); // streetViewServiceRef.current will be initialized when isMapsApiLoaded is true

  useEffect(() => {
    // Use isMapsApiLoaded from props
    if (isMapsApiLoaded && address) {
      const handler = setTimeout(() => {
        void geocodeAddressAndCheckStreetViewMemoized(address);
      }, 700); // Debounce
      return () => clearTimeout(handler);
    }
  }, [address, isMapsApiLoaded, geocodeAddressAndCheckStreetViewMemoized]); // Dependency updated

  const toggleViewMode = useCallback(() => {
    if (hasStreetView) { // Only toggle if Street View is an option
      setShowStreetView(prev => !prev);
    }
  }, [hasStreetView]);

  // Redundant checks for API readiness (criticalApiError, apiKey, etc.) are removed.
  // StreetViewMapContent relies on its parent (`StreetViewMap`) to handle the main API loading/error states.
  // It will only render if isMapsApiLoaded is true, as enforced by the parent.

  // Show loading state while geocoding (this is specific to this component's logic)
  if (isGeocoding) {
    return <LoadingDisplay message="Fetching location data..." style={containerStyle} />;
  }

  // Show error if geocoding failed
  if (geocodingError) {
    return <ErrorDisplay message={geocodingError} style={containerStyle} />;
  }
  
  // Show message if no position is available
  if (!position) {
    return <ErrorDisplay message="No location data available." style={containerStyle} />;
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
      {/* Ensure window.google.maps is available before trying to use related constants */}
      {isMapsApiLoaded && hasStreetView && (
        <button
          onClick={toggleViewMode}
          className="btn btn-sm btn-circle btn-ghost absolute top-2 right-2 z-10 bg-base-100/70 hover:bg-base-100"
          aria-label={showStreetView ? "Switch to Map View" : "Switch to Street View"}
        >
          {showStreetView ? <Map size={18} /> : <Eye size={18} />}
        </button>
      )}

      {isMapsApiLoaded && showStreetView && hasStreetView ? (
        <StreetViewPanorama
          options={panoramaOptions}
        />
      ) : isMapsApiLoaded ? ( // Also check isMapsApiLoaded for GoogleMap
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={position}
          zoom={mapOptions.zoom}
          options={mapOptions}
        >
          <MarkerF position={position} title={address} />
        </GoogleMap>
      ) : null } {/* Render nothing or a placeholder if API not loaded */}
       {isMapsApiLoaded && !hasStreetView && position && (
         <div className="absolute bottom-2 left-2 bg-base-100/70 p-1.5 rounded text-xs text-base-content">
            Street View not available for this location. Showing map.
          </div>
       )}
    </div>
  );
};

const StreetViewMap: React.FC<StreetViewMapProps> = (props) => {
  // Consume context from GoogleMapsLoader
  const { isLoaded: isMapsApiLoaded, loadError } = useGoogleMapsApi();

  // Memoize the map container style
  const mapContainerStyle = useMemo(() => ({
    ...defaultContainerStyle,
    ...props.containerStyle,
  }), [props.containerStyle]);

  // Error and loading states are now primarily handled by GoogleMapsLoader,
  // but we can still show specific messages or fallbacks here if needed.
  if (loadError) {
    return <ErrorDisplay 
      message={`Error loading Google Maps API: ${loadError.message}`}
      style={mapContainerStyle} 
    />;
  }

  // if (!isMapsApiLoaded && !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
  //   // This case should be handled by GoogleMapsLoader, which shows an API key error.
  //   // If GoogleMapsLoader is not used, this component would not know about the API key directly.
  //   return <ErrorDisplay message="Google Maps API key not configured." style={mapContainerStyle} />;
  // }

  if (!isMapsApiLoaded) {
    // This message is shown if the context indicates Maps API isn't loaded yet.
    // GoogleMapsLoader should handle the initial script load display, but this provides
    // a fallback or component-specific loading message.
    return <LoadingDisplay message="Loading Google Maps interface..." style={mapContainerStyle} />;
  }
  
  // Pass isMapsApiLoaded to StreetViewMapContent; at this point, it should be true.
  return <StreetViewMapContent {...props} isMapsApiLoaded={isMapsApiLoaded} />;
};

export default StreetViewMap;