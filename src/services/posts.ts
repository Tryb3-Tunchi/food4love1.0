import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/types/db'

export async function getPostsByCook(cookId: string): Promise<Post[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, cook_id, story_id, image_url, video_url, caption, created_at')
    .eq('cook_id', cookId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Post[]
}

export async function saveStoryToPosts(storyId: string) {
  const supabase = createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) throw authError

  if (!user) {
    throw new Error('Please sign in to save a story.')
  }

  const { data: story, error: storyError } = await supabase
    .from('stories')
    .select('id, cook_id, image_url, video_url, caption')
    .eq('id', storyId)
    .eq('cook_id', user.id)
    .maybeSingle()

  if (storyError) throw storyError

  if (!story) {
    throw new Error('This story could not be found or you do not own it.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError) throw profileError

  if (profile.role !== 'cook') {
    throw new Error('Only chefs can publish permanent posts.')
  }

  const { data: existing, error: existingError } = await supabase
    .from('posts')
    .select('id')
    .eq('story_id', story.id)
    .maybeSingle()

  if (existingError) throw existingError

  if (existing) {
    return { postId: existing.id, alreadySaved: true }
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      cook_id: user.id,
      story_id: story.id,
      image_url: story.image_url,
      video_url: story.video_url,
      caption: story.caption,
    })
    .select('id')
    .single()

  if (postError) {
    // Protect against duplicate saves if two requests race.
    if (postError.code === '23505') {
      const { data: saved, error: lookupError } = await supabase
        .from('posts')
        .select('id')
        .eq('story_id', story.id)
        .maybeSingle()

      if (!lookupError && saved) {
        return { postId: saved.id, alreadySaved: true }
      }
    }

    throw postError
  }

  return { postId: post.id, alreadySaved: false }
}
