import { GoogleMap, StreetViewPanorama, useLoadScript } from '@react-google-maps/api';
import { MapPin, AlertTriangle, Loader2 } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

interface StreetViewMapProps {
  address: string;
  containerStyle?: React.CSSProperties;
}

// Helper component to show error state
const ErrorDisplay = ({ message, containerStyle }: { message: string; containerStyle: React.CSSProperties }) => (
  <div style={containerStyle} className="bg-base-200 rounded-lg flex items-center justify-center">
    <p>Error: {message}</p>
  </div>
);

const StreetViewMap: React.FC<StreetViewMapProps> = ({
  address,
  containerStyle = {
    width: '100%',
    height: '300px',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
    overflow: 'hidden'
  },
}) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || '',
    libraries: ['places'],
  });

  // State hooks - must be called unconditionally at the top
  const [position, setPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [hasStreetView, setHasStreetView] = useState<boolean>(false);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Handle API key and load errors
  useEffect(() => {
    if (!apiKey) {
      console.error('Google Maps API key is not set. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
      setApiError('Google Maps API key is not configured');
    }
    
    if (loadError) {
      console.error('Error loading Google Maps:', loadError);
      setApiError('Failed to load Google Maps. Please try again later.');
    }
  }, [apiKey, loadError]);

  // Check if Street View is available at the given position
  const checkStreetView = useCallback((lat: number, lng: number, callback: (hasStreetView: boolean) => void) => {
    if (!window.google?.maps) {
      callback(false);
      return;
    }
    
    const streetViewService = new window.google.maps.StreetViewService();
    
    // Using the promise-based API with proper error handling
    const panoramaPromise = new Promise<boolean>((resolve) => {
      // Using void to explicitly ignore the promise since we're using callbacks
      void streetViewService.getPanorama(
        { location: { lat, lng }, radius: 50 },
        (data, status) => {
          resolve(status === 'OK');
        }
      );
    });
    
    // Handle the promise and call the callback
    // Using void to explicitly ignore the promise since we're using callbacks
    void panoramaPromise
      .then((hasStreetView) => {
        callback(hasStreetView);
      })
      .catch((error) => {
        console.error('Error checking Street View:', error);
        callback(false);
      });
  }, []);

  // Geocode address when address changes
  useEffect(() => {
    if (!address) return;
    
    const geocodeAddress = async () => {
      if (!window.google?.maps) {
        console.error('Google Maps API not loaded');
        return;
      }

      setIsGeocoding(true);
      setError(null);
      
      try {
        const geocoder = new window.google.maps.Geocoder();
        const request = { address: address.trim() };
        
        // Using async/await for better promise handling
        try {
          const response = await geocoder.geocode(request);
          const results = response.results;
          
          setIsGeocoding(false);
          
          if (results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            const latLng = { lat: location.lat(), lng: location.lng() };
            setPosition(latLng);
            
            // Check if Street View is available at this location
            // Using a separate function to handle the async operation
            const checkStreetViewAvailability = async () => {
              try {
                await new Promise<void>((resolve) => {
                  checkStreetView(latLng.lat, latLng.lng, (hasStreetView) => {
                    setHasStreetView(hasStreetView);
                    setShowMap(!hasStreetView); // Show map only if no street view
                    resolve();
                  });
                });
              } catch (error) {
                console.error('Error in Street View check:', error);
                setHasStreetView(false);
                setShowMap(true);
              }
            };
            
            // Start the async operation without waiting for it to complete
            void checkStreetViewAvailability();
          } else {
            console.error('Geocoding failed: No results', results);
            setError('Could not find location for this address. Please check the address format.');
            setShowMap(true); // Fall back to map view
          }
        } catch (error) {
          console.error('Geocoding error:', error);
          setError('Error while processing the address');
          setIsGeocoding(false);
          setShowMap(true);
        }
      } catch (err) {
        console.error('Unexpected error in geocoding:', err);
        setError('An unexpected error occurred');
        setIsGeocoding(false);
        setShowMap(true);
      }
    };
    
    // Add a small delay to prevent too many API calls
    const timer = setTimeout(() => {
      void geocodeAddress();
    }, 500);
    return () => clearTimeout(timer);
  }, [address, apiKey, checkStreetView]);
  
  // Toggle between map and street view
  const toggleView = () => {
    setShowMap(prev => !prev);
  };

  const handleMapLoad = () => {
    setMapLoaded(true);
  };

  // Loading state
  if (!apiKey) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-8 h-8 text-warning mb-2" />
        <p className="text-warning">Google Maps API key is not configured</p>
      </div>
    );
  }

  // Handle loading and error states
  if (!isLoaded) {
    return (
      <div style={containerStyle} className="flex items-center justify-center bg-base-200">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  if (apiError || loadError) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-error mb-2" />
        <p className="text-error">{apiError || 'Failed to load Google Maps'}</p>
        <p className="text-sm text-base-content/70 mt-2">Please try again later</p>
      </div>
    );
  }

  if (isGeocoding) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p className="text-sm text-base-content/70">Finding location...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-error mb-2" />
        <p className="text-error">{error}</p>
        <p className="text-sm text-base-content/70 mt-2">Address: {address}</p>
      </div>
    );
  }

  if (!position) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex items-center justify-center">
        <p>No location data available for this address</p>
      </div>
    );
  }

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  };

  // Render loading state
  if (!isLoaded) {
    return (
      <div style={containerStyle} className="flex items-center justify-center bg-base-200">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2" />
          <p>Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  // Render error state if API key is missing or there was a load error
  if (apiError || loadError) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-error mb-2" />
        <p className="text-error">{apiError || 'Failed to load Google Maps'}</p>
        <p className="text-sm text-base-content/70 mt-2">Please try again later</p>
      </div>
    );
  }

  // Render geocoding state
  if (isGeocoding) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p className="text-sm text-base-content/70">Finding location...</p>
      </div>
    );
  }

  // Render error state if there was an error
  if (error) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-6 h-6 text-error mb-2" />
        <p className="text-error">{error}</p>
        <p className="text-sm text-base-content/70 mt-2">Address: {address}</p>
      </div>
    );
  }

  // Render no position state
  if (!position) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex items-center justify-center">
        <p>No location data available for this address</p>
      </div>
    );
  }

  // Main render
  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-base-100 p-2 border-b border-base-200 shadow-sm">
        <h3 className="font-medium">Property Location</h3>
        <p className="text-sm text-base-content/80">{address}</p>
      </div>
      
      <div style={containerStyle} className="relative">
        {hasStreetView && !showMap ? (
          // Street View Mode
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={position}
            zoom={15}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              fullscreenControl: false,
              streetViewControl: false,
              mapTypeControl: false,
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }]
                }
              ]
            }}
          >
            <StreetViewPanorama
              options={{
                position,
                addressControl: true,
                showRoadLabels: true,
                zoom: 1,
                disableDefaultUI: true,
                motionTracking: false,
                motionTrackingControl: false,
                fullscreenControl: false,
                linksControl: false,
                panControl: false,
                zoomControl: false,
                enableCloseButton: false,
                scrollwheel: true,
                clickToGo: true,
                disableDoubleClickZoom: false,
                pov: { heading: 34, pitch: 10 }
              }}
            />
            <div className="absolute top-2 right-2 z-10 bg-white p-1 rounded shadow">
              <button 
                onClick={() => setShowMap(true)}
                className="btn btn-sm btn-ghost"
                title="Switch to Map View"
              >
                <MapPin className="w-4 h-4 mr-1" />
                Show Map
              </button>
            </div>
          </GoogleMap>
        ) : (
          // Map View Mode
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={position}
            zoom={15}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              fullscreenControl: false,
              streetViewControl: false,
              mapTypeControl: false,
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }]
                }
              ]
            }}
          >
            <div className="absolute top-2 right-2 z-10 bg-white p-1 rounded shadow">
              <button 
                onClick={() => setShowMap(false)}
                className="btn btn-sm btn-ghost"
                disabled={!hasStreetView}
                title={hasStreetView ? 'Switch to Street View' : 'Street View not available'}
              >
                <MapPin className="w-4 h-4 mr-1" />
                {hasStreetView ? 'Show Street View' : 'Street View Not Available'}
              </button>
            </div>
          </GoogleMap>
        )}
      </div>
    </div>
  );
};

export default StreetViewMap;
