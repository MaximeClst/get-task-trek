import axios from "axios";

// Fonction pour gérer les requêtes liées au calendrier
export const handleCalendarRequest = async (input: string, session: any) => {
  try {
    // Extraire les détails du message de l'utilisateur
    const { title, date, time, recurrence } = extractCalendarDetails(input);

    if (title && date && time) {
      const fullDate = `${date} ${time}`; // Concatène la date et l'heure
      await createCalendarEvent({
        title,
        start: fullDate,
        end: calculateEndTime(fullDate, recurrence), // Calculer l'heure de fin
        recurrence, // Ajouter la récurrence si elle est spécifiée
      });

      return {
        message: `Événement "${title}" ajouté à votre calendrier pour le ${fullDate}, ${session?.user?.name}.`,
      };
    } else {
      return {
        message:
          "Il manque des informations pour ajouter l'événement au calendrier (titre, date ou heure).",
      };
    }
  } catch (error) {
    console.error("Erreur lors de la création de l'événement : ", error);
    return {
      message:
        "Une erreur est survenue lors de l'ajout de l'événement au calendrier.",
    };
  }
};

// Fonction utilitaire pour extraire les détails de l'événement
const extractCalendarDetails = (input: string) => {
  const title = input.match(/titre:\s*(.*)/i)?.[1];
  const date = input.match(/date:\s*(.*)/i)?.[1];
  const time = input.match(/heure:\s*(.*)/i)?.[1];
  const recurrence = input.match(/récurrence:\s*(.*)/i)?.[1];

  return { title, date, time, recurrence };
};

// Fonction pour créer un événement de calendrier
const createCalendarEvent = async (eventDetails: {
  title: string;
  start: string;
  end: string;
  recurrence?: string;
}) => {
  try {
    await axios.post("/api/create-event", eventDetails);
  } catch (error) {
    throw new Error(
      "Erreur lors de l'envoi de la requête à l'API de calendrier."
    );
  }
};

// Fonction pour calculer l'heure de fin de l'événement
const calculateEndTime = (start: string, recurrence?: string) => {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Par défaut, durée de l'événement = 1 heure

  // Si une récurrence est spécifiée, ajuster la date de fin
  if (recurrence) {
    // Logique pour gérer la récurrence (par exemple, tous les mardis)
    // Exemple : ajuster la fin pour une récurrence hebdomadaire
  }

  return endDate.toISOString();
};
