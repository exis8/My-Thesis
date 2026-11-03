<script setup lang="ts">
import { Crown } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import type { AdminThesisPanelMember } from '~/composables/useAdmin'

interface SharedStudent {
  stu_id: number
  student_name: string
  partner_name: string | null
  course: string | null
  title: string | null
  adviser_name: string | null
  panel: AdminThesisPanelMember[]
}

const route = useRoute()
const supabase = useSupabase()

// Public read-only view of one program's students, reached via the chairperson's share link.
const { data, error } = await useAsyncData(`shared-students-${route.params.token}`, async () => {
  const { data, error } = await supabase.rpc('public_list_students', { p_token: route.params.token })
  if (error)
    throw error
  return data as { program: string, students: SharedStudent[] } | null
})

if (error.value || !data.value)
  throw createError({ statusCode: 404, statusMessage: 'This link is invalid or has expired', fatal: true })

useHead({ title: `Students — ${data.value.program}` })

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = data.value?.students ?? []
  if (!q)
    return list
  return list.filter(s => [s.student_name, s.partner_name, s.title, s.adviser_name, ...s.panel.map(m => m.full_name)]
    .some(v => v?.toLowerCase().includes(q)))
})
</script>

<template>
  <main v-if="data" class="mx-auto max-w-6xl space-y-4 px-4 py-8">
    <div>
      <h1 class="text-2xl font-bold">Students</h1>
      <p class="text-sm text-muted-foreground">{{ data.program }}</p>
    </div>

    <Input v-model="search" type="search" placeholder="Search name, title, adviser or panelist" class="h-9 sm:w-80" aria-label="Search students" />

    <div v-if="filtered.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {{ data.students.length === 0 ? 'No students have registered yet.' : 'No students match your search.' }}
    </div>
    <div v-else class="overflow-x-auto rounded-lg border bg-card">
      <table class="w-full min-w-[48rem] text-sm">
        <thead class="border-b bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th scope="col" class="px-4 py-2.5 font-medium">Student</th>
            <th scope="col" class="px-4 py-2.5 font-medium">Thesis</th>
            <th scope="col" class="px-4 py-2.5 font-medium">Adviser</th>
            <th scope="col" class="px-4 py-2.5 font-medium">Panel</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          <tr v-for="student in filtered" :key="student.stu_id" class="align-top">
            <td class="px-4 py-3">
              <p class="font-medium">{{ student.student_name }}</p>
              <p v-if="student.partner_name" class="font-medium">{{ student.partner_name }}</p>
              <p v-if="student.course" class="text-xs text-muted-foreground">{{ student.course }}</p>
            </td>
            <td class="max-w-xs px-4 py-3">
              <p v-if="student.title">{{ student.title }}</p>
              <Badge v-else variant="outline">Not submitted</Badge>
            </td>
            <td class="px-4 py-3 text-muted-foreground">{{ student.adviser_name || '—' }}</td>
            <td class="px-4 py-3">
              <span v-if="!student.title" class="text-muted-foreground">—</span>
              <Badge v-else-if="student.panel.length === 0" variant="outline">Pending</Badge>
              <ul v-else class="space-y-1.5">
                <li v-for="m in student.panel" :key="m.full_name" class="flex items-center gap-2">
                  <Crown v-if="m.role === 'chair'" class="size-3.5 shrink-0 text-accent-foreground" aria-label="Chair" />
                  <span v-else class="size-3.5 shrink-0" />
                  <span class="font-medium">{{ m.full_name }}</span>
                  <Badge :variant="m.role === 'chair' ? 'default' : 'secondary'">{{ m.role === 'chair' ? 'Chair' : 'Member' }}</Badge>
                </li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-muted-foreground">{{ filtered.length }} of {{ data.students.length }} students</p>
  </main>
</template>
