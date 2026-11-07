import type { GeoLocation } from '@/core/types';

// Approximate city-centre coordinates used only as test inputs. Tests never
// assert expected panchang values for them; they check internal consistency.
export const MONTREAL: GeoLocation = { name: 'Montreal', latitude: 45.5017, longitude: -73.5673, timezone: 'America/Toronto' };
export const TORONTO: GeoLocation = { name: 'Toronto', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto' };
export const VANCOUVER: GeoLocation = { name: 'Vancouver', latitude: 49.2827, longitude: -123.1207, timezone: 'America/Vancouver' };
export const DELHI: GeoLocation = { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };
export const LONDON: GeoLocation = { name: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };
export const SYDNEY: GeoLocation = { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' };
export const TROMSO: GeoLocation = { name: 'Tromsø', latitude: 69.6492, longitude: 18.9553, timezone: 'Europe/Oslo' };

export const MID_LATITUDE_CITIES = [MONTREAL, TORONTO, VANCOUVER, DELHI, LONDON, SYDNEY];
