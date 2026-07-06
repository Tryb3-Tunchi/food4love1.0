import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { CookStory, Profile } from "../types/db";

export type StoryWithCook = CookStory & { cook: Profile | null };

type UseStoriesState = {
  stories: StoryWithCook[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  postStory: (data: {
    title: string;
    description?: string;
    menu_items?: string[];
    photo_url?: string;
  }) => Promise<void>;
  deleteStory: (id: string) => Promise<void>;
};

export function useStories(userId: string | null): UseStoriesState {
  const [stories, setStories] = useState<StoryWithCook[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: storyRows } = await supabase
        .from("cook_stories")
        .select("*")
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(30);

      const rows = (storyRows as CookStory[]) ?? [];

      if (rows.length === 0) {
        setStories([]);
        setIsLoading(false);
        return;
      }

      const cookIds = [...new Set(rows.map((r) => r.cook_id))];
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("*")
        .in("id", cookIds);

      const profilesById = new Map(
        ((profileRows as Profile[]) ?? []).map((p) => [p.id, p]),
      );

      setStories(
        rows.map((s) => ({
          ...s,
          cook: profilesById.get(s.cook_id) ?? null,
        })),
      );
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const postStory = useCallback(
    async (data: {
      title: string;
      description?: string;
      menu_items?: string[];
      photo_url?: string;
    }) => {
      if (!userId) return;
      const { error } = await supabase.from("cook_stories").insert({
        cook_id: userId,
        title: data.title.trim(),
        description: data.description?.trim() ?? null,
        menu_items:
          (data.menu_items ?? []).filter(Boolean).length > 0
            ? data.menu_items
            : null,
        photo_url: data.photo_url ?? null,
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      if (error) throw error;
      await refresh();
    },
    [userId, refresh],
  );

  const deleteStory = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("cook_stories")
      .delete()
      .eq("id", id);
    if (error) throw error;
    setStories((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return useMemo(
    () => ({ stories, isLoading, refresh, postStory, deleteStory }),
    [stories, isLoading, refresh, postStory, deleteStory],
  );
}
