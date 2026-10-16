import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CookStory, Profile } from '../types/db'
import { saveStoryToPosts } from '../services/posts'

export type StoryWithCook = CookStory & { cook: Profile | null }
export type OwnedStory = CookStory & { savedAsPost: boolean }

type UseStoriesState = {
  stories: StoryWithCook[]
  ownedStories: OwnedStory[]
  isLoading: boolean
  isLoadingOwnedStories: boolean
  refresh: () => Promise<void>
  refreshOwnedStories: () => Promise<void>
  saveStory: (id: string) => ReturnType<typeof saveStoryToPosts>
  postStory: (data: {
    caption?: string
    image_url?: string
    video_url?: string
  }) => Promise<void>
  deleteStory: (id: string) => Promise<void>
}

export function useStories(userId: string | null): UseStoriesState {
  const [stories, setStories] = useState<StoryWithCook[]>([])
  const [ownedStories, setOwnedStories] = useState<OwnedStory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingOwnedStories, setIsLoadingOwnedStories] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: storyRows } = await supabase
        .from('stories')
        .select('*')
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(30)

      const rows = (storyRows as CookStory[]) ?? []

      if (rows.length === 0) {
        setStories([])
        setIsLoading(false)
        return
      }

      const cookIds = Array.from(new Set(rows.map((r) => r.cook_id)))
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', cookIds)

      const profilesById = new Map(
        ((profileRows as Profile[]) ?? []).map((p) => [p.id, p]),
      )

      setStories(
        rows.map((s) => ({
          ...s,
          cook: profilesById.get(s.cook_id) ?? null,
        })),
      )
    } catch {
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshOwnedStories = useCallback(async () => {
    if (!userId) {
      setOwnedStories([])
      setIsLoadingOwnedStories(false)
      return
    }

    setIsLoadingOwnedStories(true)
    try {
      const [
        { data: storyRows, error: storyError },
        { data: postRows, error: postError },
      ] = await Promise.all([
        supabase
          .from('stories')
          .select('*')
          .eq('cook_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('posts')
          .select('story_id')
          .eq('cook_id', userId)
          .not('story_id', 'is', null),
      ])

      if (storyError) throw storyError
      if (postError) throw postError

      const savedStoryIds = new Set(
        (postRows ?? []).map(
          (post: { story_id: string | null }) => post.story_id,
        ),
      )
      setOwnedStories(
        ((storyRows as CookStory[]) ?? []).map((story) => ({
          ...story,
          savedAsPost: savedStoryIds.has(story.id),
        })),
      )
    } finally {
      setIsLoadingOwnedStories(false)
    }
  }, [userId])

  useEffect(() => {
    refresh().catch(() => {})
    refreshOwnedStories().catch(() => {})
  }, [refresh, refreshOwnedStories])

  const saveStory = useCallback(async (id: string) => {
    const result = await saveStoryToPosts(id)
    setOwnedStories((previous) =>
      previous.map((story) =>
        story.id === id ? { ...story, savedAsPost: true } : story,
      ),
    )
    return result
  }, [])

  const postStory = useCallback(
    async (data: {
      caption?: string
      image_url?: string
      video_url?: string
    }) => {
      if (!userId) return
      const { error } = await supabase.from('stories').insert({
        cook_id: userId,
        caption: data.caption?.trim() || null,
        image_url: data.image_url ?? null,
        video_url: data.video_url ?? null,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      if (error) throw error
      await Promise.all([refresh(), refreshOwnedStories()])
    },
    [userId, refresh, refreshOwnedStories],
  )

  const deleteStory = useCallback(async (id: string) => {
    const { error } = await supabase.from('stories').delete().eq('id', id)
    if (error) throw error
    setStories((prev) => prev.filter((s) => s.id !== id))
    setOwnedStories((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return useMemo(
    () => ({
      stories,
      ownedStories,
      isLoading,
      isLoadingOwnedStories,
      refresh,
      refreshOwnedStories,
      saveStory,
      postStory,
      deleteStory,
    }),
    [
      stories,
      ownedStories,
      isLoading,
      isLoadingOwnedStories,
      refresh,
      refreshOwnedStories,
      saveStory,
      postStory,
      deleteStory,
    ],
  )
}
