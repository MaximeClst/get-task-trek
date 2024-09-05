"use client";

import { useChat } from "ai/react";
import axios from "axios";
import { useSession } from "next-auth/react";
import React, { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatWindow() {
  const { input, handleInputChange, handleSubmit } = useChat();
  const [conversationStep, setConversationStep] = useState<number>(0);
  const [noteDetails, setNoteDetails] = useState<{
    title: string;
    description: string;
    date: string;
    recurrence: string;
  }>({
    title: "",
    description: "",
    date: "",
    recurrence: "",
  });
  const [customMessages, setCustomMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const { data: session } = useSession();

  // Scrolling automatique vers le bas à chaque nouveau message
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [customMessages]);

  const handleConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setCustomMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    let nextAssistantMessage = "";
    let nextStep = conversationStep;

    try {
      switch (conversationStep) {
        case 0:
          // IA demande l'action
          if (input.toLowerCase().includes("créer moi une note")) {
            nextAssistantMessage =
              "Très bien ! Quel est le titre de votre note ?";
            nextStep = 1;
          } else {
            nextAssistantMessage =
              "Désolé, je n'ai pas compris. Que voulez-vous faire ?";
            nextStep = 0;
          }
          break;

        case 1: // IA demande le titre
          setNoteDetails((prev) => ({ ...prev, title: input.trim() }));
          nextAssistantMessage =
            "Parfait, quelle description souhaitez-vous ajouter ?";
          nextStep = 2;
          break;

        case 2: // IA demande la description
          if (["non", "aucune", "rien"].includes(input.trim().toLowerCase())) {
            setNoteDetails((prev) => ({ ...prev, description: "" }));
          } else {
            setNoteDetails((prev) => ({ ...prev, description: input.trim() }));
          }
          nextAssistantMessage = "Quel créneau horaire souhaitez-vous ?";
          nextStep = 3;
          break;

        case 3: // IA demande la date et l'heure
          setNoteDetails((prev) => ({ ...prev, date: input.trim() }));
          nextAssistantMessage =
            "Souhaitez-vous rendre cet événement récurrent ?";
          nextStep = 4;
          break;

        case 4: // IA demande si l'événement est récurrent
          const weeklyRecurrence =
            /(tous|chaque)\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i;
          const monthlyRecurrence =
            /(tous|chaque)\s+(\d{1,2})\s+(du mois|jour)\b/i;

          if (weeklyRecurrence.test(input)) {
            const dayMatch = input.match(weeklyRecurrence);
            if (dayMatch) {
              const day = dayMatch[2];
              setNoteDetails((prev) => ({
                ...prev,
                recurrence: `tous les ${day}`,
              }));
              await createRecurringEvent(noteDetails, day);
              nextAssistantMessage = `Très bien ${session?.user?.name}, j'ai créé la note "${noteDetails.title}" sans description pour chaque ${day}, et ajouté cet événement récurrent à votre calendrier.`;
            }
          } else if (monthlyRecurrence.test(input)) {
            const dayOfMonthMatch = input.match(monthlyRecurrence);
            if (dayOfMonthMatch) {
              const dayOfMonth = dayOfMonthMatch[2];
              setNoteDetails((prev) => ({
                ...prev,
                recurrence: `chaque ${dayOfMonth} du mois`,
              }));
              await createRecurringEvent(noteDetails, dayOfMonth);
              nextAssistantMessage = `Très bien ${session?.user?.name}, j'ai créé la note "${noteDetails.title}" sans description pour le ${dayOfMonth} de chaque mois, et ajouté cet événement récurrent à votre calendrier.`;
            }
          } else {
            nextAssistantMessage = `Très bien ${session?.user?.name}, j'ai créé la note "${noteDetails.title}" sans description pour ${noteDetails.date}.`;
            await createNote(
              noteDetails.title,
              noteDetails.description,
              noteDetails.date
            );
          }
          nextStep = 0; // Réinitialiser la conversation
          break;

        default: {
          nextAssistantMessage = "Je n'ai pas compris votre demande.";
          nextStep = 0;
          break;
        }
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: nextAssistantMessage,
      };
      setCustomMessages((prev) => [...prev, assistantMessage]);
      setConversationStep(nextStep);
    } catch (error) {
      console.error("Erreur lors de la création de la note :", error);
      setError("Désolé, une erreur est survenue.");
      setCustomMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Désolé, une erreur est survenue." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createNote = async (
    title: string,
    description: string,
    date: string
  ) => {
    const start = new Date(date);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // Durée par défaut de 1 heure
    await axios.post("/api/create-note", {
      title,
      description,
      start: start.toISOString(),
      end: end.toISOString(),
      date,
    });
  };

  const createRecurringEvent = async (
    details: typeof noteDetails,
    recurrence: string
  ) => {
    // Logique pour ajouter l'événement récurrent
    const recurringDates = getRecurringDates(recurrence); // Une fonction à créer pour gérer la génération de dates
    for (const date of recurringDates) {
      await createNote(details.title, details.description, date);
    }
  };

  const getRecurringDates = (recurrence: string): string[] => {
    // Logique à implémenter pour générer les dates récurrentes selon la saisie utilisateur
    const weekDayRegex =
      /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i;
    const monthRegex =
      /(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i;

    const dayMatch = recurrence.match(weekDayRegex);
    const monthMath = recurrence.match(monthRegex);

    if (!dayMatch || !monthMath) {
      throw new Error("Format de date invalide.");
    }

    const dayOfWeek = dayMatch[0].toLowerCase();
    const month = monthMath[0].toLowerCase();

    const monthIndex = {
      janvier: 0,
      février: 1,
      mars: 2,
      avril: 3,
      mai: 4,
      juin: 5,
      juillet: 6,
      août: 7,
      septembre: 8,
      octobre: 9,
      novembre: 10,
      décembre: 11,
    }[month];

    if (monthIndex === undefined) {
      throw new Error("Mois invalide.");
    }

    const year = new Date().getFullYear();
    const dates: string[] = [];

    let date = new Date(year, monthIndex, 1);
    while (
      date.getDay() !==
      [
        "lundi",
        "mardi",
        "mercredi",
        "jeudi",
        "vendredi",
        "samedi",
        "dimanche",
      ].indexOf(dayOfWeek)
    ) {
      date.setDate(date.getDate() + 1);
    }

    while (date.getMonth() === monthIndex) {
      dates.push(date.toISOString());
      date.setDate(date.getDate() + 7);
    }

    return dates;
  };

  return (
    <div className="flex flex-col justify-center w-full h-full p-4">
      <div className="flex-1 overflow-auto">
        {customMessages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 p-2 ${
              msg.role === "user"
                ? "text-right bg-blue-500 text-white"
                : "text-left bg-gray-300 text-black"
            }`}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
      <div className="flex">
        <textarea
          className="flex-1 border rounded p-2 bg-gray-200 text-black"
          rows={2}
          value={input}
          onChange={handleInputChange}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleConversation(e);
            }
          }}
          placeholder="Tapez votre message..."
          aria-label="Message input"
          disabled={loading}
        />
        <button
          onClick={handleConversation}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded"
          disabled={loading}
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
