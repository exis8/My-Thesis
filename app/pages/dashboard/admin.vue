<script setup lang="ts">
import {
  AlertCircle,
  ArrowRight,
  Check,
  Search,
  CheckCircle2,
  Clock,
  Crown,
  Download,
  Ellipsis,
  LayoutDashboard,
  LayoutGrid,
  Link as LinkIcon,
  List,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserCog,
  UserRound,
  Users,
  X,
} from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useClipboard, useTransition } from '@vueuse/core'
import type { AdminPanelistEntry, AdminStudentEntry, AdminThesisPanelMember } from '~/composables/useAdmin'
import type { ProgramChairperson } from '~/types/database'

definePageMeta({ middleware: 'dashboard', role: 'admin' })

const navItems = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'students', label: 'Students', icon: Users },
  { key: 'panelists', label: 'Panelists', icon: UserCog },
]

const active = ref('overview')
const authUser = useAuthUser()
const admin = useAdmin()

const isLoading = ref(true)
const ready = ref(false)
const errorMessage = ref('')
const profile = ref<ProgramChairperson | null>(null)
const students = ref<AdminStudentEntry[]>([])
const panelists = ref<AdminPanelistEntry[]>([])

async function loadData() {
  if (!authUser.value)
    return
  isLoading.value = true
  errorMessage.value = ''
  try {
    profile.value = await admin.getProfile(authUser.value.id)
    if (profile.value) {
      const [studentRows, panelistRows] = await Promise.all([
        admin.listStudents(profile.value.program),
        admin.listPanelists(profile.value.program),
      ])
      students.value = studentRows
      panelists.value = panelistRows
    }
  }
  catch (error: any) {
    errorMessage.value = error?.message ?? 'Failed to load dashboard data.'
  }
  finally {
    isLoading.value = false
    // Let bars mount at 0, then grow to their value.
    await nextTick()
    requestAnimationFrame(() => {
      ready.value = true
    })
  }
}

async function refreshPanelists() {
  if (!profile.value)
    return
  panelists.value = await admin.listPanelists(profile.value.program)
}

async function logout() {
  authUser.value = null
  await navigateTo('/login')
}

const submittedCount = computed(() => students.value.filter(s => s.title).length)
const pendingCount = computed(() => students.value.length - submittedCount.value)
const submissionRate = computed(() => students.value.length === 0
  ? 0
  : Math.round((submittedCount.value / students.value.length) * 100))

const overviewChartData = computed(() => [
  { label: 'Students', value: students.value.length },
  { label: 'Submitted', value: submittedCount.value },
  { label: 'Pending', value: students.value.length - submittedCount.value },
])

function isPanelComplete(student: AdminStudentEntry) {
  return student.panel.some(p => p.role === 'chair') && student.panel.filter(p => p.role === 'member').length >= 2
}

const completePanelCount = computed(() => students.value.filter(s => s.title && isPanelComplete(s)).length)
const incompleteStudents = computed(() => students.value.filter(s => s.title && !isPanelComplete(s)))
const pendingStudents = computed(() => students.value.filter(s => !s.title))

type StudentFilter = 'all' | 'submitted' | 'pending' | 'incomplete'
const studentFilter = ref<StudentFilter>('all')
const studentSearch = ref('')

const filterOptions = computed(() => [
  { key: 'all' as const, label: 'All', count: students.value.length },
  { key: 'submitted' as const, label: 'Submitted', count: submittedCount.value },
  { key: 'pending' as const, label: 'Not submitted', count: pendingCount.value },
  { key: 'incomplete' as const, label: 'Panel incomplete', count: incompleteStudents.value.length },
])

const filteredStudents = computed(() => {
  const q = studentSearch.value.trim().toLowerCase()
  return students.value.filter((s) => {
    if (studentFilter.value === 'submitted' && !s.title)
      return false
    if (studentFilter.value === 'pending' && s.title)
      return false
    if (studentFilter.value === 'incomplete' && !(s.title && !isPanelComplete(s)))
      return false
    if (!q)
      return true
    return [s.student_name, s.partner_name, s.email, s.title, s.adviser_name].some(v => v?.toLowerCase().includes(q))
  })
})

function openStudents(filter: StudentFilter) {
  studentFilter.value = filter
  studentSearch.value = ''
  active.value = 'students'
}

// Same as c_max_assignments in auto_assign_panel: a full panelist is skipped.
const PANEL_CAP = 5

const panelistView = ref<'list' | 'cards'>('list')

const panelistSearch = ref('')
const filteredPanelists = computed(() => {
  const q = panelistSearch.value.trim().toLowerCase()
  if (!q)
    return panelists.value
  return panelists.value.filter(p =>
    p.full_name.toLowerCase().includes(q)
    || p.expertise.some(e => e.expertise.toLowerCase().includes(q)),
  )
})

const workload = computed(() => [...panelists.value].sort((a, b) => b.assignment_count - a.assignment_count))
const maxWorkload = computed(() => Math.max(1, ...panelists.value.map(p => p.assignment_count)))

const countStudents = useTransition(() => students.value.length, { duration: 900 })
const countSubmitted = useTransition(() => submittedCount.value, { duration: 900 })
const countComplete = useTransition(() => completePanelCount.value, { duration: 900 })
const countPanelists = useTransition(() => panelists.value.length, { duration: 900 })

const stats = computed(() => [
  { label: 'Students', value: countStudents.value, note: 'registered', ratio: 100, icon: Users, tone: 'bg-secondary text-secondary-foreground' },
  { label: 'Thesis submitted', value: countSubmitted.value, note: `${submissionRate.value}% of students`, ratio: submissionRate.value, icon: CheckCircle2, tone: 'bg-primary/10 text-primary' },
  { label: 'Panels complete', value: countComplete.value, note: `of ${submittedCount.value} submitted`, ratio: submittedCount.value ? (completePanelCount.value / submittedCount.value) * 100 : 0, icon: Crown, tone: 'bg-accent text-accent-foreground' },
  { label: 'Panelists', value: countPanelists.value, note: 'in your program', ratio: 100, icon: UserCog, tone: 'bg-secondary text-secondary-foreground' },
])

function sortedPanel(panel: AdminThesisPanelMember[]) {
  return [...panel].sort((a, b) => (a.role === b.role ? 0 : a.role === 'chair' ? -1 : 1))
}

function initials(name: string) {
  return name.replace(/^(dr|engr|prof|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
}

function panelChairName(panel: AdminThesisPanelMember[]) {
  return panel.find(p => p.role === 'chair')?.full_name
}

function panelMemberNames(panel: AdminThesisPanelMember[]) {
  return panel.filter(p => p.role === 'member').map(p => p.full_name)
}

// ---- Add panelist ----
const isAddOpen = ref(false)
const addForm = ref({ fullName: '', position: '' })
const addExpertiseTags = ref<string[]>([])
const addExpertiseInput = ref('')
const isSavingPanelist = ref(false)
const addError = ref('')

function addExpertiseTagToForm() {
  const value = addExpertiseInput.value.trim()
  if (value && !addExpertiseTags.value.includes(value))
    addExpertiseTags.value.push(value)
  addExpertiseInput.value = ''
}

function removeExpertiseTagFromForm(tag: string) {
  addExpertiseTags.value = addExpertiseTags.value.filter(t => t !== tag)
}

async function submitAddPanelist() {
  if (!profile.value)
    return
  addExpertiseTagToForm()
  isSavingPanelist.value = true
  addError.value = ''
  try {
    const created = await admin.registerPanelist({
      fullName: addForm.value.fullName.trim(),
      position: addForm.value.position.trim(),
      program: profile.value.program,
    })
    for (const tag of addExpertiseTags.value)
      await admin.addExpertise(created.panel_id, tag)

    isAddOpen.value = false
    addForm.value = { fullName: '', position: '' }
    addExpertiseTags.value = []
    await refreshPanelists()
  }
  catch (error: any) {
    addError.value = error?.message ?? 'Failed to add panelist.'
  }
  finally {
    isSavingPanelist.value = false
  }
}

// ---- Edit panelist ----
const isEditOpen = ref(false)
const editTarget = ref<AdminPanelistEntry | null>(null)
const editForm = ref({ fullName: '', position: '' })
const isSavingEdit = ref(false)

function openEdit(panelist: AdminPanelistEntry) {
  editTarget.value = panelist
  editForm.value = { fullName: panelist.full_name, position: panelist.position ?? '' }
  isEditOpen.value = true
}

async function submitEditPanelist() {
  if (!editTarget.value)
    return
  isSavingEdit.value = true
  try {
    await admin.updatePanelist(editTarget.value.panel_id, {
      fullName: editForm.value.fullName.trim(),
      position: editForm.value.position.trim(),
    })
    isEditOpen.value = false
    await refreshPanelists()
  }
  catch (error: any) {
    errorMessage.value = error?.message ?? 'Failed to update panelist.'
  }
  finally {
    isSavingEdit.value = false
  }
}

// ---- Delete student ----
const isStudentDeleteOpen = ref(false)
const studentDeleteTarget = ref<AdminStudentEntry | null>(null)
const isDeletingStudent = ref(false)

function confirmDeleteStudent(student: AdminStudentEntry) {
  studentDeleteTarget.value = student
  isStudentDeleteOpen.value = true
}

async function submitDeleteStudent() {
  if (!studentDeleteTarget.value || !profile.value)
    return
  isDeletingStudent.value = true
  try {
    await admin.deleteThesis(studentDeleteTarget.value.stu_id, profile.value.program)
    isStudentDeleteOpen.value = false
    const [studentRows, panelistRows] = await Promise.all([
      admin.listStudents(profile.value.program),
      admin.listPanelists(profile.value.program),
    ])
    students.value = studentRows
    panelists.value = panelistRows
  }
  catch (error: any) {
    errorMessage.value = error?.message ?? 'Failed to delete the submission.'
  }
  finally {
    isDeletingStudent.value = false
  }
}

// ---- Export students to Excel (honours the current search and filter) ----
async function exportStudents() {
  const { Workbook } = await import('exceljs')
  const wb = new Workbook()
  const ws = wb.addWorksheet('Students')
  ws.columns = [
    { header: 'Student', key: 'name', width: 28 },
    { header: 'Partner', key: 'partner', width: 28 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Course', key: 'course', width: 20 },
    { header: 'Thesis title', key: 'title', width: 50 },
    { header: 'Link', key: 'link', width: 40 },
    { header: 'Adviser', key: 'adviser', width: 28 },
    { header: 'Panel chair', key: 'chair', width: 28 },
    { header: 'Panel members', key: 'members', width: 40 },
  ]
  ws.getRow(1).font = { bold: true }
  for (const s of filteredStudents.value) {
    ws.addRow({
      name: s.student_name,
      partner: s.partner_name ?? '',
      email: s.email,
      course: s.course ?? '',
      title: s.title ?? '',
      link: s.link ?? '',
      adviser: s.adviser_name ?? '',
      chair: s.panel.find(m => m.role === 'chair')?.full_name ?? '',
      members: s.panel.filter(m => m.role === 'member').map(m => m.full_name).join(', '),
    })
  }
  const buffer = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `students-${profile.value?.program ?? 'list'}.xlsx`.replace(/\s+/g, '-')
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Shareable read-only student list ----
const { copy: copyToClipboard, copied: shareLinkCopied } = useClipboard({ copiedDuring: 2000, legacy: true })

function copyShareLink() {
  if (profile.value)
    copyToClipboard(`${window.location.origin}/students/${profile.value.share_token}`)
}

// ---- Delete panelist ----
const isDeleteOpen = ref(false)
const deleteTarget = ref<AdminPanelistEntry | null>(null)
const isDeleting = ref(false)

function confirmDelete(panelist: AdminPanelistEntry) {
  deleteTarget.value = panelist
  isDeleteOpen.value = true
}

async function submitDeletePanelist() {
  if (!deleteTarget.value)
    return
  isDeleting.value = true
  try {
    await admin.deletePanelist(deleteTarget.value.panel_id)
    isDeleteOpen.value = false
    await refreshPanelists()
  }
  catch (error: any) {
    errorMessage.value = error?.message ?? 'Failed to delete panelist.'
  }
  finally {
    isDeleting.value = false
  }
}

// ---- Expertise tags ----
const newExpertise = ref<Record<number, string>>({})

async function submitAddExpertise(panelId: number) {
  const value = (newExpertise.value[panelId] ?? '').trim()
  if (!value)
    return
  try {
    await admin.addExpertise(panelId, value)
    newExpertise.value[panelId] = ''
    await refreshPanelists()
  }
  catch (error: any) {
    errorMessage.value = error?.message ?? 'Failed to add expertise.'
  }
}

async function submitRemoveExpertise(exsId: number) {
  try {
    await admin.removeExpertise(exsId)
    await refreshPanelists()
  }
  catch (error: any) {
    errorMessage.value = error?.message ?? 'Failed to remove expertise.'
  }
}

onMounted(loadData)
</script>

<template>
  <DashboardSidebar
    title="Chairperson Dashboard"
    :nav-items="navItems"
    :active="active"
    :user-email="authUser?.email"
    @update:active="active = $event"
    @logout="logout"
  >
    <Transition name="pop">
    <div v-if="errorMessage" class="mb-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle class="mt-0.5 size-4 shrink-0" />
      <span>{{ errorMessage }}</span>
    </div>
    </Transition>

    <div v-if="isLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 class="size-4 animate-spin" />
      Loading dashboard data...
    </div>

    <template v-else-if="!profile">
      <p class="text-sm text-muted-foreground">
        We couldn't find your chairperson profile yet. Please contact a system administrator.
      </p>
    </template>

    <template v-else>
      <section v-if="active === 'overview'" class="space-y-8">
        <div>
          <h1 class="text-2xl font-bold">
            Overview
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ profile.program }}
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div v-for="stat in stats" :key="stat.label" class="rounded-lg border bg-card p-5 transition-colors hover:border-primary/40">
            <div class="flex items-center justify-between">
              <dt class="text-sm text-muted-foreground">{{ stat.label }}</dt>
              <span class="flex size-8 items-center justify-center rounded-md" :class="stat.tone">
                <component :is="stat.icon" class="size-4" />
              </span>
            </div>
            <dd class="mt-3 font-heading text-3xl font-bold tabular-nums">{{ Math.round(stat.value) }}</dd>
            <p class="mt-1 text-xs text-muted-foreground">{{ stat.note }}</p>
            <div class="mt-3 h-1 rounded-full bg-muted">
              <div class="h-full rounded-full bg-primary/70 transition-[width] duration-1000 ease-out motion-reduce:transition-none" :style="{ width: (ready ? stat.ratio : 0) + '%' }" />
            </div>
          </div>
        </dl>

        <div>
          <div class="mb-2 flex items-baseline justify-between text-sm">
            <h2 class="font-heading font-semibold">Submission progress</h2>
            <span class="tabular-nums text-muted-foreground">{{ submittedCount }} of {{ students.length }}</span>
          </div>
          <div class="flex h-3 overflow-hidden rounded-full bg-muted" role="img" :aria-label="`${submittedCount} of ${students.length} students have submitted`">
            <div class="bg-primary transition-[width] duration-1000 ease-out motion-reduce:transition-none" :style="{ width: (ready ? submissionRate : 0) + '%' }" />
          </div>
        </div>

        <div class="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 class="mb-3 font-heading font-semibold">Needs attention</h2>
            <div v-if="pendingStudents.length === 0 && incompleteStudents.length === 0" class="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Everyone has submitted and every panel is complete.
            </div>
            <ul v-else class="divide-y rounded-lg border bg-card">
              <li v-if="pendingStudents.length">
                <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60" @click="openStudents('pending')">
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium">{{ pendingStudents.length }} student{{ pendingStudents.length === 1 ? '' : 's' }} not submitted</span>
                    <span class="block truncate text-xs text-muted-foreground">{{ pendingStudents.slice(0, 3).map(s => s.student_name).join(', ') }}{{ pendingStudents.length > 3 ? '...' : '' }}</span>
                  </span>
                  <ArrowRight class="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
              <li v-if="incompleteStudents.length">
                <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60" @click="openStudents('incomplete')">
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-medium">{{ incompleteStudents.length }} panel{{ incompleteStudents.length === 1 ? '' : 's' }} incomplete</span>
                    <span class="block truncate text-xs text-muted-foreground">Add expertise tags to panelists so matching can fill them.</span>
                  </span>
                  <ArrowRight class="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h2 class="mb-3 font-heading font-semibold">Panel workload</h2>
            <p v-if="panelists.length === 0" class="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              No panelists yet. Add one in the Panelists tab.
            </p>
            <ul v-else class="space-y-3 rounded-lg border bg-card p-4">
              <li v-for="(p, i) in workload.slice(0, 6)" :key="p.panel_id">
                <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span class="truncate">{{ p.full_name }}</span>
                  <span class="shrink-0 tabular-nums text-muted-foreground">{{ p.assignment_count }}</span>
                </div>
                <div class="h-1.5 rounded-full bg-muted">
                  <div class="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none" :style="{ width: (ready ? (p.assignment_count / maxWorkload) * 100 : 0) + '%', transitionDelay: i * 80 + 'ms' }" />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-else-if="active === 'students'" class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold">Students</h1>
            <p class="text-sm text-muted-foreground">{{ profile.program }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" @click="copyShareLink">
              <Check v-if="shareLinkCopied" class="size-4" />
              <LinkIcon v-else class="size-4" />
              <span aria-live="polite">{{ shareLinkCopied ? 'Link copied' : 'Copy share link' }}</span>
            </Button>
            <Button variant="outline" :disabled="filteredStudents.length === 0" @click="exportStudents">
              <Download class="size-4" />
              Download Excel
            </Button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="relative w-full sm:w-72">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="studentSearch" type="search" placeholder="Search name, email, title or adviser" class="h-9 pl-9" aria-label="Search students" />
          </div>
          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter students">
            <button
              v-for="f in filterOptions"
              :key="f.key"
              type="button"
              :aria-pressed="studentFilter === f.key"
              class="rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring"
              :class="studentFilter === f.key ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-primary hover:text-foreground'"
              @click="studentFilter = f.key"
            >
              {{ f.label }}
              <span class="ml-1 tabular-nums opacity-70">{{ f.count }}</span>
            </button>
          </div>
        </div>

        <div v-if="students.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No students have registered yet.
        </div>
        <div v-else-if="filteredStudents.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No students match. Clear the search or pick another filter.
        </div>
        <div v-else class="overflow-x-auto rounded-lg border bg-card">
          <table class="w-full min-w-[64rem] text-sm">
            <thead class="border-b bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th scope="col" class="px-4 py-2.5 font-medium">Student</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Thesis</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Link</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Adviser</th>
                <th scope="col" class="px-4 py-2.5 font-medium">Panel</th>
                <th scope="col" class="px-4 py-2.5 font-medium"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <TransitionGroup tag="tbody" name="row" class="divide-y">
              <tr v-for="student in filteredStudents" :key="student.stu_id" class="align-top transition-colors hover:bg-muted/40">
                <td class="px-4 py-3">
                  <p class="font-medium">{{ student.student_name }}</p>
                  <p v-if="student.partner_name" class="font-medium">{{ student.partner_name }}</p>
                  <p class="text-xs text-muted-foreground">{{ student.email }}</p>
                  <p v-if="student.course" class="text-xs text-muted-foreground">{{ student.course }}</p>
                </td>
                <td class="max-w-xs px-4 py-3">
                  <template v-if="student.title">
                    <p class="line-clamp-2" :title="student.title">{{ student.title }}</p>
                  </template>
                  <Badge v-else variant="outline">Not submitted</Badge>
                </td>
                <td class="px-4 py-3">
                  <a v-if="student.link" :href="student.link" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-primary hover:underline">
                    <LinkIcon class="size-3.5" />
                    Open
                  </a>
                  <span v-else class="text-muted-foreground">—</span>
                </td>
                <td class="px-4 py-3 text-muted-foreground">{{ student.adviser_name || '—' }}</td>
                <td class="px-4 py-3">
                  <span v-if="!student.title" class="text-muted-foreground">—</span>
                  <Badge v-else-if="student.panel.length === 0" variant="outline">Pending</Badge>
                  <ul v-else class="space-y-2">
                    <li v-for="m in sortedPanel(student.panel)" :key="m.full_name" class="flex items-start gap-2">
                      <Crown v-if="m.role === 'chair'" class="mt-0.5 size-3.5 shrink-0 text-accent-foreground" aria-label="Chair" />
                      <span v-else class="mt-0.5 size-3.5 shrink-0" />
                      <span class="min-w-0">
                        <span class="flex flex-wrap items-center gap-1.5">
                          <span class="font-medium leading-tight">{{ m.full_name }}</span>
                          <Badge :variant="m.role === 'chair' ? 'default' : 'secondary'">{{ m.role === 'chair' ? 'Chair' : 'Member' }}</Badge>
                        </span>
                        <span v-if="m.position" class="block text-xs text-muted-foreground">{{ m.position }}</span>
                      </span>
                    </li>
                    <li v-if="!isPanelComplete(student)"><Badge variant="outline">Incomplete</Badge></li>
                  </ul>
                </td>
                <td class="px-4 py-3 text-right">
                  <Button v-if="student.thesis_id" variant="ghost" size="icon" class="size-8 text-destructive" :aria-label="`Delete submission of ${student.student_name}`" @click="confirmDeleteStudent(student)">
                    <Trash2 class="size-4" />
                  </Button>
                </td>
              </tr>
            </TransitionGroup>
          </table>
        </div>
        <p v-if="students.length" class="text-xs text-muted-foreground">
          Showing {{ filteredStudents.length }} of {{ students.length }} students.
        </p>

        <Dialog v-model:open="isStudentDeleteOpen">
          <DialogContent class="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete submission of {{ studentDeleteTarget?.student_name }}?</DialogTitle>
              <DialogDescription>
                This removes the thesis title, link, adviser and assigned panel. Their account stays and they can submit again. The panelists become available for other students. This can't be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" :disabled="isDeletingStudent" @click="isStudentDeleteOpen = false">
                Cancel
              </Button>
              <Button variant="destructive" :disabled="isDeletingStudent" @click="submitDeleteStudent">
                <Loader2 v-if="isDeletingStudent" class="size-4 animate-spin" />
                <Trash2 v-else class="size-4" />
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section v-else-if="active === 'panelists'" class="space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold">Panelists</h1>
            <p class="text-sm text-muted-foreground">
              {{ profile.program }} &middot; manage panelist records and their tagged expertise areas.
            </p>
          </div>

          <Dialog v-model:open="isAddOpen">
            <DialogTrigger as-child>
              <Button>
                <Plus class="size-4" />
                Add panelist
              </Button>
            </DialogTrigger>
            <DialogContent class="max-w-sm">
              <DialogHeader>
                <DialogTitle>Add panelist</DialogTitle>
                <DialogDescription>
                  Adds a panelist record for {{ profile.program }}. Panelists don't sign in — they're managed entirely from here.
                </DialogDescription>
              </DialogHeader>
              <form class="space-y-4" @submit.prevent="submitAddPanelist">
                <Transition name="pop">
                <div v-if="addError" class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle class="mt-0.5 size-4 shrink-0" />
                  <span>{{ addError }}</span>
                </div>
                </Transition>
                <div class="flex flex-col gap-2">
                  <Label for="panelist-name">Full name</Label>
                  <Input id="panelist-name" v-model="addForm.fullName" placeholder="e.g. Dr. Juan Dela Cruz" required />
                </div>
                <div class="flex flex-col gap-2">
                  <Label for="panelist-position">Position</Label>
                  <Input id="panelist-position" v-model="addForm.position" placeholder="e.g. Associate Professor" />
                </div>
                <div class="flex flex-col gap-2">
                  <Label for="panelist-expertise">Expertise areas</Label>
                  <div class="flex items-center gap-1.5">
                    <Input
                      id="panelist-expertise"
                      v-model="addExpertiseInput"
                      placeholder="e.g. Machine Learning"
                      @keydown.enter.prevent="addExpertiseTagToForm"
                    />
                    <Button type="button" size="icon" variant="outline" class="size-8 shrink-0" @click="addExpertiseTagToForm">
                      <Plus class="size-3.5" />
                    </Button>
                  </div>
                  <div v-if="addExpertiseTags.length > 0" class="flex flex-wrap gap-1.5">
                    <Badge v-for="tag in addExpertiseTags" :key="tag" variant="secondary" class="gap-1 pr-1">
                      {{ tag }}
                      <button type="button" :aria-label="`Remove ${tag}`" class="rounded-full p-0.5 hover:bg-foreground/10" @click="removeExpertiseTagFromForm(tag)">
                        <X class="size-3" />
                      </button>
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground">Press Enter or + to add each area. Each one is embedded for semantic matching once saved.</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" :disabled="isSavingPanelist" @click="isAddOpen = false">
                    Cancel
                  </Button>
                  <Button type="submit" :disabled="isSavingPanelist">
                    <Loader2 v-if="isSavingPanelist" class="size-4 animate-spin" />
                    Add panelist
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div v-if="panelists.length === 0" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No panelists yet. Add one to start auto-assigning panels.
        </div>

        <div v-if="panelists.length > 0" class="flex flex-wrap items-center justify-between gap-3">
          <div class="relative w-full sm:w-72">
            <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="panelistSearch" type="search" placeholder="Search name or expertise" class="h-9 pl-9" aria-label="Search panelists" />
          </div>
          <div class="flex gap-1.5" role="group" aria-label="Panelist layout">
            <button
              v-for="v in [{ key: 'list', label: 'List', icon: List }, { key: 'cards', label: 'Cards', icon: LayoutGrid }] as const"
              :key="v.key"
              type="button"
              :aria-pressed="panelistView === v.key"
              class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring"
              :class="panelistView === v.key ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-primary hover:text-foreground'"
              @click="panelistView = v.key"
            >
              <component :is="v.icon" class="size-3.5" />
              {{ v.label }}
            </button>
          </div>
        </div>
        <p v-if="panelists.length > 0 && filteredPanelists.length === 0" class="text-sm text-muted-foreground">
          No panelists match your search.
        </p>

        <!-- One markup for both layouts; cards reuse the stacked (mobile) row order. -->
        <TransitionGroup
          v-if="filteredPanelists.length > 0"
          tag="ul"
          name="row"
          :class="panelistView === 'list' ? 'divide-y rounded-lg border bg-card' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'"
        >
          <li
            v-for="panelist in filteredPanelists"
            :key="panelist.panel_id"
            class="grid gap-x-6 gap-y-3 p-4"
            :class="panelistView === 'list' ? 'sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_auto] sm:items-start' : 'content-start rounded-lg border bg-card'"
          >
            <div class="flex min-w-0 items-center gap-3">
              <Avatar class="size-10 shrink-0">
                <AvatarFallback class="bg-secondary font-heading text-sm font-semibold text-secondary-foreground">
                  {{ initials(panelist.full_name) }}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <p class="truncate font-heading font-semibold leading-tight">{{ panelist.full_name }}</p>
                <p class="truncate text-sm text-muted-foreground">{{ panelist.position || 'No position set' }}</p>
              </div>
            </div>

            <div class="order-last min-w-0" :class="panelistView === 'list' && 'sm:order-none'">
              <div class="flex flex-wrap items-center gap-1.5">
                <Badge v-for="tag in panelist.expertise" :key="tag.exs_id" variant="secondary" class="h-auto gap-1 whitespace-normal py-0.5 pr-1">
                  {{ tag.expertise }}
                  <button type="button" :aria-label="`Remove ${tag.expertise}`" class="rounded-full p-0.5 hover:bg-foreground/10" @click="submitRemoveExpertise(tag.exs_id)">
                    <X class="size-3" />
                  </button>
                </Badge>
                <form class="flex items-center gap-1" @submit.prevent="submitAddExpertise(panelist.panel_id)">
                  <Input v-model="newExpertise[panelist.panel_id]" placeholder="Add expertise area" class="h-7 w-44 text-xs" :aria-label="`Add expertise for ${panelist.full_name}`" />
                  <Button type="submit" size="icon" variant="outline" class="size-7 shrink-0" :aria-label="`Add expertise for ${panelist.full_name}`">
                    <Plus class="size-3.5" />
                  </Button>
                </form>
              </div>
              <p v-if="panelist.expertise.length === 0" class="mt-2 text-xs text-destructive">
                No expertise yet, so matching can't pick this panelist.
              </p>
            </div>

            <div class="flex items-center justify-between gap-4" :class="panelistView === 'list' && 'sm:justify-end'">
              <div>
                <div class="flex gap-1" aria-hidden="true">
                  <span
                    v-for="seat in PANEL_CAP"
                    :key="seat"
                    class="h-2 w-4 rounded-full"
                    :class="seat <= panelist.assignment_count ? 'bg-primary' : 'bg-muted'"
                  />
                </div>
                <p class="mt-1 text-xs tabular-nums" :class="panelist.assignment_count >= PANEL_CAP ? 'font-medium text-foreground' : 'text-muted-foreground'">
                  {{ panelist.assignment_count >= PANEL_CAP ? `Full, ${panelist.assignment_count} panels` : `${panelist.assignment_count} of ${PANEL_CAP} panels` }}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8" :aria-label="`Actions for ${panelist.full_name}`">
                    <Ellipsis class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @select="openEdit(panelist)">
                    <Pencil class="size-4" />
                    Edit details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" @select="confirmDelete(panelist)">
                    <Trash2 class="size-4" />
                    Remove panelist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        </TransitionGroup>

        <Dialog v-model:open="isEditOpen">
          <DialogContent class="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit panelist</DialogTitle>
            </DialogHeader>
            <form class="space-y-4" @submit.prevent="submitEditPanelist">
              <div class="flex flex-col gap-2">
                <Label for="edit-panelist-name">Full name</Label>
                <Input id="edit-panelist-name" v-model="editForm.fullName" required />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="edit-panelist-position">Position</Label>
                <Input id="edit-panelist-position" v-model="editForm.position" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" :disabled="isSavingEdit" @click="isEditOpen = false">
                  Cancel
                </Button>
                <Button type="submit" :disabled="isSavingEdit">
                  <Loader2 v-if="isSavingEdit" class="size-4 animate-spin" />
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog v-model:open="isDeleteOpen">
          <DialogContent class="max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove {{ deleteTarget?.full_name }}?</DialogTitle>
              <DialogDescription>
                This removes their panelist record and takes them off any assigned panels. This can't be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" :disabled="isDeleting" @click="isDeleteOpen = false">
                Cancel
              </Button>
              <Button variant="destructive" :disabled="isDeleting" @click="submitDeletePanelist">
                <Loader2 v-if="isDeleting" class="size-4 animate-spin" />
                <Trash2 v-else class="size-4" />
                Remove
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </template>
  </DashboardSidebar>
</template>

<style scoped>
.row-enter-active,
.row-leave-active {
  transition: opacity 220ms ease, transform 260ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.row-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.row-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .row-enter-active,
  .row-leave-active { transition: none; }
}
</style>
