// Quand deux lectures se croisent, c'est la PLUS RÉCENTE qui doit gagner.
//
// 🔴 CE QUE `charger()` FAISAIT. Le magasin des co-livraisons expose une seule
// méthode de rechargement, et NEUF endroits l'appellent : l'accueil au montage
// et au « tirer pour rafraîchir », l'onglet Co-livraisons au montage et au
// rafraîchissement, l'écran Messages, les écrans de récupération et de remise
// après chaque scan, et `accepterMission` / `refuserMission` juste après leur
// aller-retour serveur.
//
//     charger: async () => {
//       set({ isLoading: true });
//       const missions = await chargerMissions();
//       set({ ...repartir(missions), missions });   // <-- sans condition
//     }
//
// Rien ne dit laquelle des réponses est la plus fraîche. Deux appels qui se
// chevauchent s'écrivent l'un sur l'autre dans l'ordre où le RÉSEAU répond, pas
// dans l'ordre où on les a demandés. La dernière réponse arrivée gagne, même si
// elle a été demandée en premier.
//
// ⚠️ LE CAS QUI COÛTE LE PLUS CHER N'EST PAS L'AFFICHAGE, C'EST LE SCAN.
// `mission/pickup` recharge après avoir enregistré une remise ; si une lecture
// partie plus tôt revient après, elle réécrit l'état d'AVANT le scan. Le
// cotransporteur voit son colis redevenir « à récupérer » alors que le serveur,
// lui, sait qu'il l'a pris.
//
// ⚠️ ET C'EST INVISIBLE À LA RELECTURE : chaque appel pris isolément est
// correct. Le défaut n'existe qu'entre deux appels, et seulement quand le
// réseau les désordonne — donc rarement en local, et sur un téléphone en
// mobilité tout le temps.

/**
 * Un compteur de fraîcheur pour une lecture asynchrone partagée.
 *
 * ⚠️ ON N'ANNULE PAS LA REQUÊTE, ON IGNORE SA RÉPONSE. Annuler demanderait un
 * `AbortController` traversant le service et le client Supabase ; ignorer suffit
 * — ce qu'on veut éviter n'est pas le trafic, c'est l'ÉCRITURE d'un état périmé.
 */
export function sequenceur() {
  let dernier = 0;
  return {
    /** À appeler au DÉBUT de la lecture ; rend le jeton de cette lecture-ci. */
    demarrer: (): number => {
      dernier += 1;
      return dernier;
    },
    /**
     * Vrai si une lecture plus récente a été démarrée depuis.
     *
     * 🔴 À TESTER AVANT CHAQUE `set`, y compris dans le `catch` : une erreur
     * venue d'une vieille requête effacerait sinon le résultat d'une requête
     * plus récente qui, elle, a réussi.
     */
    estPerimee: (jeton: number): boolean => jeton !== dernier,
  };
}
