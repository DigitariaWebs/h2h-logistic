// LES TYPES DE POINT RELAIS — tous ceux que la base peut rendre.
//
// 🔴 L'APPLICATION EN CONNAISSAIT SEPT, LA BASE EN A TREIZE. `HubType` couvrait
// `gare`, `bus_station`, `highway_exit`, `shopping_center`, `partner_shop`,
// `locker`, `relay_point` — parce que c'était exactement la liste des vingt-cinq
// hubs inventés de `services/mock/hubs.ts`. L'enum `public.hub_type` porte en
// plus `mall`, `train`, `bus`, `highway`, `ecommerce` et **`domicile`**.
//
// 🔴 ET `domicile` EST CELUI QUI COMPTE : c'est le type ajouté pour le
// recrutement des hubs, donc **le type qu'auront les vrais points relais**. Un
// `HUB_TYPE_ICON_NAMES[hub.type]` sur un hub recruté rendait `undefined` — une
// icône vide, ou un plantage selon le composant. Le premier hub réel de la
// plateforme aurait cassé l'écran qui devait l'afficher.
//
// ⚠️ QUATRE PAIRES SONT DES DOUBLONS DANS L'ENUM, et c'est connu :
// `gare`/`train`, `bus_station`/`bus`, `highway_exit`/`highway`,
// `shopping_center`/`mall`. On les traite pareil ici plutôt que de choisir : ce
// serait une décision de schéma, pas d'affichage.
import type { IconName } from '@/components/ui/Icon';

/** Toutes les valeurs de `public.hub_type`. */
export type HubType =
  | 'gare' | 'bus_station' | 'highway_exit' | 'shopping_center'
  | 'partner_shop' | 'locker' | 'relay_point'
  | 'mall' | 'train' | 'bus' | 'highway' | 'ecommerce' | 'domicile';

const ICONES: Record<HubType, IconName> = {
  gare: 'hub-gare',
  train: 'hub-gare',
  bus_station: 'hub-bus',
  bus: 'hub-bus',
  highway_exit: 'hub-highway',
  highway: 'hub-highway',
  shopping_center: 'hub-shopping',
  mall: 'hub-shopping',
  partner_shop: 'hub-partner',
  ecommerce: 'hub-partner',
  locker: 'hub-locker',
  relay_point: 'hub-relay',
  domicile: 'hub-relay',
};

const LIBELLES: Record<HubType, string> = {
  gare: 'Gare',
  train: 'Gare',
  bus_station: 'Gare routière',
  bus: 'Gare routière',
  highway_exit: 'Sortie autoroute',
  highway: 'Sortie autoroute',
  shopping_center: 'Centre commercial',
  mall: 'Centre commercial',
  partner_shop: 'Partenaire e-commerce',
  ecommerce: 'Partenaire e-commerce',
  locker: 'Locker automatique',
  relay_point: 'Point relais',
  domicile: 'Point relais à domicile',
};

/**
 * ⚠️ DES FONCTIONS, PAS DES OBJETS EXPOSÉS. Une valeur ajoutée à l'enum côté
 * base — c'est déjà arrivé avec `domicile` — rendrait `undefined` sur un accès
 * direct, sans que rien ne le signale. Ici le repli est explicite : un point
 * relais s'affiche, même si son type est plus récent que l'application.
 */
export const iconeHub = (t: string): IconName => ICONES[t as HubType] ?? 'hub-relay';
export const libelleHub = (t: string): string => LIBELLES[t as HubType] ?? 'Point relais';
