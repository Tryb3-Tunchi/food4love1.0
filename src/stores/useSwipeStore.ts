import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { Profile } from "@/types/db";

interface SwipeState {
  deck: Profile[];
  currentIndex: number;
  matchedProfile: Profile | null;
  showMatchCelebration: boolean;
  setDeck: (deck: Profile[]) => void;
  nextCard: () => void;
  setMatch: (p: Profile) => void;
  clearMatch: () => void;
}

export const useSwipeStore = create<SwipeState>()(
  immer((set) => ({
    deck: [],
    currentIndex: 0,
    matchedProfile: null,
    showMatchCelebration: false,
    setDeck: (deck) => set((s) => { s.deck = deck; s.currentIndex = 0; }),
    nextCard: () => set((s) => { s.currentIndex += 1; }),
    setMatch: (p) => set((s) => { s.matchedProfile = p; s.showMatchCelebration = true; }),
    clearMatch: () => set((s) => { s.matchedProfile = null; s.showMatchCelebration = false; }),
  }))
);
