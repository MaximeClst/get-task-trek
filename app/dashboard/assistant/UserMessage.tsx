import React from "react";

type UserMessageProps = {
  content: string;
};

const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
  return (
    <div className="mb-2 p-2 text-right bg-blue-500 text-white rounded">
      {content}
    </div>
  );
};

export default UserMessage;
