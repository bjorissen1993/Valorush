import React from "react";
import { ThinkingProvider } from "./ThinkingContext";
import { Chat } from "./components/Chat";

export const App: React.FC = () => {
  return (
    <ThinkingProvider>
      <div className="h-full w-full">
        <Chat />
      </div>
    </ThinkingProvider>
  );
};

export default App;
