// A candidate is only considered a genuine fit if its expertise tag's
// cosine similarity to the thesis title is at least this close.
const MATCH_THRESHOLD = 0.8

interface RequestBody {
  thesisId: number
  title: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  if (!body?.title?.trim() || !body?.thesisId)
    throw createError({ statusCode: 400, statusMessage: 'thesisId and title are required' })

  const supabase = useSupabaseAdmin()

  // 1+2. The title is the query — embed it.
  const queryEmbedding = await embedText(body.title)

  // Persist it on the thesis row (also makes it available for any
  // future re-matching without re-embedding).
  await supabase.rpc('set_thesis_embedding', { p_thesis_id: body.thesisId, p_embedding: queryEmbedding })

  // 3. Semantic search: retrieve the closest panelist expertise
  // tags across all programs by cosine similarity. Fetch wide: the
  // threshold decides who qualifies, not this limit, and one panelist
  // can hold several of the closest tags.
  const { data: candidates, error: matchError } = await supabase.rpc('match_panelist_expertise', {
    p_query_embedding: queryEmbedding,
    p_match_count: 50,
  })
  if (matchError)
    throw createError({ statusCode: 500, statusMessage: matchError.message })

  const closeMatches = ((candidates ?? []) as Array<{ panel_id: number, full_name: string, expertise: string, similarity: number }>)
    .filter(c => c.similarity >= MATCH_THRESHOLD)

  // Validator: nothing is assigned unless Gemini approves it, so a
  // failed check stops the match rather than skipping the check.
  const closeAreas = [...new Set(closeMatches.map(c => c.expertise))]
  let matchedAreas: string[] = []
  if (closeAreas.length) {
    try {
      matchedAreas = await validateExpertise(body.title, closeAreas)
    }
    catch (error) {
      console.error(error)
      throw createError({ statusCode: 502, statusMessage: 'Could not validate the panel match. Please try again.' })
    }
  }

  const candidateList = closeMatches.filter(c => matchedAreas.includes(c.expertise))
  const isMatch = candidateList.length > 0

  const response = isMatch
    ? `Found panelists whose tagged expertise closely matches this topic: ${matchedAreas.join(', ')}.`
    : 'No panelists with closely matching expertise were found yet.'

  // 4. On a good match, fill the panel from the validated candidates.
  let panel = null
  if (isMatch) {
    const { data: panelData, error: assignError } = await supabase.rpc('auto_assign_panel', {
      p_thesis_id: body.thesisId,
      p_query_embedding: queryEmbedding,
      p_panel_ids: [...new Set(candidateList.map(c => c.panel_id))],
    })
    if (assignError)
      throw createError({ statusCode: 500, statusMessage: assignError.message })
    panel = panelData
  }

  // 5. Everything the student sees.
  return { candidates: candidateList, isMatch, response, panel }
})
