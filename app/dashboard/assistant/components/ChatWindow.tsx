"use client";

import axios from "axios";
import React, { useState } from "react";

type Message = {
  sender: "user" | "assistant";
  text: string;
};

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    setInput("");

    try {
      const response = await axios.post("/api/assistant/chat", {
        message: input,
      });

      const assistantMessage: Message = {
        sender: "assistant",
        text: response.data.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(
        "Erreur lors de la communication avec l'assistant :",
        error
      );
      setMessages((prev) => [
        ...prev,
        { sender: "assistant", text: "Désolé, une erreur est survenue." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col justify-center w-full h-full p-4">
      <div className="flex-1 overflow-auto">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 p-2 rounded ${
              msg.sender === "user"
                ? "bg-blue-500 text-white self-end"
                : "bg-gray-200 self-start"
            }`}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div className="mb-2 p-2 rounded bg-gray-200 self-start">
            L'assistant écrit...
          </div>
        )}
      </div>
      <div className="flex">
        <textarea
          className="flex-1 border rounded p-2"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Tapez vortre message..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}
