"use client";

import { Button } from "@/app/src/components/ui/button";
import {
  pousserNoteAuCalendrier,
  retirerNoteDuCalendrier,
} from "@/lib/actionsCalendrier";
import { CalendarCheck, CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

// Ajout manuel d'un rendez-vous a Google Agenda.
//
// Visible pour TOUS: la frontiere Free/Premium porte sur l'automatisation, pas
// sur la fonctionnalite. En Premium le rendez-vous est deja pousse a la
// creation, et ce bouton sert alors a le retirer.
export default function BoutonCalendrier({
  id,
  dansAgenda,
}: {
  id: string;
  dansAgenda: boolean;
}) {
  const [enCours, setEnCours] = useState(false);

  const agir = async () => {
    if (enCours) return;
    setEnCours(true);

    const formData = new FormData();
    formData.set("id", id);

    try {
      if (dansAgenda) {
        await retirerNoteDuCalendrier(formData);
        toast.success("Retiré de votre agenda.", { autoClose: 2000 });
      } else {
        await pousserNoteAuCalendrier(formData);
        toast.success("Ajouté à votre agenda.", { autoClose: 2000 });
      }
    } catch (error) {
      // Le succes n'est JAMAIS annonce avant d'avoir le resultat: le bouton de
      // suppression de la v1 toastait "supprimee" sur onClick, et mentait quand
      // l'action echouait.
      toast.error(
        error instanceof Error ? error.message : "L'opération a échoué.",
        { autoClose: 6000 },
      );
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Button
      type="button"
      variant={dansAgenda ? "secondary" : "outline"}
      size="sm"
      onClick={agir}
      disabled={enCours}
      aria-busy={enCours}
      title={
        dansAgenda ? "Retirer de Google Agenda" : "Ajouter à Google Agenda"
      }
    >
      {enCours ? (
        <Loader2 className="w-4 animate-spin" />
      ) : dansAgenda ? (
        <CalendarCheck className="w-4" />
      ) : (
        <CalendarPlus className="w-4" />
      )}
      <span className="ml-2 hidden sm:inline">
        {dansAgenda ? "Dans l'agenda" : "Ajouter à l'agenda"}
      </span>
    </Button>
  );
}
