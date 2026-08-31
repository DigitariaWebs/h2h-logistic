/**
 * Navigation helper utilities for turn-by-turn guidance.
 */

import type { RouteStep } from '@/services/routing';
import type { IconName } from '@/components/ui/Icon';

export function getManeuverIcon(type: string, modifier?: string): IconName {
  switch (type) {
    case 'depart': return 'depart';
    case 'arrive': return 'arrival';
    case 'roundabout': case 'rotary': return 'roundabout';
    case 'merge': return 'merge';
    case 'fork': return modifier === 'left' ? 'turn-left' : 'turn-right';
    case 'end of road': return modifier === 'left' ? 'turn-left' : 'turn-right';
    case 'turn':
      if (modifier === 'left' || modifier === 'sharp left' || modifier === 'slight left') return 'turn-left';
      if (modifier === 'right' || modifier === 'sharp right' || modifier === 'slight right') return 'turn-right';
      return 'straight';
    case 'new name': case 'continue': return 'straight';
    default: return 'straight';
  }
}

export function getManeuverColor(type: string, modifier?: string): string {
  if (type === 'arrive') return '#007BA7';
  if (type === 'roundabout' || type === 'rotary') return '#F59E0B';
  if (modifier === 'straight' || type === 'continue' || type === 'new name') return '#10B981';
  return '#2A9CC4'; // blue for turns
}

export function getShortInstruction(step: RouteStep): string {
  if (step.maneuver.type === 'arrive') return 'Arrivée';
  if (step.maneuver.type === 'depart') return 'Départ';
  const m = step.maneuver.modifier;
  switch (step.maneuver.type) {
    case 'turn':
      if (m === 'left') return 'Tournez à gauche';
      if (m === 'right') return 'Tournez à droite';
      if (m === 'sharp left') return 'Virage serré à gauche';
      if (m === 'sharp right') return 'Virage serré à droite';
      if (m === 'slight left') return 'Légèrement à gauche';
      if (m === 'slight right') return 'Légèrement à droite';
      return 'Continuez tout droit';
    case 'roundabout': case 'rotary': return 'Rond-point';
    case 'fork': return m === 'left' ? 'Gardez la gauche' : 'Gardez la droite';
    case 'merge': return 'Insérez-vous';
    case 'end of road': return m === 'left' ? 'Tournez à gauche' : 'Tournez à droite';
    default: return 'Continuez';
  }
}

export function formatStepDistance(meters: number): string {
  if (meters < 100) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatArrivalTime(durationSeconds: number): string {
  const arrival = new Date(Date.now() + durationSeconds * 1000);
  return arrival.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function isNearManeuver(
  userLat: number, userLon: number,
  maneuverLocation: [number, number],
  thresholdMeters = 30,
): boolean {
  const [mLon, mLat] = maneuverLocation;
  return distanceBetween(userLat, userLon, mLat, mLon) <= thresholdMeters;
}

export function distanceBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if user is off-route by checking min distance to any point on the route polyline.
 */
export function isOffRoute(
  userLat: number, userLon: number,
  routeGeometry: [number, number][],
  thresholdMeters = 50,
): boolean {
  if (routeGeometry.length === 0) return false;
  let minDist = Infinity;
  for (const [lng, lat] of routeGeometry) {
    const d = distanceBetween(userLat, userLon, lat, lng);
    if (d < minDist) minDist = d;
    if (d < thresholdMeters) return false; // early exit
  }
  return minDist > thresholdMeters;
}

/**
 * Find the closest point index on a route geometry to the user.
 */
export function findClosestPointIndex(
  userLat: number, userLon: number,
  geometry: [number, number][],
): number {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < geometry.length; i++) {
    const [lng, lat] = geometry[i];
    const d = distanceBetween(userLat, userLon, lat, lng);
    if (d < minDist) { minDist = d; minIdx = i; }
  }
  return minIdx;
}
