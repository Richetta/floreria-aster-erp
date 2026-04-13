// ============================================
// GOOGLE MAPS UTILITIES - Florería Aster ERP
// ============================================
// Geocoding, Directions, Distance Matrix, and Map URL generation

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface DirectionsResult {
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  steps: Array<{
    instruction: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
    start_location: { lat: number; lng: number };
    end_location: { lat: number; lng: number };
  }>;
  overview_path: Array<{ lat: number; lng: number }>;
}

export interface DistanceMatrixResult {
  origins: string[];
  destinations: string[];
  rows: Array<{
    elements: Array<{
      distance: { text: string; value: number } | null;
      duration: { text: string; value: number } | null;
      status: string;
    }>;
  }>;
}

// ============================================
// GEOCODING - Convert address to coordinates
// ============================================
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formattedAddress: result.formatted_address,
      };
    }
    
    console.warn(`Geocoding failed for address: ${address}`, data.status);
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

// ============================================
// DIRECTIONS - Get route between two points
// ============================================
export async function getDirections(
  origin: string | { lat: number; lng: number },
  destination: string | { lat: number; lng: number },
  waypoints?: Array<string | { lat: number; lng: number }>
): Promise<DirectionsResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
  }

  try {
    const originStr = typeof origin === 'string' 
      ? origin 
      : `${origin.lat},${origin.lng}`;
    const destinationStr = typeof destination === 'string' 
      ? destination 
      : `${destination.lat},${destination.lng}`;
    
    let waypointsParam = '';
    if (waypoints && waypoints.length > 0) {
      const waypointsStr = waypoints
        .map(wp => typeof wp === 'string' ? wp : `${wp.lat},${wp.lng}`)
        .join('|');
      waypointsParam = `&waypoints=optimize:true|${waypointsStr}`;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destinationStr)}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=es`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      // Decode overview polyline (simplified - in production, use a polyline decoder)
      const overviewPath = decodePolyline(route.overview_polyline?.points || '');
      
      return {
        distance: leg.distance,
        duration: leg.duration,
        steps: leg.steps.map((step: any) => ({
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          distance: step.distance,
          duration: step.duration,
          start_location: step.start_location,
          end_location: step.end_location,
        })),
        overview_path: overviewPath,
      };
    }
    
    console.warn('Directions request failed:', data.status);
    return null;
  } catch (error) {
    console.error('Error getting directions:', error);
    return null;
  }
}

// ============================================
// DISTANCE MATRIX - Get distances between multiple points
// ============================================
export async function getDistanceMatrix(
  origins: string[],
  destinations: string[]
): Promise<DistanceMatrixResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins.join('|'))}&destinations=${encodeURIComponent(destinations.join('|'))}&key=${GOOGLE_MAPS_API_KEY}&mode=driving&language=es`
    );
    
    const data = await response.json();
    
    if (data.status === 'OK') {
      return {
        origins: data.origin_addresses,
        destinations: data.destination_addresses,
        rows: data.rows.map((row: any) => ({
          elements: row.elements.map((element: any) => ({
            distance: element.status === 'OK' ? element.distance : null,
            duration: element.status === 'OK' ? element.duration : null,
            status: element.status,
          })),
        })),
      };
    }
    
    console.warn('Distance Matrix request failed:', data.status);
    return null;
  } catch (error) {
    console.error('Error getting distance matrix:', error);
    return null;
  }
}

// ============================================
// MAP URL GENERATION - For external links
// ============================================
export function generateGoogleMapsUrl(
  origin: string,
  destinations: string[]
): string {
  const base = 'https://www.google.com/maps/dir/';
  const allPoints = [origin, ...destinations];
  return base + allPoints.map(p => encodeURIComponent(p)).join('/');
}

export function generateGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// ============================================
// POLYLINE DECODER - Google's encoded polyline algorithm
// ============================================
function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  if (!encoded) return [];
  
  const coordinates: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  
  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    
    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    
    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  
  return coordinates;
}

// ============================================
// ADDRESS FORMATTER - Format delivery address to string
// ============================================
export function formatAddress(address: {
  street?: string;
  number?: string;
  floor?: string;
  city?: string;
  reference?: string;
}): string {
  const parts = [
    address.street,
    address.number,
    address.floor,
    address.city,
  ].filter(Boolean).join(', ');
  
  return parts || 'Dirección no especificada';
}

// ============================================
// API KEY CHECK
// ============================================
export function isGoogleMapsConfigured(): boolean {
  return !!GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== 'your-google-maps-api-key-here';
}
