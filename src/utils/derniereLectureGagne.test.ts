// DEUX LECTURES QUI SE CROISENT S'ÉCRIVAIENT L'UNE SUR L'AUTRE.
//
// 🔴 LE MAGASIN DES CO-LIVRAISONS N'A QU'UNE MÉTHODE DE RECHARGEMENT, ET NEUF
// ENDROITS L'APPELLENT : l'accueil au montage et au « tirer pour rafraîchir »,
// l'onglet Co-livraisons au montage et au rafraîchissement, l'écran Messages,
// les écrans de récupération et de remise après chaque scan, et
// `accepterMission` / `refuserMission` juste après leur aller-retour serveur.
//
//     charger: async () => {
//       set({ isLoading: true });
//       const missions = await chargerMissions();
//       set({ ...repartir(missions), missions });   // <-- sans condition
//     }
//
// Rien ne disait laquelle des réponses était la plus fraîche : deux appels qui
// se chevauchent s'écrivaient dans l'ordre où le RÉSEAU répond, pas dans celui
// où on les a demandés.
//
// ⚠️ LE CAS QUI COÛTE LE PLUS CHER N'EST PAS L'AFFICHAGE, C'EST LE SCAN.
// `mission/pickup` recharge après avoir enregistré une remise ; une lecture
// partie plus tôt et revenue après réécrivait l'état d'AVANT le scan — le
// cotransporteur voyait son colis redevenir « à récupérer » alors que le
// serveur savait qu'il l'avait pris.
//
// ⚠️ ET C'EST INVISIBLE À LA RELECTURE : chaque appel pris isolément est
// correct. Le défaut n'existe qu'ENTRE deux appels, et seulement quand le
// réseau les désordonne — donc presque jamais en local, et sur un téléphone en
// mobilité tout le temps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sequenceur } from './derniereLectureGagne';

// Les deux lignes que chaque magasin doit porter — en clair plutot qu'en
// expression reguliere : elles contiennent des parentheses, et une regex mal
// echappee passerait pour vraie sans rien verifier.
const JETON = 'const jeton = lectures.demarrer()';
const GARDE = 'if (lectures.estPerimee(jeton)) return;';

test('🔴 UNE RÉPONSE EN RETARD NE RÉÉCRIT PAS UNE PLUS RÉCENTE', () => {
  const s = sequenceur();

  // Deux lectures partent ; la seconde est demandee apres la premiere.
  const premiere = s.demarrer();
  const seconde = s.demarrer();

  // Le reseau les rend dans le DESORDRE : la seconde arrive d'abord.
  assert.equal(s.estPerimee(seconde), false, 'la lecture la plus recente est jugee perimee');
  // …puis la premiere, qui ne doit plus rien ecrire.
  assert.equal(
    s.estPerimee(premiere),
    true,
    'une reponse partie plus tot ecrase le resultat d une lecture plus recente',
  );
});

test('🔴 LA GARDE VAUT AUSSI POUR UN ÉCHEC TARDIF', () => {
  // 🔴 SANS ELLE, UNE ERREUR VENUE D'UNE VIEILLE REQUÊTE efface le succes d une
  // requete plus recente : l ecran affiche « Co-livraisons indisponibles » sur
  // une liste qui vient pourtant d arriver.
  const s = sequenceur();
  const vieille = s.demarrer();
  const fraiche = s.demarrer();

  assert.equal(s.estPerimee(fraiche), false);
  assert.equal(s.estPerimee(vieille), true, 'un echec tardif peut encore effacer un succes');
});

test('⚠️ UNE LECTURE SEULE N’EST JAMAIS PÉRIMÉE', () => {
  // Le cas normal — de loin le plus frequent — ne doit rien perdre.
  const s = sequenceur();
  const seule = s.demarrer();
  assert.equal(s.estPerimee(seule), false, 'une lecture unique est ignoree : plus rien ne s affiche');
});

test('⚠️ CHAQUE LECTURE REÇOIT UN JETON DISTINCT', () => {
  const s = sequenceur();
  const jetons = [s.demarrer(), s.demarrer(), s.demarrer()];
  assert.equal(new Set(jetons).size, 3, 'deux lectures partagent un jeton : l une masque l autre');
  // Seule la derniere reste valable.
  assert.deepEqual(jetons.map((j) => s.estPerimee(j)), [true, true, false]);
});

test('⚠️ DEUX SÉQUENCEURS SONT INDÉPENDANTS', () => {
  // Chaque magasin a le sien : les co-livraisons ne doivent pas perimer les
  // lectures d un autre ecran.
  const a = sequenceur();
  const b = sequenceur();
  const ja = a.demarrer();
  b.demarrer();
  b.demarrer();
  assert.equal(a.estPerimee(ja), false, 'un sequenceur en perime un autre');
});

test('🔴 LES TROIS MAGASINS QUI LISENT EN CONCURRENCE S’EN SERVENT', async () => {
  // ⚠️ TEST DE STRUCTURE, ET IL EST JUSTIFIÉ : la primitive peut etre parfaite
  // et le magasin ne pas s en servir — c etait exactement l etat d avant.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  // ⚠️ LES TROIS ONT LE MÊME DÉFAUT ET PLUSIEURS APPELANTS : co-livraisons (9),
  // participations (4), trajets (3). Une primitive parfaite dont un magasin ne
  // se sert pas ne repare rien — c etait exactement l etat d avant.
  for (const magasin of ['useMissionStore', 'useEarningsStore', 'useRouteStore']) {
    const code = readFileSync(join(process.cwd(), 'src', 'stores', magasin + '.ts'), 'utf8');
    assert.ok(
      code.includes(JETON),
      magasin + ' ne prend plus de jeton de fraicheur');
    assert.ok(
      code.split(GARDE).length - 1 >= 1,
      magasin + ' n a plus de garde : une reponse perimee peut ecrire',
    );
  }
});
