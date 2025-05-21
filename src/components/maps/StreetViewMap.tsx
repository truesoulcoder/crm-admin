import { GoogleMap, LoadScript, StreetViewPanorama } from '@react-google-maps/api';
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface StreetViewMapProps {
  address: string;
  containerStyle?: React.CSSProperties;
}

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
  const [position, setPosition] = React.useState<google.maps.LatLngLiteral | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isGeocoding, setIsGeocoding] = React.useState(false);
  const [apiKey, setApiKey] = React.useState<string>('');

  // Get API key from environment or use a placeholder
  React.useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
    if (!key) {
      console.error('Google Maps API key is not set. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
      setError('Google Maps API key is not configured');
      return;
    }
    setApiKey(key);
  }, []);

  // Load Google Maps API
  React.useEffect(() => {
    if (!apiKey) return;

    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = () => setIsLoaded(true);
      script.onerror = () => {
        setError('Failed to load Google Maps API');
        setIsLoaded(false);
      };
      document.head.appendChild(script);
      
      return () => {
        // Cleanup script if component unmounts
        document.head.removeChild(script);
      };
    } else {
      setIsLoaded(true);
    }
  }, [apiKey]);

  // Geocode address when address or API is ready
  React.useEffect(() => {
    if (!isLoaded || !address || !apiKey) return;
    
    const geocodeAddress = async () => {
      setIsGeocoding(true);
      setError(null);
      
      try {
        const geocoder = new window.google.maps.Geocoder();
        
        geocoder.geocode({ address: address.trim() }, (results, status) => {
          setIsGeocoding(false);
          
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            const location = results[0].geometry.location;
            setPosition({ lat: location.lat(), lng: location.lng() });
          } else {
            console.error('Geocoding failed:', status, results);
            setError('Could not find location for this address. Please check the address format.');
          }
        });
      } catch (err) {
        console.error('Geocoding error:', err);
        setError('Error while processing the address');
        setIsGeocoding(false);
      }
    };
    
    // Add a small delay to prevent too many API calls
    const timer = setTimeout(geocodeAddress, 500);
    return () => clearTimeout(timer);
  }, [address, isLoaded, apiKey]);

  // Loading state
  if (!apiKey) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center p-4 text-center">
        <AlertTriangle className="w-8 h-8 text-warning mb-2" />
        <p className="text-warning">Google Maps API key is not configured</p>
      </div>
    );
  }

  if (!isLoaded || isGeocoding) {
    return (
      <div style={containerStyle} className="bg-base-200 rounded-lg flex flex-col items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
        <p className="mt-2 text-sm text-base-content/70">Loading map...</p>
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
        <p>No location data available</p>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="relative">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={position}
        zoom={15}
        options={{
          disableDefaultUI: true,
          zoomControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        <StreetViewPanorama
          position={position}
          options={{
            position,
            addressControl: false,
            showRoadLabels: false,
            zoom: 1,
          }}
        />
      </GoogleMap>
    </div>
  );
};

export default StreetViewMap;
