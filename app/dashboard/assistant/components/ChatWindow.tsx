"use client";

import { useChat } from "ai/react";
import axios from "axios";
import { format, parse } from "date-fns";
import { fr } from "date-fns/locale";
import { useSession } from "next-auth/react";
import React, { useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatWindow() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  const [customMessages, setCustomMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const { data: session } = useSession();

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [customMessages]);

  const parseDate = (input: string) => {
    const parsedDate = parse(input, "EEEE dd MMMM 'à' HH'h'", new Date(), {
      locale: fr,
    });
    if (isNaN(parsedDate.getTime())) {
      return null;
    }
    return parsedDate;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setCustomMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const titleMatch = input.match(/RDV\s+(.*?)(\s+le\s+|\s+)/i);
      const title = titleMatch ? titleMatch[1].trim() : "Note sans titre";

      const dateMatch = input.match(
        /(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+à\s+(\d{1,2})h/i
      );
      const dateString = dateMatch
        ? `${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]} à ${dateMatch[4]}`
        : null;
      const start = dateString ? parseDate(dateString) : new Date();
      const end = new Date(
        (start ? start.getTime() : new Date().getTime()) + 60 * 60 * 1000
      );

      const response = await axios.post("/api/create-note", {
        title,
        description: input,
        start: start ? start.toISOString() : new Date().toISOString(),
        end: end.toISOString(),
      });

      const userName = session?.user?.name || "utilisateur";

      const assistantMessage: Message = {
        role: "assistant",
        content: `Très bien ${userName}, je vous ai créé la note "${title}" pour ${format(
          start as Date,
          "EEEE dd MMMM à HH'h'",
          { locale: fr }
        )}.`,
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
              sendMessage(e);
            }
          }}
          placeholder="Tapez votre message..."
          aria-label="Message input"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
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
