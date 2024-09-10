import axios from "axios";
import { parse } from "date-fns";

export const handleNoteRequest = async (
  {
    title,
    description,
    date,
    time,
  }: { title: string; description: string; date: string; time: string },
  session: any
) => {
  const fullDate = `${date} ${time}`;

  await createNote({
    title,
    description,
    date: fullDate,
  });

  return {
    message: `Très bien ${session?.user?.name}, j'ai créé la note "${title}" pour le ${fullDate}.`,
  };
};

export const checkMissingDetails = (details: {
  title?: string;
  date?: string;
  time?: string;
  recurrence?: string;
}) => {
  let missingInfo = [];

  if (!details.title) {
    missingInfo.push("le titre");
  }
  if (!details.date) {
    missingInfo.push("la date");
  }
  if (!details.time) {
    missingInfo.push("l'heure");
  }
  if (!details.recurrence && details.date) {
    missingInfo.push("la récurrence (si nécessaire)");
  }

  if (missingInfo.length > 0) {
    return `Il manque les informations suivantes : ${missingInfo.join(", ")}.`;
  } else {
    return null; // Toutes les informations sont présentes
  }
};

export const extractDetails = (input: string) => {
  const title = input.match(/titre:\s*(.*)/i)?.[1];
  const date = input.match(/date:\s*(.*)/i)?.[1];
  let formattedDate = date ? parse(date, "dd/MM/yyyy", new Date()) : null;
  const time = input.match(/heure:\s*(.*)/i)?.[1];
  const recurrence = input.match(/récurrence:\s*(.*)/i)?.[1];

  return { title, date, time, recurrence };
};

const createNote = async (noteDetails: {
  title: string;
  description: string;
  date: string;
}) => {
  await axios.post("/api/create-note", noteDetails);
};

export const handleCalendarRequest = async ({
  title,
  description,
  date,
  time,
  recurrence,
}: {
  title: string;
  description: string;
  date: string;
  time: string;
  recurrence?: string;
}) => {
  try {
    const fullDate = `${date} ${time}`;
    await axios.post("/api/calendar", {
      title,
      description,
      date: fullDate,
      recurrence,
    });

    return "Événement ajouté au calendrier avec succès";
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'événement au calendrier", error);
    throw new Error("Erreur lors de l'ajout de l'événement au calendrier");
  }
};
