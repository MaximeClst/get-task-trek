"use client";

import ChatWindow from "./components/ChatWindow";

export default function Chat() {
  return (
    <div className="flex flex-col w-full max-w-md py-2 mx-auto stretch">
      <ChatWindow />
    </div>
  );
}
