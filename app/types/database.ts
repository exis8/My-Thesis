export interface Role {
  id: number
  role_name: 'admin' | 'student'
  description: string | null
  created_at: string
}

export interface UserCredential {
  id: number
  role_id: number
  email: string
  password: string
  status: 'active' | 'disabled'
  created_at: string
}

export interface ProgramChairperson {
  pgchair_id: number
  user_id: number
  full_name: string
  program: string
  position: string | null
  status: string | null
  share_token: string
  created_at: string
}

export interface Student {
  stu_id: number
  user_id: number
  student_name: string
  partner_name: string | null
  program: string | null
  course: string | null
  created_at: string
}

export interface Thesis {
  thesis_id: number
  stu_id: number
  title: string
  link: string | null
  adviser_id: number | null
  created_at: string
}

export interface Panelist {
  panel_id: number
  full_name: string
  position: string | null
  program: string
  status: string | null
  created_at: string
}

export interface Expertise {
  exs_id: number
  panel_id: number
  expertise: string
  created_at: string
}

export interface AssignedPanelist {
  assign_id: number
  role: 'chair' | 'member'
  panel_id: number
  thesis_id: number
  created_at: string
}

export interface ThesisPanelMember {
  assign_id: number
  role: 'chair' | 'member'
  panel_id: number
  full_name: string
  position: string | null
}
