import React, { createContext, useContext, useState } from "react";

type ThinkingContextValue = {
  isThinking: boolean;
  setIsThinking: (v: boolean) => void;
};

const ThinkingContext = createContext<ThinkingContextValue>({
  isThinking: false,
  setIsThinking: () => {},
});

export const ThinkingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isThinking, setIsThinking] = useState<boolean>(false);
  return <ThinkingContext.Provider value={{ isThinking, setIsThinking }}>{children}</ThinkingContext.Provider>;
};

export const useThinking = (): ThinkingContextValue => useContext(ThinkingContext);

export default ThinkingContext;
