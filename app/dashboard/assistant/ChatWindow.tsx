"use client";

import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  checkMissingDetails,
  extractDetails,
  handleCalendarRequest,
  handleNoteRequest,
} from "./NoteHandler";

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

  const userName = session?.user?.name || "utilisateur";

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [customMessages]);

  const handleConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { title, date, time, recurrence } = extractDetails(input);

      const missingMessage = checkMissingDetails({
        title,
        date,
        time,
        recurrence,
      });

      if (missingMessage) {
        setCustomMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: missingMessage,
          },
        ]);
        return;
      }

      if (!title || !date) {
        setCustomMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Il manque des informations pour créer la note.",
          },
        ]);
        return;
      }

      const noteResponse = await handleNoteRequest(
        {
          title,
          description: "Description générée par l'IA.",
          date,
          time: time ?? "",
        },
        session
      );

      setCustomMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Très bien ${userName}, j'ai créé la note "${noteResponse.message}".`,
        },
      ]);

      if (date || recurrence) {
        const calendarResponse = await handleCalendarRequest({
          title,
          description: "Description générée par l'IA.",
          date,
          time: time ?? "",
          recurrence,
        });
        setCustomMessages((prev) => [
          ...prev,
          { role: "assistant", content: calendarResponse },
        ]);
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
