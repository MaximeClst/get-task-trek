import axios from "axios";

export const handleNoteRequest = async (input: string, session: any) => {
  if (input.toLowerCase().includes("note")) {
    const title = "Ma nouvelle note";
    const description = "Description générée par l'IA.";
    const date = new Date().toISOString();

    await createNote({
      title,
      description,
      date,
    });

    return {
      message: `Très bien ${session?.user?.name}, j'ai créé la note "${title}".`,
    };
  }
  return null;
};

const createNote = async (noteDetails: {
  title: string;
  description: string;
  date: string;
}) => {
  // 'date' est envoyé comme paramètre ici
  await axios.post("/api/create-note", noteDetails);
};

export const handleCalendarRequest = async (
  title: string,
  description: string,
  date: string,
  recurrence?: string
) => {
  try {
    // Logique pour créer un événement dans le calendrier
    await axios.post("/api/calendar", {
      title,
      description,
      date,
      recurrence,
    });

    return "Événement ajouté au calendrier avec succès";
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'événement au calendrier", error);
    throw new Error("Erreur lors de l'ajout de l'événement au calendrier");
  }
};
