"use client";

import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import AssistantMessage from "./AssistantMessage";
import { handleCalendarRequest, handleNoteRequest } from "./NoteHandler";
import UserMessage from "./UserMessage";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatWindow() {
  const { input, handleInputChange } = useChat();
  const [customMessages, setCustomMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const { data: session } = useSession();

  // Gérer les détails de la note
  const [noteDetails, setNoteDetails] = useState<{
    title?: string;
    description?: string;
    date?: string;
    recurrence?: string;
  }>({});

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
      // Appelle à la fonction pour traiter les demandes de notes ou de calendrier
      const response =
        (await handleNoteRequest(input, session?.user.id)) ||
        (await handleCalendarRequest(
          noteDetails.title ?? "",
          noteDetails.description ?? "",
          noteDetails.date ?? "",
          noteDetails.recurrence ?? ""
        ));

      // Vérification du type de réponse
      nextAssistantMessage =
        typeof response === "string" ? response : response?.message;

      const assistantMessage: Message = {
        role: "assistant",
        content: nextAssistantMessage,
      };
      setCustomMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Erreur :", error);
      setError("Désolé, une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center w-full h-full p-4">
      <div className="flex-1 overflow-auto">
        {customMessages.map((msg, index) =>
          msg.role === "user" ? (
            <UserMessage key={index} content={msg.content} />
          ) : (
            <AssistantMessage key={index} content={msg.content} />
          )
        )}
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
