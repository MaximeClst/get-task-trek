import axios from "axios";
import { parse } from "date-fns";

// Fonction pour gérer les requêtes liées au calendrier
export const handleCalendarRequest = async (input: string, session: any) => {
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
};

// Extraire les détails du message de l'utilisateur
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
  await axios.post("/api/create-event", eventDetails);
};

// Calculer l'heure de fin de l'événement
const calculateEndTime = (start: string, recurrence?: string) => {
  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Par défaut, durée de l'événement = 1 heure

  // Si une récurrence est spécifiée, ajuster la date de fin selon les besoins
  if (recurrence) {
    // Logique pour ajuster l'heure de fin si nécessaire
  }

  return endDate.toISOString();
};
