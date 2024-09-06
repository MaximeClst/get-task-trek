import React from "react";

type AssistantMessageProps = {
  content: string;
};

const AssistantMessage: React.FC<AssistantMessageProps> = ({ content }) => {
  return (
    <div className="mb-2 p-2 text-left bg-gray-300 text-black rounded">
      {content}
    </div>
  );
};

export default AssistantMessage;
