// ============================================
// ROUTE OPTIMIZER - Florería Aster ERP
// ============================================
// Implements nearest-neighbor algorithm for delivery route optimization

import { geocodeAddress, getDirections, formatAddress, isGoogleMapsConfigured } from '../utils/googleMaps';

// Minimal order type for route optimization
export interface DeliveryOrder {
  id: string;
  customer_name?: string;
  customerName?: string;
  delivery_method?: 'pickup' | 'delivery';
  deliveryMethod?: 'pickup' | 'delivery';
  delivery_address?: {
    street?: string;
    number?: string;
    floor?: string;
    city?: string;
    reference?: string;
  };
  deliveryAddress?: {
    street?: string;
    number?: string;
    floor?: string;
    city?: string;
    reference?: string;
  };
  contact_phone?: string;
  contactPhone?: string;
  customer_phone?: string;
  customerPhone?: string;
  status?: string;
  [key: string]: any;
}

export interface OptimizedRoutePoint {
  order: DeliveryOrder;
  address: string;
  coordinates?: { lat: number; lng: number };
  distanceFromPrevious?: { text: string; value: number };
  durationFromPrevious?: { text: string; value: number };
}

export interface OptimizedRouteResult {
  points: OptimizedRoutePoint[];
  totalDistance: { text: string; value: number };
  totalDuration: { text: string; value: number };
  floristAddress: string;
  floristCoordinates?: { lat: number; lng: number };
}

// ============================================
// NEAREST NEIGHBOR ALGORITHM
// ============================================
// Simple but effective heuristic for route optimization
// Time complexity: O(n²), good for up to ~20 deliveries
export async function optimizeRoute(
  deliveries: DeliveryOrder[],
  floristAddress: string
): Promise<OptimizedRouteResult | null> {
  if (!isGoogleMapsConfigured()) {
    console.warn('Google Maps API not configured');
    return null;
  }

  if (deliveries.length === 0) {
    return {
      points: [],
      totalDistance: { text: '0 km', value: 0 },
      totalDuration: { text: '0 min', value: 0 },
      floristAddress,
    };
  }

  // Step 1: Geocode florist address
  const floristGeocoded = await geocodeAddress(floristAddress);
  const floristCoords = floristGeocoded
    ? { lat: floristGeocoded.lat, lng: floristGeocoded.lng }
    : undefined;

  // Step 2: Prepare delivery points with addresses
  const deliveryPoints = deliveries
    .filter(order => {
      const method = order.delivery_method || order.deliveryMethod;
      const address = order.delivery_address || order.deliveryAddress;
      return method === 'delivery' && address?.street;
    })
    .map(order => {
      const address = order.delivery_address || order.deliveryAddress;
      return {
        order,
        address: formatAddress(address!),
      };
    });

  if (deliveryPoints.length === 0) {
    return {
      points: [],
      totalDistance: { text: '0 km', value: 0 },
      totalDuration: { text: '0 min', value: 0 },
      floristAddress,
    };
  }

  // Step 3: Geocode all delivery addresses (in parallel for performance)
  const geocodingPromises = deliveryPoints.map(async (point) => {
    const geocoded = await geocodeAddress(point.address);
    return {
      ...point,
      coordinates: geocoded ? { lat: geocoded.lat, lng: geocoded.lng } : undefined,
    };
  });

  const geocodedPoints = await Promise.all(geocodingPromises);

  // Step 4: Build distance matrix (only for successfully geocoded points)
  const successfullyGeocoded = geocodedPoints.filter(p => p.coordinates);

  if (successfullyGeocoded.length === 0) {
    // Fallback: return unoptimized route if geocoding fails
    return {
      points: geocodedPoints.map(p => ({ ...p, coordinates: undefined })),
      totalDistance: { text: 'N/A', value: 0 },
      totalDuration: { text: 'N/A', value: 0 },
      floristAddress,
    };
  }

  // Step 5: Create distance matrix
  const origins = [
    floristAddress,
    ...successfullyGeocoded.map(p => p.address)
  ];
  const destinations = [...origins];

  // For small number of points, get full matrix
  // For larger sets, we'll use pairwise calculations
  const matrixSize = origins.length;

  // Build simplified distance matrix using Directions API
  // (For production with many deliveries, use Distance Matrix API)
  const distanceMatrix: number[][] = Array(matrixSize).fill(null).map(() => Array(matrixSize).fill(Infinity));

  // Get distances from florist to all deliveries
  for (let i = 1; i < matrixSize; i++) {
    const directions = await getDirections(origins[0], destinations[i]);
    if (directions) {
      distanceMatrix[0][i] = directions.distance.value;
      distanceMatrix[i][0] = directions.distance.value;
    }
  }

  // Get distances between all delivery pairs
  for (let i = 1; i < matrixSize; i++) {
    for (let j = i + 1; j < matrixSize; j++) {
      const directions = await getDirections(origins[i], destinations[j]);
      if (directions) {
        distanceMatrix[i][j] = directions.distance.value;
        distanceMatrix[j][i] = directions.distance.value;
      }
    }
  }

  // Step 6: Apply Nearest Neighbor Algorithm
  const visited: boolean[] = Array(matrixSize).fill(false);
  const route: number[] = [0]; // Start at florist (index 0)
  visited[0] = true;

  let currentPoint = 0;
  let totalDistance = 0;

  for (let step = 1; step < successfullyGeocoded.length; step++) {
    let nearestPoint = -1;
    let nearestDistance = Infinity;

    // Find nearest unvisited point
    for (let i = 1; i < matrixSize; i++) {
      if (!visited[i] && distanceMatrix[currentPoint][i] < nearestDistance) {
        nearestDistance = distanceMatrix[currentPoint][i];
        nearestPoint = i;
      }
    }

    if (nearestPoint !== -1) {
      route.push(nearestPoint);
      visited[nearestPoint] = true;
      totalDistance += nearestDistance;
      currentPoint = nearestPoint;
    }
  }

  // Step 7: Build optimized route result
  const optimizedPoints: OptimizedRoutePoint[] = [];
  let cumulativeDistance = 0;

  for (let i = 1; i < route.length; i++) {
    const deliveryIndex = route[i] - 1; // Adjust for florist at index 0
    const delivery = successfullyGeocoded[deliveryIndex];

    if (delivery && delivery.coordinates) {
      // Get actual directions for this leg
      const previousAddress = i === 1 ? floristAddress : optimizedPoints[i - 2].address;
      const directions = await getDirections(previousAddress, delivery.address);

      const point: OptimizedRoutePoint = {
        order: delivery.order,
        address: delivery.address,
        coordinates: delivery.coordinates,
        distanceFromPrevious: directions?.distance,
        durationFromPrevious: directions?.duration,
      };

      if (directions) {
        cumulativeDistance += directions.distance.value;
      }

      optimizedPoints.push(point);
    }
  }

  return {
    points: optimizedPoints,
    totalDistance: {
      text: `${(cumulativeDistance / 1000).toFixed(1)} km`,
      value: cumulativeDistance
    },
    totalDuration: {
      text: calculateEstimatedDuration(cumulativeDistance),
      value: cumulativeDistance / 1000 * 3 // ~3 min per km in city
    },
    floristAddress,
    floristCoordinates: floristCoords,
  };
}

// ============================================
// HELPER: Calculate estimated duration
// ============================================
function calculateEstimatedDuration(distanceInMeters: number): string {
  const distanceInKm = distanceInMeters / 1000;
  const avgSpeedKmh = 30; // Average city speed
  const durationMinutes = (distanceInKm / avgSpeedKmh) * 60;

  if (durationMinutes < 60) {
    return `${Math.round(durationMinutes)} min`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = Math.round(durationMinutes % 60);
  return `${hours}h ${minutes}m`;
}

// ============================================
// SIMPLIFIED OPTIMIZATION (for quick estimates)
// ============================================
export async function quickRouteEstimate(
  deliveries: DeliveryOrder[]
): Promise<{ totalDistance: string; totalDuration: string; deliveryCount: number } | null> {
  if (deliveries.length === 0) {
    return { totalDistance: '0 km', totalDuration: '0 min', deliveryCount: 0 };
  }

  // Simplified: assume average 5km per delivery in city
  const estimatedDistance = deliveries.length * 5; // km
  const estimatedDuration = Math.round((estimatedDistance / 30) * 60); // minutes

  return {
    totalDistance: `~${estimatedDistance} km`,
    totalDuration: estimatedDuration < 60 ? `~${estimatedDuration} min` : `~${Math.floor(estimatedDuration / 60)}h ${estimatedDuration % 60}m`,
    deliveryCount: deliveries.length,
  };
}

// ============================================
// GENERATE OPTIMIZED GOOGLE MAPS URL
// ============================================
export function generateOptimizedMapsUrl(
  optimizedRoute: OptimizedRouteResult
): string {
  const base = 'https://www.google.com/maps/dir/';
  const waypoints = [optimizedRoute.floristAddress, ...optimizedRoute.points.map(p => p.address)];
  return base + waypoints.map(p => encodeURIComponent(p)).join('/');
}
