"use client";

import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  extractDetails,
  handleCalendarRequest,
  handleNoteRequest,
} from "./NoteHandler";

type Message = {
  role: "user" | "assistant";
  content: string;
};

let conversationState = {
  title: "",
  description: "",
  date: "",
  time: "",
  recurrence: false,
};

export default function ChatWindow() {
  const { input, handleInputChange } = useChat();
  const [customMessages, setCustomMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const { data: session } = useSession();

  const userName = session?.user?.name || "utilisateur"; // Utilisateur par défaut

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [customMessages]);

  // Gestion principale de la conversation avec l'utilisateur
  const handleConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const userResponse = input.trim(); // Réponse utilisateur

      if (!conversationState.title) {
        // Si le titre n'est pas encore défini, demande-le
        conversationState.title = userResponse;
        setCustomMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Voulez-vous ajouter une description ?",
          },
        ]);
        return;
      }

      if (!conversationState.description) {
        // Si la description n'est pas encore définie
        if (userResponse.toLowerCase() === "non") {
          conversationState.description = ""; // Pas de description
        } else {
          conversationState.description = userResponse;
        }
        setCustomMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Quelle est la date et l'heure ?" },
        ]);
        return;
      }

      // Si la date et l'heure ne sont pas encore définies
      if (!conversationState.date || !conversationState.time) {
        const { date, time } = extractDetails(userResponse); // Extraire date et heure
        if (date && time) {
          conversationState.date = date;
          conversationState.time = time;
          setCustomMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Voulez-vous ajouter une récurrence ?",
            },
          ]);
          return;
        }
        setCustomMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "Je n'ai pas compris la date et l'heure. Veuillez réessayer.",
          },
        ]);
        return;
      }

      // Si la récurrence n'est pas encore définie
      if (!conversationState.recurrence) {
        if (userResponse.toLowerCase() === "non") {
          conversationState.recurrence = false;
        } else {
          conversationState.recurrence = true;
        }

        // Créer la note et l'événement calendrier
        const response = await createNoteAndCalendarEvent(
          conversationState,
          session
        );
        setCustomMessages((prev) => [
          ...prev,
          { role: "assistant", content: response },
        ]);

        // Réinitialiser la conversation après la création
        conversationState = {
          title: "",
          description: "",
          date: "",
          time: "",
          recurrence: false,
        };
        return;
      }
    } catch (error) {
      setError("Désolé, une erreur est survenue.");
      setCustomMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Erreur lors de la création de la note.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour créer la note et l'événement dans le calendrier
  const createNoteAndCalendarEvent = async (
    state: typeof conversationState,
    session: any
  ) => {
    await handleNoteRequest(
      {
        title: state.title,
        description: state.description,
        date: state.date,
        time: state.time,
      },
      session
    );

    await handleCalendarRequest(
      {
        title: state.title,
        description: state.description,
        date: state.date,
        time: state.time,
        recurrence: state.recurrence ? "recurring" : "non-recurring",
      },
      session
    );

    return `Très bien ${session?.user?.name}, j'ai créé la note "${state.title}" pour le ${state.date} à ${state.time}.`;
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
      <div className="flex justify-center">
        <textarea
          className="flex-1 border rounded p-2 bg-gray-200 text-black"
          rows={2}
          value={input}
          onChange={handleInputChange}
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
      {error && <div className="text-red-500 mt-2">{error}</div>}
    </div>
  );
}
