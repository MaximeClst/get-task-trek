import React from "react";

type UserMessageProps = {
  content: string;
};

const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
  if (!content) return null; // Ne rien afficher si le contenu est vide

  return (
    <div
      className="mb-2 p-2 text-right bg-blue-500 text-white rounded"
      aria-label="Message utilisateur"
    >
      {content}
    </div>
  );
};

export default UserMessage;
