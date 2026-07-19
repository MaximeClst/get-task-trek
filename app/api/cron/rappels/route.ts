import { envoyerRappels } from "@/lib/rappels";
import { NextResponse } from "next/server";

// Ce handler est une URL PUBLIQUE. Sans authentification, n'importe qui
// pourrait la marteler et vider notre quota Resend -- ou, pire, deverser des
// e-mails sur nos utilisateurs.
//
// Vercel Cron envoie automatiquement `Authorization: Bearer $CRON_SECRET`
// des lors que la variable existe dans le projet.

export const dynamic = "force-dynamic";

// Marge pour l'envoi: le plafond de 100 taches par execution existe pour tenir
// dans cette duree.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;

  // Refuser quand le secret n'est pas configure, plutot que de laisser
  // l'endpoint ouvert. Un deploiement mal configure doit rater bruyamment, pas
  // devenir une passerelle d'envoi anonyme.
  if (!secret) {
    console.error("CRON_SECRET absent: endpoint de rappels desactive.");
    return NextResponse.json({ error: "Non configuré" }, { status: 503 });
  }

  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const resultat = await envoyerRappels();

    // 200 meme s'il y a eu des echecs individuels: les taches concernees ont
    // ete relachees et repartiront au tour suivant. Repondre en erreur ferait
    // rejouer TOUTE l'execution par Vercel, y compris ce qui a reussi.
    return NextResponse.json(resultat);
  } catch (error) {
    // Ici, en revanche, rien n'a pu tourner (base injoignable): un 500 est
    // honnete, et le prochain passage horaire reprendra.
    console.error("Cron de rappels en echec :", error);
    return NextResponse.json({ error: "Échec du cron" }, { status: 500 });
  }
}
