// Le client Supabase, authentifié par Clerk.
//
// Il n'y a PAS de session Supabase Auth ici. Le jeton vient de Clerk, et
// Supabase le vérifie via l'intégration « third-party auth » (JWKS de
// awake-falcon-77.clerk.accounts.dev). Côté base, `app.uid()` traduit le
// `sub` Clerk (texte, « user_2… ») en UUID interne via profiles.auth_user_id.
//
// ⚠️ NE JAMAIS appeler supabase.auth.signIn*/signUp* : ces méthodes créeraient
// une identité Supabase parallèle à celle de Clerk, et deux identités pour la
// même personne, c'est deux profils — donc un cotransporteur qui ne peut plus
// acheter avec son compte.
import { createClient } from '@supabase/supabase-js';
import { peekClerk } from './clerkBridge';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const cle = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!url || !cle) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY manquants dans .env.local',
  );
}

export const supabase = createClient(url, cle, {
  auth: {
    // Rien à persister ni à rafraîchir : la session appartient à Clerk.
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  // Rappelé à CHAQUE requête. Clerk renouvelle le jeton tout seul (durée de
  // vie 60 s) ; on ne met donc rien en cache ici, sinon on enverrait un jeton
  // expiré et la requête repartirait en « anon » sans le dire.
  // 🔴 LE GABARIT « supabase » N'EST PAS UN DÉTAIL : SANS LUI, TOUT PASSE EN
  // « anon ». Supabase choisit le rôle Postgres d'après la revendication `role`
  // du jeton. Le jeton de session Clerk PAR DÉFAUT n'en porte aucune — la
  // requête est donc authentifiée (le `sub` arrive, `app.uid()` répond) mais
  // exécutée en `anon`.
  //
  // ⚠️ ET ÇA NE SE VOYAIT PAS. Tout ce que `anon` a le droit de lire — le
  // catalogue, les fiches, les profils publics — fonctionnait parfaitement.
  // Seules les fonctions réservées à `authenticated` échouaient, et la première
  // à l'être vraiment est `passer_commande` : « permission denied for function
  // passer_commande » au moment de payer, découvert à l'émulateur.
  //
  // ⚠️ ON NE MET TOUJOURS RIEN EN CACHE : Clerk renouvelle le jeton tout seul
  // (durée de vie 60 s). Un jeton gardé serait expiré, et la requête repartirait
  // en « anon » sans le dire.
  accessToken: async () => {
    const clerk = peekClerk();
    if (!clerk?.session) return null;
    return (await clerk.session.getToken({ template: 'supabase' })) ?? null;
  },
});
