import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { UserStreak } from "../types/db";

type UseStreakState = {
  streak: UserStreak | null;
  isLoading: boolean;
  recordSwipe: () => Promise<UserStreak | null>;
};

export function useStreak(userId: string | null): UseStreakState {
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("user_streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setStreak((data as UserStreak) ?? null);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const recordSwipe = useCallback(async (): Promise<UserStreak | null> => {
    if (!userId) return null;
    const today = new Date().toISOString().slice(0, 10);

    try {
      if (streak) {
        if (streak.last_swipe_date === today) {
          return streak;
        }

        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);
        const continued = streak.last_swipe_date === yesterday;
        const newStreak = continued ? streak.current_streak + 1 : 1;
        const longestStreak = Math.max(newStreak, streak.longest_streak);

        const prevMilestone = Math.floor(streak.current_streak / 5);
        const newMilestone = Math.floor(newStreak / 5);
        const superLikeBonus = newMilestone > prevMilestone ? 1 : 0;

        const { data } = await supabase
          .from("user_streaks")
          .update({
            current_streak: newStreak,
            longest_streak: longestStreak,
            last_swipe_date: today,
            super_likes_available:
              streak.super_likes_available + superLikeBonus,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select("*")
          .single();

        const result = (data as UserStreak) ?? null;
        setStreak(result);
        return result;
      } else {
        const { data } = await supabase
          .from("user_streaks")
          .insert({
            user_id: userId,
            current_streak: 1,
            longest_streak: 1,
            last_swipe_date: today,
            super_likes_available: 0,
          })
          .select("*")
          .single();

        const result = (data as UserStreak) ?? null;
        setStreak(result);
        return result;
      }
    } catch {
      return null;
    }
  }, [userId, streak]);

  return useMemo(
    () => ({ streak, isLoading, recordSwipe }),
    [streak, isLoading, recordSwipe],
  );
}
