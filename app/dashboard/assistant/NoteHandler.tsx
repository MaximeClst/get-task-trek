import axios from "axios";

// Gestion de la création d'une note
export const handleNoteRequest = async (
  {
    title,
    description,
    date,
    time,
  }: { title: string; description: string; date: string; time: string },
  session: any
) => {
  const fullDate = `${date} ${time}`; // Concatène la date et l'heure

  await createNote({
    title,
    description,
    date: fullDate,
  });

  return {
    message: `Très bien ${session?.user?.name}, j'ai créé la note "${title}" pour le ${fullDate}.`,
  };
};

// Fonction de vérification des détails manquants
export const checkMissingDetails = (details: {
  title?: string;
  date?: string;
  time?: string;
  recurrence?: string;
}) => {
  let missingInfo = [];

  // Vérification des champs obligatoires
  if (!details.title) {
    missingInfo.push("le titre");
  }
  if (!details.date) {
    missingInfo.push("la date");
  }
  if (!details.time) {
    missingInfo.push("l'heure");
  }

  if (missingInfo.length > 0) {
    return `Il manque les informations suivantes : ${missingInfo.join(", ")}.`; // Retourne les infos manquantes
  } else {
    return null; // Toutes les informations sont présentes
  }
};

// Fonction pour extraire les détails à partir de l'entrée utilisateur
export const extractDetails = (input: string) => {
  const title = input.match(/titre:\s*(.*)/i)?.[1]; // Extraction du titre
  const date = input.match(/(\b\d{1,2}\s\w+\s\d{4})/i)?.[1]; // Extraction de la date (avec format jour mois année)
  const time = input.match(/(\d{1,2}h\d{0,2})/i)?.[1]; // Extraction de l'heure (avec ou sans minutes)
  const recurrence = input.match(/récurrence:\s*(.*)/i)?.[1]; // Extraction de la récurrence (optionnel)

  return { title, date, time, recurrence }; // Retourne les détails
};

// Fonction de création de la note
const createNote = async (noteDetails: {
  title: string;
  description: string;
  date: string;
}) => {
  await axios.post("/api/create-note", noteDetails); // Envoie les détails de la note à l'API
};

// Fonction pour gérer l'ajout au calendrier, incluant la récurrence
export const handleCalendarRequest = async (
  {
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
  },
  session: any
) => {
  const fullDate = `${date} ${time}`;
  await axios.post("/api/calendar", {
    title,
    description,
    date: fullDate,
    recurrence,
  });

  return {
    message: `Très bien ${session?.user?.name}, j'ai ajouté la note "${title}" à votre calendrier pour le ${fullDate}.`,
  };
};
