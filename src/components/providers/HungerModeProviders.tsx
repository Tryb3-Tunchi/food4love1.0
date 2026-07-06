"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

interface HungerModeCtx {
  hungerMode: boolean;
  toggleHungerMode: () => void;
}

const Ctx = createContext<HungerModeCtx>({
  hungerMode: false,
  toggleHungerMode: () => {},
});

export function HungerModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hungerMode, setHungerMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("f4l-hunger");
    if (saved === "true") {
      setHungerMode(true);
      document.documentElement.classList.add("hunger");
    }
  }, []);

  const toggleHungerMode = useCallback(() => {
    setHungerMode((prev) => {
      const next = !prev;
      localStorage.setItem("f4l-hunger", String(next));
      if (next) {
        document.documentElement.classList.add("hunger");
      } else {
        document.documentElement.classList.remove("hunger");
      }
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ hungerMode, toggleHungerMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useHungerMode = () => useContext(Ctx);
