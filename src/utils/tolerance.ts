import dayjs from 'dayjs';

export const DEFAULT_TOLERANCE_MINUTES = 10;

export function getToleranceWindow(
  scheduledTime: string,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): { start: string; end: string; isWithin: boolean } {
  const scheduled = dayjs(scheduledTime);
  const start = scheduled.subtract(toleranceMinutes, 'minute');
  const end = scheduled.add(toleranceMinutes, 'minute');
  const now = dayjs();

  return {
    start: start.format('HH:mm'),
    end: end.format('HH:mm'),
    isWithin: now.isAfter(start) && now.isBefore(end),
  };
}

export function formatToleranceLabel(toleranceMinutes = DEFAULT_TOLERANCE_MINUTES): string {
  return `-${toleranceMinutes} / +${toleranceMinutes} min`;
}

export function isWithinTolerance(
  scheduledTime: string,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): boolean {
  const scheduled = dayjs(scheduledTime);
  const now = dayjs();
  const diffMinutes = Math.abs(now.diff(scheduled, 'minute'));
  return diffMinutes <= toleranceMinutes;
}

/**
 * La tolérance est-elle ÉCOULÉE ? (au-delà de l'heure prévue + tolérance)
 *
 * 🔴 C'EST LA CONDITION QUI OUVRE LE SIGNALEMENT D'ABSENCE. Règle client du
 * 12/08/2026 : pendant le créneau, l'autre partie a le droit d'arriver — la
 * déclarer absente à la 3ᵉ minute est un signalement contre quelqu'un qui n'est
 * pas encore en retard. Ce n'est qu'après +10 que l'absence devient un fait.
 *
 * ⚠️ NE PAS CONFONDRE AVEC `!isWithinTolerance` : celui-ci est vrai AVANT le
 * créneau comme après. Ici seul l'APRÈS compte — sinon les signalements
 * s'ouvriraient la veille du rendez-vous.
 */
export function isAfterTolerance(
  scheduledTime: string,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
): boolean {
  return dayjs().diff(dayjs(scheduledTime), 'minute', true) > toleranceMinutes;
}
