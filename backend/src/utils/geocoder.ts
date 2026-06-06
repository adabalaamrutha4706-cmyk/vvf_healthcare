import { query } from '../config/db';

export interface GeocodingProvider {
  name: string;
  geocode(address: string): Promise<{ latitude: number; longitude: number; status: string } | null>;
}

// 1. Google Maps Geocoder (pluggable mock stub, ready to plug in a real API key)
export class GoogleMapsProvider implements GeocodingProvider {
  name = 'Google';
  async geocode(address: string) {
    if (!process.env.GOOGLE_MAPS_API_KEY) return null;
    // Future integration code
    return null;
  }
}

// 2. OpenStreetMap Nominatim Geocoder
export class NominatimProvider implements GeocodingProvider {
  name = 'Nominatim';
  async geocode(address: string) {
    try {
      // Nominatim requires an application name in User-Agent header
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
      
      const res = await fetch(url, {
        headers: { 'User-Agent': 'VVF-Healthcare-App/1.0' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) return null;
      const data = await res.json();
      if (data && Array.isArray(data) && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          status: 'VERIFIED'
        };
      }
      return null;
    } catch (e) {
      console.error('Nominatim geocode service timed out or offline, falling back.');
      return null;
    }
  }
}

// 3. Deterministic Hashing Fallback Geocoder (deterministic coordinates near Hyderabad center)
export class DeterministicProvider implements GeocodingProvider {
  name = 'DeterministicFallback';
  async geocode(address: string) {
    const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Limit coordinate offsets within standard city limits
    const latOffset = (hash % 100) / 1000; // e.g. 0.000 to 0.099
    const lngOffset = (hash % 70) / 1000;
    const latitude = 17.3850 + (hash % 2 === 0 ? 1 : -1) * latOffset;
    const longitude = 78.4860 + (hash % 2 === 0 ? 1 : -1) * lngOffset;
    return {
      latitude,
      longitude,
      status: 'APPROXIMATE'
    };
  }
}

// Extract coordinates from a Google Maps link using Regex patterns
export function extractCoordsFromGmapsLink(link: string): { latitude: number; longitude: number } | null {
  if (!link) return null;
  
  const regexes = [
    /@([0-9.-]+),([0-9.-]+)/,
    /q=([0-9.-]+),([0-9.-]+)/,
    /ll=([0-9.-]+),([0-9.-]+)/,
    /!3d([0-9.-]+)!4d([0-9.-]+)/
  ];
  
  for (const regex of regexes) {
    const match = link.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
    }
  }
  return null;
}

// Simple Haversine distance calculator
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

async function resolveShortUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location) {
        return location;
      }
    }
    const getRes = await fetch(url, { method: 'GET', redirect: 'follow' });
    return getRes.url;
  } catch (err) {
    console.error('Error resolving short URL:', err);
    return url;
  }
}

// Central geocode function exposing pluggable Providers fallback sequence
export async function geocode(address: string, googleMapsLink?: string): Promise<{ latitude: number; longitude: number; status: string }> {
  let resolvedLink = googleMapsLink || '';
  if (resolvedLink && (resolvedLink.includes('maps.app.goo.gl') || resolvedLink.includes('goo.gl/maps'))) {
    resolvedLink = await resolveShortUrl(resolvedLink);
  }

  // Priority 1: Extract coordinates from maps link if present
  if (resolvedLink) {
    const linkCoords = extractCoordsFromGmapsLink(resolvedLink);
    if (linkCoords) {
      // For maps link, check consistency with Nominatim address lookup if possible
      const providers = [new GoogleMapsProvider(), new NominatimProvider()];
      let addressCoords = null;
      
      for (const p of providers) {
        addressCoords = await p.geocode(address);
        if (addressCoords) break;
      }
      
      let status = 'VERIFIED';
      if (addressCoords) {
        const distance = getDistanceInMeters(linkCoords.latitude, linkCoords.longitude, addressCoords.latitude, addressCoords.longitude);
        if (distance > 2000) { // Discrepancy > 2km requires review
          status = 'MANUAL_REVIEW_REQUIRED';
        }
      }
      return {
        latitude: linkCoords.latitude,
        longitude: linkCoords.longitude,
        status
      };
    }
  }

  // Priority 2: PLuggable providers sequential search
  const providers: GeocodingProvider[] = [
    new GoogleMapsProvider(),
    new NominatimProvider(),
    new DeterministicProvider()
  ];

  for (const provider of providers) {
    const coords = await provider.geocode(address);
    if (coords) {
      return coords;
    }
  }

  return {
    latitude: 17.3850,
    longitude: 78.4860,
    status: 'MANUAL_REVIEW_REQUIRED'
  };
}
