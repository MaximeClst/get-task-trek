import { Resend } from "resend";

// Client Resend construit A LA DEMANDE, et surtout pas au chargement du module.
//
// `new Resend(undefined)` LEVE ("Missing API key"). Comme le build de Next
// evalue les modules d'une route pour en collecter les metadonnees, un client
// cree au niveau du module faisait echouer `next build` sur toute machine sans
// RESEND_API_KEY -- CI et Vercel compris. Constate, pas suppose.
//
// L'initialisation paresseuse deplace l'erreur la ou elle a un sens: au moment
// d'envoyer, ou elle est rattrapee, journalisee, et ou la tache est relachee
// pour repartir au tour suivant.
let client: Resend | null = null;

export function getResend(): Resend {
  if (!client) {
    const cle = process.env.RESEND_API_KEY;
    if (!cle) {
      throw new Error("RESEND_API_KEY n'est pas configure.");
    }
    client = new Resend(cle);
  }

  return client;
}
