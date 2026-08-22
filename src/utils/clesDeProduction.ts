// Une build de production ne part pas avec des clés de test.
//
// 🔴 RECOPIÉ DE LA PLACE DE MARCHÉ (`hand-to-hand/src/utils/clesDeProduction.ts`),
// et c'est le prix assumé de deux dépôts séparés : ces quelques fichiers de
// plomberie existent en double. Le contrat partagé, lui, est la BASE — pas ce
// fichier. Si celui-ci diverge, on perd un garde-fou ; si la base divergeait, on
// perdrait les colis.
//
// ⚠️ CE QUI A ÉTÉ RETIRÉ À LA COPIE : `modeStripe()`. H2H Logistic n'embarque
// aucune clé Stripe — le versement du cotransporteur particulier passera par la
// fonction Edge `stripe-versement`, côté serveur. Recopier une fonction sans
// appelant serait exactement le défaut qu'on passe la semaine à refermer.
//
// ⚠️ ON RAISONNE SUR LE PRÉFIXE, PAS SUR LA LONGUEUR NI SUR L'INSTANCE. Clerk
// distingue ses environnements par `pk_test_` / `pk_live_` ; c'est la seule
// chose que l'on puisse vérifier hors ligne, et elle suffit.
export type CleNommee = readonly [nom: string, valeur: string];

/**
 * Les clés visiblement issues d'un environnement de test.
 *
 * ⚠️ UNE CLÉ VIDE N'EST PAS UNE CLÉ DE TEST. L'absence se traite ailleurs et
 * n'a pas les mêmes conséquences : Clerk manquant fait échouer le démarrage.
 * Ici on ne parle que du cas où une clé est bien présente mais désigne le
 * mauvais environnement.
 */
export function clesDeTest(cles: readonly CleNommee[]): string[] {
  return cles.filter(([, valeur]) => valeur.startsWith('pk_test_')).map(([nom]) => nom);
}

/**
 * Le message d'échec — il doit dire quoi faire, pas seulement ce qui cloche.
 *
 * ⚠️ IL RAPPELLE DE NE PAS « CORRIGER » `.env.local`. C'est le réflexe naturel
 * et c'est l'erreur : ce fichier doit rester sur les clés de test, sinon le
 * compte de démonstration cesse de fonctionner pour tout le monde le lendemain
 * matin.
 */
export function messageClesDeTest(noms: readonly string[]): string {
  return (
    `Build de production avec des clés de TEST : ${noms.join(', ')}.\n` +
    'Renseigner les clés `pk_live_` dans l’environnement de build ' +
    '(profil `production` de eas.json, ou variables du shell avant `gradlew assembleRelease`) — ' +
    'et laisser `.env.local` sur les clés de test.'
  );
}

/**
 * L'ERREUR MIROIR : une clé `pk_live_` dans une build de DÉVELOPPEMENT.
 *
 * 🔴 CONSTATÉE UNE FOIS SUR LA PLACE DE MARCHÉ, le 2026-08-21 : chaque
 * ouverture de l'application en développement s'authentifiait contre
 * l'instance RÉELLE. Ici la conséquence serait pire que là-bas : un
 * cotransporteur particulier d'essai se verrait proposer de VRAIS colis, avec
 * l'adresse de vraies personnes.
 *
 * ⚠️ UNE RÈGLE QUI NE PROTÈGE QUE DANS UN SENS laisse l'autre sens ouvert.
 */
export function clesLive(cles: readonly CleNommee[]): string[] {
  return cles.filter(([, valeur]) => valeur.startsWith('pk_live_')).map(([nom]) => nom);
}

/**
 * ⚠️ IL NOMME L'ÉCHAPPATOIRE. Refuser sans issue pousserait à retirer le
 * garde-fou, donc à le perdre. Une sortie explicite et cherchable vaut mieux
 * qu'une règle qu'on contourne.
 */
export function messageClesLive(noms: readonly string[]): string {
  return (
    `Build de DÉVELOPPEMENT avec des clés LIVE : ${noms.join(', ')}.\n` +
    'En développement, les comptes doivent rester fictifs : ' +
    'remettre `.env.local` sur les clés `pk_test_`.\n' +
    'Si l’intention est bien de viser le live depuis une build de développement, ' +
    'poser `EXPO_PUBLIC_AUTORISER_CLES_LIVE_EN_DEV=1`.'
  );
}
