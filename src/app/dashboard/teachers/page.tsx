
"use client"

import { useState, useMemo } from "react"
import { 
  Plus, 
  Search, 
  Trash2, 
  Loader2, 
  BookOpen, 
  Filter,
  CalendarDays,
  DoorOpen,
  Mail,
  Clock,
  ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { CAMPUSES, DAYS } from "@/lib/mock-data"
import { Teacher, Campus, Unit, TimetableEntry } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const ACTIVE_TIMETABLE_ID = "default-timetable"

function MultiSelectFilter({ 
  label, 
  options, 
  selected, 
  onChange,
  icon: Icon
}: { 
  label: string, 
  options: { label: string, value: string }[], 
  selected: string[], 
  onChange: (values: string[]) => void,
  icon: any
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed bg-background">
          <Icon className="mr-2 h-3 w-3" />
          {label}
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                {selected.length}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selected.length > 2 ? (
                  <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                    {selected.length} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selected.includes(option.value))
                    .map((option) => (
                      <Badge variant="secondary" key={option.value} className="rounded-sm px-1 font-normal">
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2 p-1.5 hover:bg-muted rounded-sm cursor-pointer" onClick={() => {
              const newSelected = selected.includes(option.value)
                ? selected.filter(v => v !== option.value)
                : [...selected, option.value]
              onChange(newSelected)
            }}>
              <Checkbox 
                id={`filter-${label}-${option.value}`} 
                checked={selected.includes(option.value)}
                onCheckedChange={() => {}}
              />
              <label className="text-xs font-medium leading-none cursor-pointer flex-1">
                {option.label}
              </label>
            </div>
          ))}
        </div>
        {selected.length > 0 && (
          <>
            <Separator />
            <div className="p-1">
              <Button variant="ghost" className="w-full text-xs h-8" onClick={() => onChange([])}>
                Clear filters
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default function TeachersPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units } = useCollection<Unit>(unitsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  // Filters
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Detail Modal State
  const [selectedTeacherForDetail, setSelectedTeacherForDetail] = useState<Teacher | null>(null)

  const filteredTeachers = useMemo(() => {
    if (!teachers) return []
    let data = [...teachers]
    
    if (searchQuery) {
      data = data.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    if (selectedCampuses.length > 0) {
      data = data.filter(t => t.campuses.some(c => selectedCampuses.includes(c)))
    }
    if (selectedUnits.length > 0) {
      data = data.filter(t => t.qualifiedUnits.some(u => selectedUnits.includes(u)))
    }
    if (selectedDays.length > 0 && sessions) {
      const teachersWithClassesOnSelectedDays = new Set(
        sessions.filter(s => selectedDays.includes(s.day)).map(s => s.teacherId)
      )
      data = data.filter(t => teachersWithClassesOnSelectedDays.has(t.id))
    }
    
    return data.sort((a,b) => a.name.localeCompare(b.name))
  }, [teachers, searchQuery, selectedCampuses, selectedUnits, selectedDays, sessions])

  const teacherSessions = useMemo(() => {
    if (!selectedTeacherForDetail || !sessions) return []
    return sessions
      .filter(s => s.teacherId === selectedTeacherForDetail.id)
      .sort((a, b) => {
        const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day)
        if (dayDiff !== 0) return dayDiff
        return a.startTime.localeCompare(b.startTime)
      })
  }, [selectedTeacherForDetail, sessions])

  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [newTeacherName, setNewTeacherName] = useState("")
  const [newTeacherEmail, setNewTeacherEmail] = useState("")

  const handleSingleAdd = () => {
    if (!newTeacherName.trim()) return
    const id = `t-${Date.now()}`
    const teacherData: Teacher = {
      id,
      name: newTeacherName.trim(),
      email: newTeacherEmail.trim() || `${newTeacherName.trim().toLowerCase().replace(/\s+/g, '')}@novus.edu.au`,
      qualifiedUnits: [],
      campuses: ['Online'],
      availability: []
    }
    setDocumentNonBlocking(doc(db, "teachers", id), teacherData, { merge: true })
    setIsSingleOpen(false)
    toast({ title: "Teacher Added", description: `${newTeacherName} created.` })
  }

  const handleDelete = (id: string) => {
    if (confirm("Delete this teacher? This will not remove their scheduled classes, which may result in unassigned sessions.")) {
      deleteDocumentNonBlocking(doc(db, "teachers", id))
      toast({ title: "Teacher Removed" })
    }
  }

  if (loadingTeachers || loadingSessions) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Faculty Directory</h2>
          <p className="text-muted-foreground text-sm">Click on a teacher's name to view their individual schedule.</p>
        </div>
        <Button onClick={() => setIsSingleOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Teacher
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Filters:</span>
        </div>
        
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Search by name..." 
            className="pl-8 h-8 text-xs" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <MultiSelectFilter 
          label="Days"
          icon={CalendarDays}
          options={DAYS.map(d => ({ label: d, value: d }))}
          selected={selectedDays}
          onChange={setSelectedDays}
        />

        <MultiSelectFilter 
          label="Sites"
          icon={DoorOpen}
          options={CAMPUSES.map(c => ({ label: c, value: c }))}
          selected={selectedCampuses}
          onChange={setSelectedCampuses}
        />

        <MultiSelectFilter 
          label="Qualifications"
          icon={BookOpen}
          options={units?.sort((a,b) => a.name.localeCompare(b.name)).map(u => ({ label: u.name, value: u.id })) || []}
          selected={selectedUnits}
          onChange={setSelectedUnits}
        />

        {(selectedCampuses.length > 0 || selectedUnits.length > 0 || selectedDays.length > 0 || searchQuery) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedCampuses([]); setSelectedUnits([]); setSelectedDays([]); setSearchQuery(""); }}
          >
            Clear All
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Teacher Name & Email</TableHead>
                <TableHead>Qualified Units</TableHead>
                <TableHead>Campuses</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((teacher) => (
                <TableRow key={teacher.id} className="group">
                  <TableCell>
                    <button 
                      onClick={() => setSelectedTeacherForDetail(teacher)}
                      className="flex flex-col text-left hover:text-primary transition-colors group/btn"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold group-hover/btn:underline">{teacher.name}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{teacher.email || 'N/A'}</span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[300px]">
                      {teacher.qualifiedUnits.map(uid => {
                        const u = units?.find(unit => unit.id === uid)
                        return <Badge key={uid} variant="secondary" className="text-[10px]">{u?.name || uid}</Badge>
                      })}
                      {teacher.qualifiedUnits.length === 0 && <span className="text-[10px] text-muted-foreground italic">No qualifications listed</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {teacher.campuses.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(teacher.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTeachers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    No faculty members found matching filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Teacher Detail Modal */}
      <Dialog open={!!selectedTeacherForDetail} onOpenChange={(open) => !open && setSelectedTeacherForDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <span className="font-black text-primary uppercase tracking-tight">{selectedTeacherForDetail?.name}</span>
              <Badge variant="outline">Schedule</Badge>
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Mail className="h-3 w-3" /> {selectedTeacherForDetail?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 border-b pb-2">Assigned Classes</h4>
            <div className="max-h-[400px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Day & Time</TableHead>
                    <TableHead>Academic Unit</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teacherSessions.map((session) => {
                    const unit = units?.find(u => u.id === session.unitId)
                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs">{session.day}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> {session.startTime} - {session.endTime}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{unit?.name || 'Unknown Unit'}</span>
                            <Badge variant="secondary" className="w-fit text-[9px] h-4 uppercase">
                              {unit?.type || 'Theory'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{session.room}</TableCell>
                      </TableRow>
                    )
                  })}
                  {teacherSessions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No classes currently assigned to this teacher.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTeacherForDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Teacher Dialog */}
      <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Faculty Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                placeholder="e.g. John Doe" 
                value={newTeacherName} 
                onChange={e => setNewTeacherName(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Professional Email</Label>
              <Input 
                type="email" 
                placeholder="johndoe@novus.edu.au" 
                value={newTeacherEmail} 
                onChange={e => setNewTeacherEmail(e.target.value)} 
              />
              <p className="text-[10px] text-muted-foreground">Leave blank to auto-generate based on name.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSingleOpen(false)}>Cancel</Button>
            <Button onClick={handleSingleAdd} disabled={!newTeacherName.trim()}>Save Teacher</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
