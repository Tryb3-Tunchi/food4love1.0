import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface NotificationState {
  unreadMessages: number;
  newMatches: number;
  setUnreadMessages: (n: number) => void;
  setNewMatches: (n: number) => void;
  incrementMessages: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  immer((set) => ({
    unreadMessages: 0,
    newMatches: 0,
    setUnreadMessages: (n) => set((s) => { s.unreadMessages = n; }),
    setNewMatches: (n) => set((s) => { s.newMatches = n; }),
    incrementMessages: () => set((s) => { s.unreadMessages += 1; }),
  }))
);
