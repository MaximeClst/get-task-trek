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
  }>({
    title: "",
    description: "",
    date: "",
  });
  const [customMessages, setCustomMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const { data: session } = useSession();

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
        case 0: // Step 1: User wants to create a note
          nextAssistantMessage =
            "Très bien ! Quel est le titre de votre note ?";
          nextStep = 1;
          break;

        case 1: // Step 2: Ask for the note's title
          setNoteDetails((prev) => ({ ...prev, title: input.trim() }));
          nextAssistantMessage =
            "Parfait, quelle description souhaitez-vous ajouter ?";
          nextStep = 2;
          break;

        case 2: // Step 3: Ask for description
          if (
            [
              "non",
              "pas de description",
              "aucune description",
              "rien",
            ].includes(input.trim().toLowerCase())
          ) {
            setNoteDetails((prev) => ({ ...prev, description: "" }));
            nextAssistantMessage =
              "Voulez-vous ajouter une date et une heure ?";
          } else {
            setNoteDetails((prev) => ({ ...prev, description: input.trim() }));
            nextAssistantMessage =
              "Voulez-vous ajouter une date et une heure ?";
          }
          nextStep = 3;
          break;

        case 3: // Step 4: Ask for date and time
          if (
            ["non", "pas de date ni d'heure", "rien"].includes(
              input.trim().toLowerCase()
            )
          ) {
            await createNote(noteDetails.title, noteDetails.description, "");
            nextAssistantMessage = `Très bien ${session?.user?.name}, j'ai créé la note "${noteDetails.title}" sans date ni heure.`;
          } else {
            try {
              setNoteDetails((prev) => ({ ...prev, date: input.trim() }));
              await createNote(
                noteDetails.title,
                noteDetails.description,
                input.trim()
              );
              nextAssistantMessage = `Très bien ${
                session?.user?.name
              }, j'ai créé la note "${
                noteDetails.title
              }" avec comme description "${
                noteDetails.description || "sans description"
              }" pour ${input.trim()}.`;
            } catch (error) {
              setError("Format de date invalide. Veuillez réessayer.");
              nextAssistantMessage =
                "Désolé, le format de la date est invalide.";
            }
          }
          nextStep = 0; // Reset conversation
          break;

        default:
          break;
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

  const hourRegex = /(\d{1,2})\s?(h|heures?)/i;
  const dayOfWeekRegex =
    /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i;
  const dayOfMonthRegex = /\b(0?[1-9]|[12][0-9]|3[01])\b/;

  const parseDateTime = (input: string) => {
    const dayOfWeekMatch = input.match(dayOfWeekRegex);
    const dayOfMonthMatch = input.match(dayOfMonthRegex);
    const hourMatch = input.match(hourRegex);

    let parsedDate = new Date(); // Par défaut, utiliser la date actuelle

    // Si un jour de la semaine est trouvé, on ajuste la date
    if (dayOfWeekMatch) {
      const dayOfWeek = dayOfWeekMatch[0].toLowerCase();
      const daysToAdd =
        {
          lundi: 1,
          mardi: 2,
          mercredi: 3,
          jeudi: 4,
          vendredi: 5,
          samedi: 6,
          dimanche: 7,
        }[dayOfWeek] || 0;
      parsedDate.setDate(
        parsedDate.getDate() + (daysToAdd - parsedDate.getDay())
      );
    }

    // Si un jour du mois est trouvé, on l'ajoute à la date
    if (dayOfMonthMatch) {
      const dayOfMonth = parseInt(dayOfMonthMatch[0]);
      parsedDate.setDate(dayOfMonth);
    }

    // Si une heure est trouvée, on l'ajoute à la date
    if (hourMatch) {
      const hour = parseInt(hourMatch[1]);
      parsedDate.setHours(hour, 0, 0, 0); // On fixe les minutes et secondes à 0
    }

    return parsedDate;
  };

  const createNote = async (
    title: string,
    description: string,
    date: string
  ) => {
    const start = date ? parseDateTime(date) : new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000); // Durée par défaut de 1 heure

    await axios.post("/api/create-note", {
      title,
      description,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  };

  return (
    <div className="flex flex-col justify-center w-full h-full p-4">
      <div className="flex-1 overflow-auto">
        <h2 className="text-center text-lg font-bold mb-4">
          Bonjour, je suis{" "}
          <span className="italic text-muted-foreground">Titask</span> 🤖, ton
          assistant numérique pour créer tes notes !
        </h2>
        {customMessages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 p-2 rounded ${
              msg.role === "user"
                ? "bg-gray-700 text-white self-end"
                : "bg-gray-300 text-black self-start"
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
          className="ml-2 px-4 py-2 bg-gray-700 text-white rounded"
          disabled={loading}
        >
          Envoyer
        </button>
      </div>
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </div>
  );
}
