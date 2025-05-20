import { GoogleMap, LoadScript, StreetViewPanorama } from '@react-google-maps/api';
import React from 'react';

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

  React.useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
    } else {
      setIsLoaded(true);
    }
  }, []);

  React.useEffect(() => {
    if (!isLoaded || !address) return;

    const geocoder = new window.google.maps.Geocoder();
    
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results?.[0]?.geometry?.location) {
        const location = results[0].geometry.location;
        setPosition({ lat: location.lat(), lng: location.lng() });
        setError(null);
      } else {
        setError('Could not find location for this address');
      }
    });
  }, [address, isLoaded]);

  if (!isLoaded) {
    return (
      <div style={containerStyle} className="bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle} className="bg-base-200 flex items-center justify-center">
        <p className="text-error">{error}</p>
      </div>
    );
  }

  if (!position) {
    return (
      <div style={containerStyle} className="bg-base-200 flex items-center justify-center">
        <p>Loading map...</p>
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
