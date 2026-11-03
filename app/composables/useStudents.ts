import type { Student, Thesis, ThesisPanelMember } from '~/types/database'

export interface PanelistOption {
  panel_id: number
  full_name: string
  position: string | null
}

export interface ThesisMatchCandidate {
  full_name: string
  expertise: string
  similarity: number
}

export interface ThesisMatchResult {
  candidates: ThesisMatchCandidate[]
  isMatch: boolean
  response: string
  panel: ThesisPanelMember[] | null
}

export function useStudents() {
  const supabase = useSupabase()

  async function getProfile(userId: number): Promise<Student | null> {
    const { data, error } = await supabase.rpc('get_student_profile', { p_user_id: userId })
    if (error)
      throw error
    return data
  }

  async function getThesis(stuId: number): Promise<Thesis | null> {
    const { data, error } = await supabase.rpc('get_student_thesis', { p_stu_id: stuId })
    if (error)
      throw error
    return data
  }

  async function listPanelists(): Promise<PanelistOption[]> {
    const { data, error } = await supabase.rpc('list_panelists_public')
    if (error)
      throw error
    return data ?? []
  }

  async function submitThesis(stuId: number, payload: { title: string, link: string, adviserId: number | null }): Promise<Thesis> {
    const { data, error } = await supabase.rpc('submit_student_thesis', {
      p_stu_id: stuId,
      p_title: payload.title,
      p_link: payload.link,
      p_adviser_id: payload.adviserId,
    })
    if (error)
      throw error
    return data
  }

  /**
   * The RAG pipeline: embed the thesis title (the query),
   * semantically search panelist expertise, and auto-assign the
   * panel from candidates that clear the similarity threshold and
   * the LLM validator.
   */
  async function matchThesis(thesisId: number, title: string): Promise<ThesisMatchResult> {
    return $fetch<ThesisMatchResult>('/api/ai/match-thesis', {
      method: 'POST',
      body: { thesisId, title },
    })
  }

  async function getPanel(thesisId: number): Promise<ThesisPanelMember[]> {
    const { data, error } = await supabase.rpc('get_thesis_panel', { p_thesis_id: thesisId })
    if (error)
      throw error
    return data ?? []
  }

  return { getProfile, getThesis, listPanelists, submitThesis, matchThesis, getPanel }
}
