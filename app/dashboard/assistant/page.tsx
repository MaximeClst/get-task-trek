"use client";

import { useChat } from "ai/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from "react";
import ChatWindow from "./components/ChatWindow";

export default function AssistantPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    keepLastMessageOnError: true,
  });

  React.useEffect(() => {
    if (status === "loading") return;
    if (!session) router.push("/auth/login");
    // if (session && !session.user.isPremium) router.push("/dashboard/payment");
  }, [session, status, router]);

  return (
    <div className="assistant-container">
      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role === "user" ? "user" : "ai"}`}
          >
            <strong>{message.role === "user" ? "User:" : "AI:"}</strong>{" "}
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="chat-form">
        <input
          name="prompt"
          value={input}
          onChange={handleInputChange}
          className="chat-input"
          placeholder="Tapez votre message..."
        />
        <button type="submit" className="chat-submit-button">
          Envoyer
        </button>
      </form>
      <ChatWindow />
    </div>
  );
}
