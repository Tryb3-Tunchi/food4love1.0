import { redirect } from 'next/navigation'

// The old "Liked Chefs" list showed only likes you sent and linked every row to a
// chef page. Likes now live on the Matches page, with accurate status and the
// right profile for each person. This keeps old links and bookmarks working.
export default function LikesPage() {
  redirect('/matches?tab=sent')
}
