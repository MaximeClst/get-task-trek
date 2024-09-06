"use client";

import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { handleCalendarRequest, handleNoteRequest } from "./NoteHandler";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatWindow() {
  const { input, handleInputChange } = useChat();
  const [conversationStep, setConversationStep] = useState<number>(0);
  const [noteDetails, setNoteDetails] = useState<{
    title: string;
    description: string;
    date: string;
    recurrence?: string;
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

  const userName = session?.user?.name || "utilisateur"; // Correction ici

  // Scroll automatique vers le bas à chaque nouveau message
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

    try {
      switch (conversationStep) {
        case 0:
          // Pose une question à l'utilisateur sur ce qu'il souhaite faire
          if (input.toLowerCase().includes("note")) {
            nextAssistantMessage =
              "Très bien, quel est le titre de votre note ?";
            setConversationStep(1); // Passe à l'étape suivante
          } else {
            nextAssistantMessage =
              "Je n'ai pas compris. Souhaitez-vous créer une note ou un événement ?";
            setConversationStep(0);
          }
          break;

        case 1:
          // L'utilisateur fournit un titre
          setNoteDetails((prev) => ({ ...prev, title: input.trim() }));
          nextAssistantMessage =
            "Parfait, voulez-vous ajouter une description ?";
          setConversationStep(2);
          break;

        case 2:
          // L'utilisateur fournit une description ou dit qu'il n'y en a pas
          if (input.toLowerCase().includes("non")) {
            setNoteDetails((prev) => ({ ...prev, description: "" }));
            nextAssistantMessage = "Quel créneau horaire souhaitez-vous ?";
          } else {
            setNoteDetails((prev) => ({ ...prev, description: input.trim() }));
            nextAssistantMessage = "Quel créneau horaire souhaitez-vous ?";
          }
          setConversationStep(3);
          break;

        case 3:
          // L'utilisateur fournit une date
          setNoteDetails((prev) => ({ ...prev, date: input.trim() }));
          nextAssistantMessage =
            "Souhaitez-vous rendre cet événement récurrent ?";
          setConversationStep(4);
          break;

        case 4:
          // Gérer la récurrence
          if (input.toLowerCase().includes("oui")) {
            nextAssistantMessage = "Très bien, à quelle fréquence ?";
            setConversationStep(5);
          } else {
            // Si pas de récurrence, créer la note
            await handleNoteRequest(noteDetails.title, noteDetails.description);
            nextAssistantMessage = `Très bien ${userName}, j'ai créé la note "${noteDetails.title}".`;
            setConversationStep(0); // Réinitialiser la conversation
          }
          break;

        case 5:
          // L'utilisateur fournit une récurrence
          setNoteDetails((prev) => ({ ...prev, recurrence: input.trim() }));
          await handleCalendarRequest(
            noteDetails.title,
            noteDetails.description,
            noteDetails.date,
            noteDetails.recurrence
          );
          nextAssistantMessage = `Très bien ${userName}, j'ai créé la note récurrente "${noteDetails.title}" avec la fréquence "${noteDetails.recurrence}".`;
          setConversationStep(0); // Réinitialiser la conversation
          break;

        default:
          nextAssistantMessage = "Je n'ai pas compris votre demande.";
          break;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: nextAssistantMessage,
      };
      setCustomMessages((prev) => [...prev, assistantMessage]);
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
