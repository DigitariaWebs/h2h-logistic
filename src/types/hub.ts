// 🔴 LA LISTE A DÉMÉNAGÉ DANS `constants/HubTypes.ts`, et elle a doublé.
// Elle ne couvrait que les sept types des vingt-cinq hubs inventés ; l'enum
// `public.hub_type` en porte treize — dont **`domicile`**, le type qu'auront
// les vrais points relais, puisque les hubs sont recrutés auprès de gens qui se
// portent candidats. Le premier hub réel aurait rendu une icône `undefined`.
export type { HubType } from '@/constants/HubTypes';
import type { HubType } from '@/constants/HubTypes';

export interface Hub {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  type: HubType;
  openingHours: string;
  phone?: string;
  image?: string;
  availablePackages?: number; // For e-commerce partners: packages waiting
  /** Meeting-zone diameter in metres. Default applied where read (60). */
  zoneDiameterMeters?: number;
  /** Label for the point central. Default « Entrée principale côté parking ». */
  centralPointLabel?: string;
}
