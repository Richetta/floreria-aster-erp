import { useEffect, useRef, useState } from 'react';
import { isGoogleMapsConfigured } from '../../utils/googleMaps';
import './GoogleMap.css';

// Google Maps type declarations
declare global {
  interface Window {
    google: any;
  }
}

export interface MapMarker {
  position: { lat: number; lng: number };
  label: string;
  title: string;
  color?: string;
  info?: string;
}

export interface MapRoute {
  path: Array<{ lat: number; lng: number }>;
  color?: string;
  weight?: number;
}

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  routes?: MapRoute[];
  height?: string;
  className?: string;
  onMarkerClick?: (marker: MapMarker) => void;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export const GoogleMap: React.FC<GoogleMapProps> = ({
  center = { lat: -32.9442, lng: -60.6505 }, // Default: Rosario, Argentina
  zoom = 13,
  markers = [],
  routes = [],
  height = '400px',
  className = '',
  onMarkerClick,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setError('API key de Google Maps no configurada');
      return;
    }

    const loadMap = () => {
      // Check if Google Maps is already loaded
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      // Load Google Maps script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&language=es`;
      script.async = true;

      script.onload = () => initializeMap();
      script.onerror = () => setError('Error al cargar Google Maps');

      document.head.appendChild(script);
    };

    const initializeMap = () => {
      if (!mapRef.current || !window.google) return;

      try {
        const google = window.google;
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom,
          styles: mapStyles,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        });

        // Add markers
        markers.forEach((markerData) => {
          const marker = new google.maps.Marker({
            position: markerData.position,
            map,
            title: markerData.title,
            label: {
              text: markerData.label,
              color: markerData.color || '#FFFFFF',
              fontWeight: 'bold',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: markerData.color || '#A855F7',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            },
          });

          if (markerData.info) {
            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="padding: 8px;"><strong>${markerData.title}</strong><br/>${markerData.info}</div>`,
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
              onMarkerClick?.(markerData);
            });
          }
        });

        // Draw routes
        routes.forEach((routeData) => {
          if (routeData.path.length > 1) {
            const polyline = new google.maps.Polyline({
              path: routeData.path,
              geodesic: true,
              strokeColor: routeData.color || '#A855F7',
              strokeOpacity: 1.0,
              strokeWeight: routeData.weight || 4,
            });

            polyline.setMap(map);
          }
        });

        // Fit bounds
        if (markers.length > 0 || routes.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          markers.forEach(m => bounds.extend(m.position));
          routes.forEach(r => r.path.forEach(p => bounds.extend(p)));
          map.fitBounds(bounds);
        }

        setIsLoaded(true);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Error al inicializar el mapa');
      }
    };

    loadMap();
  }, [center, zoom, markers, routes, onMarkerClick]);

  if (error) {
    return (
      <div
        className={`google-map-error ${className}`}
        style={{ height }}
      >
        <div className="error-content">
          <span className="material-symbols-rounded error-icon">error_outline</span>
          <p>{error}</p>
          <button
            className="btn-configure"
            onClick={() => window.open('https://console.cloud.google.com/google/maps-apis', '_blank')}
          >
            Configurar API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`google-map-container ${className}`} style={{ height }}>
      <div ref={mapRef} className="google-map" />
      {!isLoaded && (
        <div className="map-loading">
          <div className="loading-spinner" />
          <p>Cargando mapa...</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAP STYLES - Custom theme matching app design
// ============================================
const mapStyles = [
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e9e9e9' }, { lightness: 17 }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }, { lightness: 20 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#ffffff' }, { lightness: 17 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#ffffff' }, { lightness: 29 }, { weight: 0.2 }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }, { lightness: 18 }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }, { lightness: 16 }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#f5f5f5' }, { lightness: 21 }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#dedede' }, { lightness: 21 }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ visibility: 'on' }, { color: '#ffffff' }, { lightness: 16 }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ saturation: 36 }, { color: '#333333' }, { lightness: 40 }],
  },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#f2f2f2' }, { lightness: 19 }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.fill',
    stylers: [{ color: '#fefefe' }, { lightness: 20 }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#fefefe' }, { lightness: 17 }, { weight: 1.2 }],
  },
];

// ============================================
// CSS
// ============================================
const style = document.createElement('style');
style.textContent = `
  .google-map-container {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .google-map {
    width: 100%;
    height: 100%;
  }

  .map-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(4px);
    gap: 12px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(168, 85, 247, 0.2);
    border-top-color: #A855F7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .google-map-error {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
    border: 2px dashed #d1d5db;
  }

  .error-content {
    text-align: center;
    padding: 2rem;
  }

  .error-icon {
    font-size: 48px;
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .error-content p {
    color: #6b7280;
    margin: 0.5rem 0;
  }

  .btn-configure {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: #A855F7;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
  }

  .btn-configure:hover {
    background: #9333ea;
    transform: translateY(-1px);
  }
`;
document.head.appendChild(style);
