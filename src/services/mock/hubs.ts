import type { Hub, HubType } from '@/types/hub';

export const mockHubs: Hub[] = [
  // ─── Nice ───
  { id: 'hub-nice-gare', name: 'Gare de Nice-Ville', address: 'Avenue Thiers', city: 'Nice', latitude: 43.7046, longitude: 7.2620, type: 'gare', openingHours: 'Lun-Dim 5h-0h30', phone: '+33 4 93 12 34 56', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-nice-routiere', name: 'Gare routière Nice', address: '5 Boulevard Jean Jaurès', city: 'Nice', latitude: 43.7035, longitude: 7.2615, type: 'bus_station', openingHours: 'Lun-Dim 6h-21h', phone: '+33 4 93 85 61 81', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-nice-tnt', name: 'TNT Centre Nice', address: '12 Rue de France', city: 'Nice', latitude: 43.6947, longitude: 7.2659, type: 'partner_shop', openingHours: 'Lun-Sam 9h-19h', phone: '+33 4 93 22 33 44', availablePackages: 8, zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-nice-etoile', name: 'Nice Étoile', address: '30 Avenue Jean Médecin', city: 'Nice', latitude: 43.7010, longitude: 7.2700, type: 'shopping_center', openingHours: 'Lun-Sam 10h-19h30', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-nice-locker', name: 'Locker Nice Gare', address: 'Parvis de la Gare', city: 'Nice', latitude: 43.7050, longitude: 7.2625, type: 'locker', openingHours: '24h/24', zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Cannes ───
  { id: 'hub-cannes-gare', name: 'Gare de Cannes', address: 'Rue Jean Jaurès', city: 'Cannes', latitude: 43.5524, longitude: 7.0170, type: 'gare', openingHours: 'Lun-Dim 5h30-23h', phone: '+33 4 93 39 12 34', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-cannes-routiere', name: 'Gare routière Cannes', address: 'Place de l\'Hôtel de Ville', city: 'Cannes', latitude: 43.5518, longitude: 7.0130, type: 'bus_station', openingHours: 'Lun-Dim 6h-20h30', zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-cannes-palais', name: 'Relais Palais des Festivals', address: '1 Bd de la Croisette', city: 'Cannes', latitude: 43.5513, longitude: 7.0128, type: 'partner_shop', openingHours: 'Lun-Sam 9h-18h30', availablePackages: 3, zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Marseille ───
  { id: 'hub-mrs-gare', name: 'Gare Saint-Charles', address: 'Square Narvik', city: 'Marseille', latitude: 43.3026, longitude: 5.3806, type: 'gare', openingHours: 'Lun-Dim 4h30-1h', phone: '+33 4 91 08 16 40', zoneDiameterMeters: 80, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-mrs-routiere', name: 'Gare routière Saint-Charles', address: 'Place Victor Hugo', city: 'Marseille', latitude: 43.3020, longitude: 5.3815, type: 'bus_station', openingHours: 'Lun-Dim 5h-23h', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-mrs-vp', name: 'Point Relais Vieux-Port', address: '23 Quai du Port', city: 'Marseille', latitude: 43.2965, longitude: 5.3698, type: 'partner_shop', openingHours: 'Lun-Sam 9h-18h30', phone: '+33 4 91 54 12 34', availablePackages: 12, zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-mrs-valentines', name: 'CC Les Valentines', address: 'ZAC La Valentine', city: 'Marseille', latitude: 43.3100, longitude: 5.4780, type: 'shopping_center', openingHours: 'Lun-Sam 9h30-20h', zoneDiameterMeters: 80, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-mrs-locker', name: 'Locker Prado', address: 'Rond-Point du Prado', city: 'Marseille', latitude: 43.2750, longitude: 5.3900, type: 'locker', openingHours: '24h/24', zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Toulon ───
  { id: 'hub-toulon-gare', name: 'Gare de Toulon', address: 'Place de l\'Europe', city: 'Toulon', latitude: 43.1285, longitude: 5.9300, type: 'gare', openingHours: 'Lun-Dim 5h-23h', phone: '+33 4 94 46 35 00', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-toulon-centre', name: 'Relais Centre Toulon', address: '8 Rue Hoche', city: 'Toulon', latitude: 43.1242, longitude: 5.9280, type: 'partner_shop', openingHours: 'Lun-Sam 9h-19h', availablePackages: 5, zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-toulon-a57', name: 'Point Relais Sortie A57', address: 'ZC La Valette', city: 'Toulon', latitude: 43.1420, longitude: 5.9820, type: 'highway_exit', openingHours: 'Lun-Sam 8h-20h', zoneDiameterMeters: 80, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Antibes ───
  { id: 'hub-antibes-gare', name: 'Gare d\'Antibes', address: 'Place Pierre Semard', city: 'Antibes', latitude: 43.5844, longitude: 7.1197, type: 'gare', openingHours: 'Lun-Dim 5h30-22h30', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-antibes-relais', name: 'Relais Antibes Centre', address: '15 Cours Masséna', city: 'Antibes', latitude: 43.5805, longitude: 7.1256, type: 'partner_shop', openingHours: 'Lun-Sam 8h30-19h', availablePackages: 4, zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Fréjus ───
  { id: 'hub-frejus-routiere', name: 'Gare routière Fréjus', address: 'Place Paul Vernet', city: 'Fréjus', latitude: 43.4332, longitude: 6.7370, type: 'bus_station', openingHours: 'Lun-Sam 7h-19h', zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-frejus-a8', name: 'Relais Sortie A8 Fréjus', address: 'ZC Fréjus Sud', city: 'Fréjus', latitude: 43.4200, longitude: 6.7500, type: 'highway_exit', openingHours: 'Lun-Sam 7h-21h', zoneDiameterMeters: 80, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Monaco ───
  { id: 'hub-monaco-gare', name: 'Gare de Monaco', address: 'Place Sainte-Dévote', city: 'Monaco', latitude: 43.7384, longitude: 7.4200, type: 'gare', openingHours: 'Lun-Dim 5h30-0h', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-monaco-fontvieille', name: 'CC Fontvieille', address: 'Centre Commercial Fontvieille', city: 'Monaco', latitude: 43.7270, longitude: 7.4145, type: 'shopping_center', openingHours: 'Lun-Sam 10h-19h', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
  { id: 'hub-monaco-locker', name: 'Locker Monaco Gare', address: 'Parvis de la Gare', city: 'Monaco', latitude: 43.7380, longitude: 7.4195, type: 'locker', openingHours: '24h/24', zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Menton ───
  { id: 'hub-menton-gare', name: 'Gare de Menton', address: 'Rue de la Gare', city: 'Menton', latitude: 43.7765, longitude: 7.5002, type: 'gare', openingHours: 'Lun-Dim 6h-22h', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Grasse ───
  { id: 'hub-grasse-routiere', name: 'Gare routière Grasse', address: 'Place de la Buanderie', city: 'Grasse', latitude: 43.6594, longitude: 6.9225, type: 'bus_station', openingHours: 'Lun-Sam 7h-19h', zoneDiameterMeters: 40, centralPointLabel: 'Entrée principale côté parking' },

  // ─── Saint-Raphaël ───
  { id: 'hub-straph-gare', name: 'Gare de Saint-Raphaël', address: 'Rue Waldeck-Rousseau', city: 'Saint-Raphaël', latitude: 43.4251, longitude: 6.7682, type: 'gare', openingHours: 'Lun-Dim 5h30-23h', zoneDiameterMeters: 60, centralPointLabel: 'Entrée principale côté parking' },
];

export function getHubsByCity(city: string): Hub[] {
  // Exclude e-commerce partner shops — out of scope for C2C cotransportage.
  return mockHubs.filter(
    (h) => h.city.toLowerCase() === city.toLowerCase() && h.type !== 'partner_shop',
  );
}

import type { IconName } from '@/components/ui/Icon';

