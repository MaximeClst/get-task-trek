"use client";

import { Button } from "@/app/src/components/ui/button";
import { Label } from "@/app/src/components/ui/label";
import { Textarea } from "@/app/src/components/ui/textarea";
import { createCategory } from "@/lib/actionsCategories";
import { createNote } from "@/lib/actionsNotes";
import { trierTranscript } from "@/lib/actionsTri";
import { MAX_RECORDING_SECONDS } from "@/lib/transcription";
import { CONTENT_MAX, TITLE_MAX } from "@/lib/validationNotes";
import type { NoteType } from "@prisma/client";
import { Loader2, Mic, Sparkles, Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

type Categorie = { id: string; name: string };

type Etape = "pret" | "enregistre" | "transcrit" | "trie" | "relit";

// Valeur sentinelle du <select> quand Treky propose une categorie qui n'existe
// pas encore. Elle n'est jamais envoyee telle quelle: la categorie est creee au
// moment de valider, et c'est son vrai identifiant qui part avec la note.
const NOUVELLE_CATEGORIE = "__nouvelle__";

// MediaRecorder ne produit pas le meme format partout: Chrome/Firefox font du
// webm, Safari du mp4. On demande le premier format supporte plutot que d'en
// imposer un que le navigateur refuserait.
function formatSupporte(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidats = ["audio/webm", "audio/mp4", "audio/ogg"];
  return candidats.find((type) => MediaRecorder.isTypeSupported(type));
}

function formaterDuree(secondes: number): string {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// <input type="datetime-local"> veut une heure LOCALE sans fuseau, alors que le
// serveur ne manipule que de l'UTC. Les deux conversions vivent ici, au seul
// endroit qui connait le fuseau du navigateur.
function versChampLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

function depuisChampLocal(valeur: string): string | undefined {
  if (!valeur) return undefined;
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function TrekyRecorder({
  categories,
  isPremium,
  restantSecondes,
  quotaSecondes,
  renouvelleLe,
}: {
  categories: Categorie[];
  isPremium: boolean;
  restantSecondes: number;
  quotaSecondes: number;
  renouvelleLe: string;
}) {
  const router = useRouter();

  // Le restant vient du serveur au chargement, puis de chaque reponse de
  // transcription: on evite un aller-retour de plus juste pour rafraichir un
  // compteur. Ce n'est qu'un affichage -- le refus vient du serveur.
  const [restant, setRestant] = useState(restantSecondes);

  const [etape, setEtape] = useState<Etape>("pret");
  const [secondes, setSecondes] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [titre, setTitre] = useState("");
  const [type, setType] = useState<NoteType>("NOTE");
  const [categoryId, setCategoryId] = useState("");
  const [enCreation, setEnCreation] = useState(false);

  // Remplis par le tri Premium. `nouvelleCategorie` n'est qu'une PROPOSITION:
  // rien n'est cree tant que l'utilisateur n'a pas valide la note.
  const [nouvelleCategorie, setNouvelleCategorie] = useState<string | null>(null);
  const [debut, setDebut] = useState("");
  const [trieParIa, setTrieParIa] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Couper le micro quand le composant disparait. Sans ca, la pastille
  // d'enregistrement du navigateur reste allumee apres avoir quitte la page --
  // ce qui, pour un micro, n'est pas un detail cosmetique.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const arreter = () => {
    recorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const demarrer = async () => {
    const mimeType = formatSupporte();
    if (!mimeType) {
      toast.error("Votre navigateur ne permet pas l'enregistrement audio.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Refus du micro, ou pas de micro: les deux se presentent pareil ici.
      toast.error(
        "Micro inaccessible. Vérifiez l'autorisation dans votre navigateur."
      );
      return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Toujours relacher le micro, meme si la transcription echoue ensuite.
      stream.getTracks().forEach((t) => t.stop());

      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (blob.size === 0) {
        toast.error("Enregistrement vide.");
        setEtape("pret");
        return;
      }

      setEtape("transcrit");
      await transcrire(blob, mimeType);
    };

    recorder.start();
    setEtape("enregistre");
    setSecondes(0);

    timerRef.current = setInterval(() => {
      setSecondes((valeur) => {
        // Arret automatique: la duree est ce qui coute, et l'utilisateur ne
        // doit pas avoir a y penser.
        if (valeur + 1 >= MAX_RECORDING_SECONDS) {
          arreter();
          return MAX_RECORDING_SECONDS;
        }
        return valeur + 1;
      });
    }, 1000);
  };

  const transcrire = async (blob: Blob, mimeType: string) => {
    const formData = new FormData();
    formData.append("audio", blob, "dictee");

    try {
      const reponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const donnees = await reponse.json();

      if (!reponse.ok) {
        toast.error(donnees.error ?? "La transcription a échoué.");
        setEtape("pret");
        return;
      }

      if (typeof donnees.restantSecondes === "number") {
        setRestant(donnees.restantSecondes);
      }

      setTranscript(donnees.text);
      // Un titre par defaut tire des premiers mots: l'utilisateur le corrige,
      // mais il n'a pas a partir d'un champ vide. En Premium, le tri le
      // remplacera par un vrai titre juste apres.
      setTitre(donnees.text.split(/\s+/).slice(0, 8).join(" ").slice(0, TITLE_MAX));

      if (isPremium) {
        await trier(donnees.text);
        return;
      }

      setEtape("relit");
    } catch {
      toast.error("Impossible de joindre le service de transcription.");
      setEtape("pret");
    }
  };

  // Le tri est la seule difference de traitement entre Free et Premium: la
  // dictee et la transcription sont identiques pour tous.
  //
  // Un echec de tri ne fait JAMAIS perdre la transcription: on retombe sur le
  // classement manuel, avec le texte deja saisi. Le pire cas doit etre le
  // parcours gratuit, pas un ecran vide.
  const trier = async (texte: string) => {
    setEtape("trie");

    try {
      const propose = await trierTranscript({
        transcript: texte,
        decalageMinutes: new Date().getTimezoneOffset(),
      });

      setType(propose.type);
      setTitre(propose.title);
      setTranscript(propose.content);
      setNouvelleCategorie(propose.newCategoryName);
      setCategoryId(
        propose.categoryId ??
          (propose.newCategoryName ? NOUVELLE_CATEGORIE : "")
      );
      setDebut(propose.startAt ? versChampLocal(propose.startAt) : "");
      setTrieParIa(true);
    } catch (error) {
      toast.info(
        error instanceof Error ? error.message : "Le tri a échoué.",
        { autoClose: 3000 }
      );
    } finally {
      setEtape("relit");
    }
  };

  const creer = async () => {
    if (enCreation) return;
    setEnCreation(true);

    try {
      // La categorie proposee par Treky n'est creee qu'ICI, une fois que
      // l'utilisateur a valide. Trier ne doit rien ecrire: sinon une dictee
      // abandonnee laisserait des categories derriere elle.
      let categorieFinale = categoryId;

      if (categoryId === NOUVELLE_CATEGORIE && nouvelleCategorie) {
        const fd = new FormData();
        fd.set("name", nouvelleCategorie);
        categorieFinale = await createCategory(fd);
      }

      await createNote({
        type,
        title: titre,
        content: transcript,
        categoryId: categorieFinale || undefined,
        // Une date n'a de sens que sur une tache ou un rendez-vous. La renvoyer
        // sur une NOTE la ferait apparaitre dans le calendrier.
        startAt: type === "NOTE" ? undefined : depuisChampLocal(debut),
        classifiedByAi: trieParIa,
      });
      toast.success("Note créée.", { autoClose: 1500 });
      router.push("/dashboard/notes");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création impossible.",
        { autoClose: 3000 }
      );
      setEnCreation(false);
    }
  };

  const recommencer = () => {
    setTranscript("");
    setTitre("");
    setSecondes(0);
    setType("NOTE");
    setCategoryId("");
    setNouvelleCategorie(null);
    setDebut("");
    setTrieParIa(false);
    setEtape("pret");
  };

  return (
    <div className="flex flex-col gap-6 rounded-md border p-6">
      {/* --- Enregistrement --- */}
      <div className="flex flex-col items-center gap-3">
        {etape === "enregistre" ? (
          <Button
            type="button"
            onClick={arreter}
            className="h-20 w-20 rounded-full bg-red-500 hover:bg-red-600 text-white"
            aria-label="Arrêter l'enregistrement"
          >
            <Square className="w-7" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={demarrer}
            disabled={etape === "transcrit" || etape === "trie" || restant <= 0}
            className="h-20 w-20 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white disabled:opacity-60"
            aria-label="Démarrer l'enregistrement"
          >
            {etape === "transcrit" || etape === "trie" ? (
              <Loader2 className="w-7 animate-spin" />
            ) : (
              <Mic className="w-7" />
            )}
          </Button>
        )}

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {etape === "enregistre" &&
            `${formaterDuree(secondes)} / ${formaterDuree(MAX_RECORDING_SECONDS)}`}
          {etape === "transcrit" && "Transcription en cours…"}
          {etape === "trie" && "Treky range votre note…"}
          {etape === "pret" && restant > 0 && "Appuyez et dictez"}
          {etape === "pret" && restant <= 0 && "Quota mensuel épuisé"}
          {etape === "relit" &&
            (trieParIa ? "Vérifiez, corrigez si besoin" : "Relisez, corrigez, classez")}
        </p>

        {/* Un plafond invisible est un plafond qui surprend: on affiche le
            restant en permanence, et on previent avant qu'il ne soit atteint. */}
        <p className="text-xs text-muted-foreground">
          {restant <= 0 ? (
            <>
              Quota renouvelé le{" "}
              {new Date(renouvelleLe).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
              })}
            </>
          ) : (
            <>
              {Math.floor(restant / 60)} min restantes ce mois-ci sur{" "}
              {Math.round(quotaSecondes / 60)}
            </>
          )}
        </p>
      </div>

      {/* --- Relecture et classement --- */}
      {etape === "relit" && (
        <div className="flex flex-col gap-4 border-t pt-4">
          {/* Dire ce qui a ete decide par la machine, et rappeler que tout
              reste modifiable: un champ pre-rempli sans explication donne
              l'impression d'une erreur de saisie. */}
          {trieParIa && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 shrink-0" />
              Treky a classé cette note. Tout reste modifiable.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="titre">Titre</Label>
            <input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              maxLength={TITLE_MAX}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="transcript">Transcription</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              maxLength={CONTENT_MAX}
              rows={5}
            />
          </div>

          {/* Le classement est MANUEL ici: c'est ce que fait le tier gratuit.
              Le tri automatique par l'IA est la PR suivante, et il remplira ces
              deux champs a la place de l'utilisateur. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as NoteType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="NOTE">Note</option>
                <option value="TASK">Tâche</option>
                <option value="EVENT">Rendez-vous</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="categoryId">Catégorie</Label>
              <select
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {/* Proposee par Treky, pas encore en base: le libelle le dit,
                    pour que l'utilisateur sache qu'il cree quelque chose. */}
                {nouvelleCategorie && (
                  <option value={NOUVELLE_CATEGORIE}>
                    {nouvelleCategorie} (nouvelle)
                  </option>
                )}
              </select>
            </div>
          </div>

          {/* Une date sur une NOTE n'aurait nulle part ou aller: le champ
              n'apparait que pour une tache ou un rendez-vous. */}
          {type !== "NOTE" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="debut">
                {type === "EVENT" ? "Date et heure" : "Échéance"}
              </Label>
              <input
                id="debut"
                type="datetime-local"
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {categories.length === 0 && !nouvelleCategorie && (
            <p className="text-xs text-muted-foreground">
              Aucune catégorie —{" "}
              <Link href="/dashboard/categories" className="underline">
                créez-en une
              </Link>
              .
            </p>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={recommencer}>
              Recommencer
            </Button>
            <Button
              type="button"
              onClick={creer}
              disabled={enCreation || !titre.trim()}
              aria-busy={enCreation}
              className="bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white disabled:opacity-60"
            >
              {enCreation ? (
                <Loader2 className="w-4 animate-spin" />
              ) : (
                "Créer la note"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
