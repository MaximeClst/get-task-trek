// Garde-fous de la dictee. Volontairement hors d'un fichier "use server":
// ce module n'exporte que des constantes, partagees client et serveur.
//
// Whisper est le SEUL appel IA du tier gratuit, et il est facture (~0,006 $/min).
// C'est donc le seul endroit ou un compte qui ne rapporte rien peut nous couter
// de l'argent -- et comme on ne peut pas empecher quelqu'un d'ouvrir plusieurs
// comptes Google, la limite doit tenir sur la DUREE et la FREQUENCE, pas sur
// l'identite.

// 2 minutes: assez pour dicter une note ou trois, trop court pour y deverser un
// podcast. L'enregistreur s'arrete tout seul a cette limite.
export const MAX_RECORDING_SECONDS = 120;

// Plafond serveur, en octets. Du webm/opus tient largement sous 2 Mo pour deux
// minutes; on laisse de la marge pour les navigateurs plus bavards, mais on
// refuse tout ce qui n'a manifestement pas ete produit par l'enregistreur.
// La limite de duree cote client N'EST PAS une limite: le navigateur peut
// poster ce qu'il veut a cette route.
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

// Formats acceptes par Whisper, restreints a ce que MediaRecorder produit.
export const ACCEPTED_AUDIO_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
] as const;

// Whisper reconnait le format a l'extension du fichier envoye.
export function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}
