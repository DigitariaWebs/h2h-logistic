// LES POINTS RELAIS — ceux qui existent vraiment.
//
// 🔴 CE QUE ÇA REMPLACE, ET C'EST LE POINT DE TOUTE LA TRANCHE.
// `services/mock/hubs.ts` déclare VINGT-CINQ hubs : gares, gares routières,
// centres commerciaux, lockers, de Nice à Marseille. Aucun n'existe. Leurs
// identifiants (`hub-nice-gare`) ne sont même pas des uuid — ils ne peuvent
// donc pas être écrits dans `published_routes.departure_hub_id`, qui référence
// `public.hubs`.
//
// **`public.hubs` contient ZÉRO ligne en production**, et ce n'est pas un
// oubli : les hubs ne sont pas des lieux qu'on choisit, ce sont des gens qui se
// portent candidats. Le recrutement se fait au lancement, par
// `candidater_hub()` puis `trancher_candidature_hub()` côté support.
//
// ⚠️ CONSÉQUENCE ASSUMÉE : l'assistant de publication affichera une liste VIDE
// tant que personne n'aura été recruté. C'est la vérité, et elle vaut mieux que
// vingt-cinq adresses inventées qu'un cotransporteur particulier irait chercher
// sur place.
import { supabase } from '@/lib/supabase';
import type { Hub, HubType } from '@/types/hub';

type Ligne = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  hub_type: HubType;
  operating_hours: string | null;
  phone: string | null;
  capacity: number | null;
  current_load: number | null;
};

const CHAMPS = 'id, name, address, city, hub_type, operating_hours, phone, capacity, current_load';

/**
 * ⚠️ LES COORDONNÉES NE SONT PAS ENCORE LUES. `hubs.geo` est une `geography`
 * PostGIS, que PostgREST rend en WKB hexadécimal — inexploitable tel quel côté
 * client. Les écrans qui ont besoin d'un point (la zone de présence, la
 * navigation) le liront par une RPC dédiée quand ils seront branchés ; d'ici là
 * mieux vaut ne rien rendre que rendre une valeur fausse.
 */
const versHub = (l: Ligne): Hub => ({
  id: l.id,
  name: l.name,
  address: l.address ?? '',
  city: l.city ?? '',
  latitude: 0,
  longitude: 0,
  type: l.hub_type,
  openingHours: l.operating_hours ?? '',
  phone: l.phone ?? undefined,
  availablePackages:
    l.capacity != null && l.current_load != null
      ? Math.max(0, l.capacity - l.current_load)
      : undefined,
});

/** Tous les points relais actifs. */
export async function chargerHubs(): Promise<Hub[]> {
  const { data, error } = await supabase
    .from('hubs')
    .select(CHAMPS)
    .eq('status', 'active')
    .order('city', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Ligne[]).map(versHub);
}

/**
 * Les points relais d'une ville.
 *
 * ⚠️ RECHERCHE INSENSIBLE À LA CASSE ET AUX ESPACES : la ville vient d'une
 * liste déroulante côté app et d'une saisie libre côté candidature. « nice » et
 * « Nice » désignent la même ville, et un cotransporteur qui ne voit pas son
 * point relais conclut qu'il n'y en a pas.
 */
export async function chargerHubsParVille(ville: string): Promise<Hub[]> {
  const v = ville.trim();
  if (!v) return [];
  const { data, error } = await supabase
    .from('hubs')
    .select(CHAMPS)
    .eq('status', 'active')
    .ilike('city', v)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Ligne[]).map(versHub);
}
