// L'identité passe par Clerk, le profil vit dans Supabase.
//
// 🔴 CE QU'IL Y AVAIT AVANT, ET CE QUE ÇA VALAIT. `verifyOTP()` acceptait
// N'IMPORTE QUEL code à six chiffres. Deux portes dérobées ouvraient un compte
// entièrement vérifié — `code === '000000'`, et un numéro de téléphone en dur
// (`+330642799884`) — avec `documentsVerified: true`, un IBAN factice et
// cinquante-deux livraisons au compteur. `validateAccount()` posait le badge de
// vérification depuis le téléphone, et l'écran d'attente l'appelait tout seul au
// bout de quatre secondes.
//
// Autrement dit : l'application entière était accessible à qui tapait six
// chiffres, et le badge « pièces vérifiées » s'auto-attribuait.
//
// ⚠️ CE FICHIER EST LE SEUL À AVOIR CHANGÉ EN PROFONDEUR. Les écrans de `(auth)`
// appellent les mêmes méthodes qu'avant — `sendOTP`, `verifyOTP`,
// `completeProfile`, `logout` — avec les mêmes signatures. Le dessin n'est pas
// touché : seule la plomberie dessous est réelle. C'est la même règle que sur la
// place de marché, et pour la même raison : les écrans sont validés, on n'y
// touche pas.
//
// 🔴 LE CANAL EST L'E-MAIL, PAS LE SMS. L'instance Clerk est PARTAGÉE avec la
// place de marché — elle doit l'être, `app.uid()` traduisant le `sub` du jeton
// en `profiles.auth_user_id` : une seconde application Clerk frapperait des
// sujets d'un autre espace et TOUTES les policies échoueraient en silence. Or
// cette instance n'accepte pas les numéros français. `phone.tsx` reste en place
// mais dormant, exactement comme sur la place de marché.
//
// ⚠️ `documentsVerified` NE S'ÉCRIT PLUS D'ICI. Il se LIT depuis
// `user_roles.status = 'active'`, que seul le support pose via `trancher_role()`.
// C'est tout l'objet de la migration `20260822230000`.
import { create } from 'zustand';
import type { TransporterProfile, ProfileData, ConventionAcceptance } from '@/types/user';
import { storage, StorageKeys, getStoredJSON, setStoredJSON } from '@/services/storage';
import { requireClerk, peekClerk } from '@/lib/clerkBridge';
import { supabase } from '@/lib/supabase';
import { chargerMaConvention, signerConvention } from '@/services/convention';

type TransporterStatus = 'active' | 'offline';

interface AuthState {
  user: TransporterProfile | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isLoading: boolean;
  token: string | null;
  isNewUser: boolean;
  transporterStatus: TransporterStatus;
  /** L'identifiant en cours de vérification. Le nom reste `phoneNumber` : les
   *  écrans n'ont pas à savoir par quel canal part le code. */
  phoneNumber: string | null;

  hydrate: () => Promise<void>;
  setOnboarded: (value: boolean) => void;
  sendOTP: (identifiant: string) => Promise<void>;
  verifyOTP: (code: string) => Promise<boolean>;
  completeProfile: (data: ProfileData) => Promise<void>;
  /** Relit le profil et l'état du rôle depuis la base. */
  rafraichir: () => Promise<void>;
  /**
   * Signe la convention : le tracé part dans le stockage, l'acceptation en base.
   *
   * 🔴 IL N'Y A PLUS DE `saveIban`. On ne demande plus de coordonnées
   * bancaires du tout — le compte de versement s'ouvrira chez Stripe, sur sa
   * page hébergée, comme pour un vendeur de la place de marché. L'IBAN
   * traînait jusqu'ici EN CLAIR dans AsyncStorage : on retire le besoin plutôt
   * que de protéger le secret.
   */
  signerLaConvention: (input: {
    representant: string;
    trace: string;
    prelevementAutorise: boolean;
  }) => Promise<void>;
  setTransporterStatus: (status: TransporterStatus) => void;
  toggleOnline: () => void;
  logout: () => Promise<void>;
}

/** La ligne `profiles` telle que la rend `ensure_profile()`. */
type ProfilRow = {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
};

/** Une ligne `user_roles`, pour savoir où en est la demande. */
type RoleRow = { role: string; status: string };

/**
 * Le profil courant, créé au premier passage puis relu.
 *
 * 🔴 `ensure_profile()` DOIT ÊTRE APPELÉE EN PREMIER. Entre l'inscription chez
 * Clerk et le premier appel, `app.uid()` rend NULL et TOUTE policy refuse en
 * silence — un écran vide sans message d'erreur.
 */
async function chargerProfil(): Promise<{
  profil: ProfilRow;
  roles: RoleRow[];
  convention: ConventionAcceptance | null;
}> {
  const { data, error } = await supabase.rpc('ensure_profile');
  if (error) throw new Error(error.message);
  const profil = (Array.isArray(data) ? data[0] : data) as ProfilRow | null;
  if (!profil) throw new Error('profil introuvable après authentification');

  // ⚠️ ON NE FILTRE PAS SUR SOI-MÊME : `user_roles_self_read` ne rend déjà que
  // les siens. Refiltrer dupliquerait la règle et finirait par en diverger.
  const { data: r, error: erreurRoles } = await supabase
    .from('user_roles')
    .select('role, status');
  if (erreurRoles) throw new Error(erreurRoles.message);

  // 🔴 LA CONVENTION VIENT DE LA BASE, PLUS D'ASYNCSTORAGE. Rangée localement,
  // elle disparaissait à la déconnexion et ne pouvait être produite par
  // personne d'autre que ce téléphone — c'est-à-dire jamais, au moment où un
  // litige la réclame.
  const convention = await chargerMaConvention();

  return { profil, roles: (r ?? []) as RoleRow[], convention };
}

/**
 * Le profil cotransporteur, assemblé depuis la base.
 *
 * ⚠️ `documentsVerified` VIENT DU RÔLE, PAS D'UNE COLONNE QU'ON ÉCRIT. C'est
 * `user_roles.status = 'active'` sur le rôle `transporter` — posé par le
 * support seul. La forme publique du type ne change pas : les écrans lisent
 * toujours `user.documentsVerified`.
 */
function versProfil(
  profil: ProfilRow,
  roles: RoleRow[],
  precedent: TransporterProfile | null,
  convention: ConventionAcceptance | null = null,
): TransporterProfile {
  const roleTransporteur = roles.find((r) => r.role === 'transporter');
  return {
    id: profil.id,
    firstName: profil.first_name ?? '',
    lastName: profil.last_name ?? '',
    phone: profil.phone ?? '',
    email: profil.email ?? undefined,
    avatar: profil.avatar_url ?? undefined,
    role: 'transporter',
    isVerified: roleTransporteur?.status === 'active',
    isOnline: precedent?.isOnline ?? false,
    rating: precedent?.rating ?? 5.0,
    totalDeliveries: precedent?.totalDeliveries ?? 0,
    createdAt: precedent?.createdAt ?? new Date().toISOString(),
    transportTypes: precedent?.transportTypes ?? [],
    favoriteHubs: precedent?.favoriteHubs ?? [],
    documentsVerified: roleTransporteur?.status === 'active',
    city: profil.city ?? undefined,
    convention: convention ?? precedent?.convention,
  };
}

/**
 * Le flux en cours. Clerk sépare l'inscription de la connexion : on ne sait
 * qu'après le premier appel si l'adresse est connue. On mémorise donc lequel
 * des deux attend le code.
 */
let fluxCourant: 'sign-in' | 'sign-up' | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isOnboarded: false,
  isLoading: false,
  token: null,
  isNewUser: true,
  transporterStatus: 'offline',
  phoneNumber: null,

  /**
   * Reprend la session Clerk déjà en cache et relit le profil.
   *
   * 🔴 CLERK GARDE LA SESSION DANS LE TROUSSEAU, PAS ZUSTAND. Après un
   * redémarrage on EST connecté côté Clerk, mais le store repart vide : sans
   * cette relecture, l'application se croirait déconnectée alors que la session
   * est valide.
   */
  hydrate: async () => {
    await storage.ready();
    const isOnboarded = storage.getBoolean(StorageKeys.IS_ONBOARDED) ?? false;
    const transporterStatus =
      (storage.getString(StorageKeys.TRANSPORTER_STATUS) as TransporterStatus) ?? 'offline';
    set({ isOnboarded, transporterStatus });

    const clerk = peekClerk();
    if (!clerk?.session) {
      set({ user: null, isAuthenticated: false, token: null });
      return;
    }
    try {
      const { profil, roles, convention } = await chargerProfil();
      const precedent = getStoredJSON<TransporterProfile>(StorageKeys.USER);
      const user = versProfil(profil, roles, precedent, convention);
      setStoredJSON(StorageKeys.USER, user);
      set({
        user,
        isAuthenticated: true,
        token: (await clerk.session.getToken()) ?? null,
        // ⚠️ « NOUVEAU » = LE PROFIL N'A PAS ENCORE DE PRÉNOM. Ce n'est pas un
        // drapeau de Clerk : c'est ce qui décide d'aller à complete-profile.
        isNewUser: !user.firstName,
      });
    } catch (e) {
      // ⚠️ UNE REPRISE QUI ÉCHOUE NE DOIT PAS EMPÊCHER L'APPLICATION DE
      // DÉMARRER : on retombe sur l'écran de connexion.
      console.error('[auth] reprise de session impossible', e);
      set({ user: null, isAuthenticated: false, token: null });
    }
  },

  setOnboarded: (value) => {
    storage.set(StorageKeys.IS_ONBOARDED, value);
    set({ isOnboarded: value });
  },

  /**
   * Envoie le code. `identifiant` est une ADRESSE E-MAIL — voir l'en-tête.
   *
   * ⚠️ ON SE DÉCONNECTE D'ABORD SI UNE SESSION TRAÎNE. Une session résiduelle
   * fait échouer `signIn.create()` avec « You're already signed in. », et le
   * bouton devient définitivement muet.
   */
  sendOTP: async (identifiant) => {
    set({ isLoading: true, phoneNumber: identifiant });
    storage.set(StorageKeys.PHONE_NUMBER, identifiant);
    try {
      const clerk = requireClerk();
      if (clerk.session) await clerk.signOut();
      try {
        // Adresse déjà connue → connexion. Clerk exige de désigner l'adresse à
        // vérifier : sans `emailAddressId`, `prepareFirstFactor` ne part pas.
        const si = await clerk.client!.signIn.create({ identifier: identifiant });
        const facteur = si.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
        if (!facteur) throw new Error('email_code indisponible pour ce compte');
        await si.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: (facteur as { emailAddressId: string }).emailAddressId,
        });
        fluxCourant = 'sign-in';
      } catch {
        // Sinon → inscription. Ce second échec, lui, remonte à l'écran.
        await clerk.client!.signUp.create({ emailAddress: identifiant });
        await clerk.client!.signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        fluxCourant = 'sign-up';
      }
      set({ isLoading: false });
    } catch (e) {
      fluxCourant = null;
      set({ isLoading: false });
      throw e;
    }
  },

  /**
   * Vérifie le code.
   *
   * 🔴 PLUS AUCUNE PORTE DÉROBÉE. Le code est vérifié par Clerk ; il n'existe
   * plus de valeur magique ni de numéro privilégié.
   */
  verifyOTP: async (code) => {
    set({ isLoading: true });
    try {
      const clerk = requireClerk();
      let sessionId: string | null | undefined;

      if (fluxCourant === 'sign-up') {
        const res = await clerk.client!.signUp.attemptEmailAddressVerification({ code });
        sessionId = res.createdSessionId;
      } else {
        const res = await clerk.client!.signIn.attemptFirstFactor({
          strategy: 'email_code',
          code,
        });
        sessionId = res.createdSessionId;
      }
      if (!sessionId) {
        set({ isLoading: false });
        return false;
      }
      await clerk.setActive({ session: sessionId });

      const { profil, roles, convention } = await chargerProfil();
      const user = versProfil(profil, roles, null, convention);
      setStoredJSON(StorageKeys.USER, user);
      storage.set(StorageKeys.IS_ONBOARDED, true);
      fluxCourant = null;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        isNewUser: !user.firstName,
        token: (await clerk.session?.getToken()) ?? null,
        phoneNumber: null,
      });
      return true;
    } catch (e) {
      console.error('[auth] verification du code impossible', e);
      set({ isLoading: false });
      return false;
    }
  },

  /**
   * Complète le profil, et demande le rôle.
   *
   * 🔴 C'EST ICI QUE `request_role('transporter')` EST APPELÉE, et c'est le
   * geste qui compte : sans elle, aucune ligne `user_roles` n'existe, donc rien
   * à examiner pour le support, donc le compte reste à l'écran d'attente pour
   * toujours. La demande naît en `pending_kyc` ; seul `trancher_role()` la
   * passe à `active`.
   */
  completeProfile: async (data) => {
    set({ isLoading: true });
    try {
      const courant = get().user;
      if (!courant) throw new Error('aucune session');

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
          city: data.city || null,
          avatar_url: data.avatar ?? null,
        })
        .eq('id', courant.id);
      if (error) throw new Error(error.message);

      const { error: erreurRole } = await supabase.rpc('request_role', {
        p_role: 'transporter',
      });
      if (erreurRole) throw new Error(erreurRole.message);

      const { profil, roles, convention } = await chargerProfil();
      const user = versProfil(profil, roles, {
        ...courant,
        transportTypes: [data.transportType],
      }, convention);
      setStoredJSON(StorageKeys.USER, user);
      set({ user, isAuthenticated: true, isNewUser: false, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  /**
   * Relit le profil et l'état du rôle.
   *
   * ⚠️ C'EST CE QUE L'ÉCRAN D'ATTENTE APPELLE, à la place du `setTimeout` de
   * quatre secondes qui s'auto-validait. La décision appartient au support ;
   * l'application ne fait que la constater.
   */
  rafraichir: async () => {
    if (!peekClerk()?.session) return;
    try {
      const { profil, roles, convention } = await chargerProfil();
      const user = versProfil(profil, roles, get().user, convention);
      setStoredJSON(StorageKeys.USER, user);
      set({ user, isAuthenticated: true });
    } catch (e) {
      console.error('[auth] rafraichissement impossible', e);
    }
  },

  signerLaConvention: async (input) => {
    set({ isLoading: true });
    try {
      const courant = get().user;
      if (!courant) throw new Error('aucune session');
      const signee = await signerConvention({
        profilId: courant.id,
        representant: input.representant,
        trace: input.trace,
        prelevementAutorise: input.prelevementAutorise,
      });
      const maj: TransporterProfile = { ...courant, convention: signee };
      setStoredJSON(StorageKeys.USER, maj);
      set({ user: maj, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  setTransporterStatus: (status) => {
    storage.set(StorageKeys.TRANSPORTER_STATUS, status);
    set((state) => ({
      transporterStatus: status,
      user: state.user ? { ...state.user, isOnline: status === 'active' } : null,
    }));
  },

  toggleOnline: () => {
    const courant = get().transporterStatus;
    get().setTransporterStatus(courant === 'active' ? 'offline' : 'active');
  },

  /**
   * ⚠️ ON NETTOIE L'ÉTAT LOCAL MÊME SI CLERK ÉCHOUE : laisser l'écran en
   * « connecté » après un « Se déconnecter » serait pire que l'erreur.
   */
  logout: async () => {
    try {
      await requireClerk().signOut();
    } catch (e) {
      console.error('[auth] deconnexion Clerk impossible', e);
    } finally {
      storage.remove(StorageKeys.AUTH_TOKEN);
      storage.remove(StorageKeys.USER);
      storage.remove(StorageKeys.TRANSPORTER_STATUS);
      storage.remove(StorageKeys.PHONE_NUMBER);
      storage.remove(StorageKeys.CONVENTION_ACCEPTANCE);
      // ⚠️ `IS_ONBOARDED` N'EST PLUS EFFACÉ. Revoir les quatre écrans
      // d'introduction après chaque déconnexion n'était pas un choix de
      // conception, c'était un effet de bord de la remise à zéro complète.
      fluxCourant = null;
      set({
        user: null,
        isAuthenticated: false,
        token: null,
        isNewUser: true,
        transporterStatus: 'offline',
        phoneNumber: null,
      });
    }
  },
}));
