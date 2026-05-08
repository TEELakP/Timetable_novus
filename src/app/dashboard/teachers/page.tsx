
"use client"

import { useState, useMemo, useEffect } from "react"
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
  ExternalLink,
  AlertTriangle,
  Edit2,
  Settings2,
  CheckCircle2,
  X,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CAMPUSES, DAYS } from "@/lib/mock-data"
import { Teacher, Campus, Unit, Room, TimetableEntry, Day, TeacherAvailability } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
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
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units } = useCollection<Unit>(unitsRef)
  const { data: rooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  // Filters
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Deletion state
  const [teacherToDelete, setTeacherToDelete] = useState<string | null>(null)

  // Detail Modal State
  const [selectedTeacherForDetail, setSelectedTeacherForDetail] = useState<Teacher | null>(null)

  // Edit Profile State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [editingTeacherData, setEditingTeacherData] = useState<Teacher | null>(null)
  const [newAvail, setNewAvail] = useState<TeacherAvailability>({ day: 'Monday', startTime: '09:00', endTime: '17:00' })

  // Session Edit/Add State
  const [editingSession, setEditingSession] = useState<TimetableEntry | null>(null)
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false)
  const [newSessionData, setNewSessionData] = useState({
    unitId: "",
    day: "Monday" as Day,
    startTime: "09:00",
    endTime: "11:00",
    room: "",
    campus: "Ultimo" as Campus,
    location: ""
  })
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)

  // Room Creation State
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomCampus, setNewRoomCampus] = useState<Campus>('Online')

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

  const qualifiedUnitsList = useMemo(() => {
    if (!selectedTeacherForDetail || !units) return []
    return units.filter(u => selectedTeacherForDetail.qualifiedUnits.includes(u.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedTeacherForDetail, units])

  // Conflict validation helper
  const checkConflicts = (day: string, startTime: string, endTime: string, currentSessionId?: string) => {
    if (!selectedTeacherForDetail || !startTime || !endTime) return null

    let warning = ""

    // 1. Availability Check
    const teacherAvails = selectedTeacherForDetail.availability || []
    const dayAvails = teacherAvails.filter(a => a.day === day)
    
    const isWithinAvailability = dayAvails.some(a => {
      return startTime >= a.startTime && endTime <= a.endTime
    })

    if (dayAvails.length > 0 && !isWithinAvailability) {
      warning += "Teacher is not available during this time slot. "
    } else if (dayAvails.length === 0 && teacherAvails.length > 0) {
      warning += `Teacher has no availability defined for ${day}. `
    }

    // 2. Overlap Check
    const existingSessions = sessions?.filter(s => 
      s.teacherId === selectedTeacherForDetail.id && 
      s.day === day && 
      s.id !== currentSessionId
    ) || []
    const hasOverlap = existingSessions.some(s => {
      return (startTime >= s.startTime && startTime < s.endTime) ||
             (endTime > s.startTime && endTime <= s.endTime) ||
             (startTime <= s.startTime && endTime >= s.endTime)
    })

    if (hasOverlap) {
      warning += "Teacher is already teaching another class during this time. "
    }

    return warning || null
  }

  // Effect for live warnings
  useEffect(() => {
    if (isAddSessionOpen) {
      setConflictWarning(checkConflicts(newSessionData.day, newSessionData.startTime, newSessionData.endTime))
    } else if (editingSession) {
      setConflictWarning(checkConflicts(editingSession.day, editingSession.startTime, editingSession.endTime, editingSession.id))
    } else {
      setConflictWarning(null)
    }
  }, [newSessionData, editingSession, selectedTeacherForDetail, sessions, isAddSessionOpen])

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

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return
    const id = `r-${Date.now()}`
    setDocumentNonBlocking(doc(db, "rooms", id), {
      id,
      name: newRoomName.trim(),
      campus: newRoomCampus,
      capacity: 30
    }, { merge: true })
    setNewRoomName("")
    setIsRoomDialogOpen(false)
    toast({ title: "Room Created", description: `${newRoomName} added to directory.` })
  }

  const handleUpdateSession = () => {
    if (!editingSession) return
    const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", editingSession.id)
    updateDocumentNonBlocking(sessionRef, { 
      ...editingSession,
      isConflict: !!conflictWarning
    })
    setEditingSession(null)
    toast({ title: "Session Updated" })
  }

  const handleAddSessionToTeacher = () => {
    if (!selectedTeacherForDetail || !newSessionData.unitId) return
    const id = `s-${Date.now()}`
    const sessionData: TimetableEntry = {
      ...newSessionData,
      id,
      teacherId: selectedTeacherForDetail.id,
      acknowledged: false,
      isConflict: !!conflictWarning
    }
    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id), sessionData, { merge: true })
    setIsAddSessionOpen(false)
    toast({ 
      title: conflictWarning ? "Session Added with Conflicts" : "Session Added",
      variant: conflictWarning ? "destructive" : "default"
    })
  }

  const handleSaveProfile = () => {
    if (!editingTeacherData) return
    const teacherRef = doc(db, "teachers", editingTeacherData.id)
    setDocumentNonBlocking(teacherRef, editingTeacherData, { merge: true })
    setSelectedTeacherForDetail(editingTeacherData)
    setIsEditProfileOpen(false)
    toast({ title: "Profile Updated", description: "Teacher details saved." })
  }

  const confirmDelete = () => {
    if (!teacherToDelete) return
    const teacherRef = doc(db, "teachers", teacherToDelete)
    deleteDocumentNonBlocking(teacherRef)
    setTeacherToDelete(null)
    toast({ title: "Teacher Removed", description: "The trainer profile has been deleted." })
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Faculty Directory</h2>
          <p className="text-muted-foreground text-sm">Manage profiles, availability, and view individual class schedules.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsRoomDialogOpen(true)}><DoorOpen className="mr-2 h-4 w-4" /> Add Room</Button>
          <Button onClick={() => setIsSingleOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Teacher</Button>
        </div>
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
                <TableHead>Qualifications</TableHead>
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
                      {teacher.qualifiedUnits.length === 0 && <span className="text-[10px] text-muted-foreground italic">No qualifications</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {teacher.campuses.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setTeacherToDelete(teacher.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deletion Confirmation */}
      <AlertDialog open={!!teacherToDelete} onOpenChange={(open) => !open && setTeacherToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this trainer? This will remove their faculty profile permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Teacher
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Teacher Detail Modal */}
      <Dialog open={!!selectedTeacherForDetail} onOpenChange={(open) => !open && setSelectedTeacherForDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between w-full pr-8">
              <div className="flex flex-col">
                <DialogTitle className="flex items-center gap-2 text-2xl">
                  <span className="font-black text-primary uppercase tracking-tight">{selectedTeacherForDetail?.name}</span>
                  <Badge variant="outline">Schedule</Badge>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Mail className="h-3 w-3" /> {selectedTeacherForDetail?.email}
                </DialogDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditingTeacherData(selectedTeacherForDetail)
                  setIsEditProfileOpen(true)
                }}>
                  <Settings2 className="h-4 w-4 mr-1" /> Edit Profile & Avail.
                </Button>
                <Button onClick={() => {
                  setNewSessionData({
                    unitId: "",
                    day: "Monday",
                    startTime: "09:00",
                    endTime: "11:00",
                    room: "",
                    campus: selectedTeacherForDetail?.campuses[0] || 'Ultimo',
                    location: ""
                  })
                  setIsAddSessionOpen(true)
                }} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Session
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="h-3 w-3" /> Weekly Availability
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedTeacherForDetail?.availability?.map((avail, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                    {avail.day}: {avail.startTime}-{avail.endTime}
                  </Badge>
                ))}
                {(!selectedTeacherForDetail?.availability || selectedTeacherForDetail.availability.length === 0) && (
                  <span className="text-xs text-muted-foreground italic">No availability slots defined. Defaulting to 24/7.</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                <CalendarDays className="h-3 w-3" /> Assigned Classes
              </h4>
              <div className="rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Day & Time</TableHead>
                      <TableHead>Academic Unit</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                              <span className="text-[10px] text-muted-foreground">{session.startTime} - {session.endTime}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">{unit?.name || 'Unknown Unit'}</span>
                              {session.isConflict && <Badge variant="destructive" className="w-fit text-[8px] h-3 uppercase p-0.5 px-1">Conflict</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{session.room}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => setEditingSession(session)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTeacherForDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile & Availability Dialog */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Profile: {editingTeacherData?.name}</DialogTitle>
            <DialogDescription>Manage qualifications, assigned campuses, and weekly availability slots.</DialogDescription>
          </DialogHeader>
          {editingTeacherData && (
            <div className="space-y-8 py-4">
              <div className="space-y-3">
                <Label className="text-sm font-bold uppercase">Weekly Availability Slots</Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end bg-muted/20 p-3 rounded-lg border border-dashed">
                  <div className="space-y-1">
                    <Label className="text-[10px]">Day</Label>
                    <Select value={newAvail.day} onValueChange={(v: Day) => setNewAvail({...newAvail, day: v})}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Start</Label>
                    <Input type="time" className="h-8" value={newAvail.startTime} onChange={e => setNewAvail({...newAvail, startTime: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">End</Label>
                    <Input type="time" className="h-8" value={newAvail.endTime} onChange={e => setNewAvail({...newAvail, endTime: e.target.value})} />
                  </div>
                  <Button size="sm" className="h-8" onClick={() => {
                    const currentAvails = editingTeacherData.availability || []
                    setEditingTeacherData({...editingTeacherData, availability: [...currentAvails, newAvail]})
                  }}>
                    Add Slot
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {editingTeacherData.availability?.map((a, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1.5 px-2 py-1">
                      {a.day}: {a.startTime}-{a.endTime}
                      <button onClick={() => {
                        const newList = editingTeacherData.availability.filter((_, idx) => idx !== i)
                        setEditingTeacherData({...editingTeacherData, availability: newList})
                      }}>
                        <X className="h-3 w-3 hover:text-destructive" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold uppercase">Qualified Units</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-4 border rounded-lg max-h-[200px] overflow-y-auto bg-muted/20">
                  {units?.sort((a,b) => a.name.localeCompare(b.name)).map(unit => (
                    <div key={unit.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-unit-${unit.id}`}
                        checked={editingTeacherData.qualifiedUnits.includes(unit.id)}
                        onCheckedChange={(checked) => {
                          const newList = checked 
                            ? [...editingTeacherData.qualifiedUnits, unit.id]
                            : editingTeacherData.qualifiedUnits.filter(id => id !== unit.id)
                          setEditingTeacherData({...editingTeacherData, qualifiedUnits: newList})
                        }}
                      />
                      <label htmlFor={`edit-unit-${unit.id}`} className="text-xs font-medium cursor-pointer">
                        {unit.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold uppercase">Assigned Campuses</Label>
                <div className="flex flex-wrap gap-4 p-4 border rounded-lg bg-muted/20">
                  {CAMPUSES.map(campus => (
                    <div key={campus} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`edit-campus-${campus}`}
                        checked={editingTeacherData.campuses.includes(campus)}
                        onCheckedChange={(checked) => {
                          const newList = checked 
                            ? [...editingTeacherData.campuses, campus]
                            : editingTeacherData.campuses.filter(c => c !== campus)
                          setEditingTeacherData({...editingTeacherData, campuses: newList})
                        }}
                      />
                      <label htmlFor={`edit-campus-${campus}`} className="text-xs font-medium cursor-pointer">
                        {campus}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditProfileOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProfile} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Save Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Session Dialog with Conflict Detection */}
      <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Session for {selectedTeacherForDetail?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {conflictWarning && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-xs">Scheduling Conflict</AlertTitle>
                <AlertDescription className="text-[10px]">
                  {conflictWarning} You can still save, but this will be marked as a conflict.
                </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label>Subject (Qualified Only)</Label>
              <Select value={newSessionData.unitId} onValueChange={(v) => setNewSessionData({...newSessionData, unitId: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Qualified Unit" />
                </SelectTrigger>
                <SelectContent>
                  {qualifiedUnitsList.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Campus (City)</Label>
                <Select 
                  value={newSessionData.campus} 
                  onValueChange={(v: Campus) => setNewSessionData({...newSessionData, campus: v, room: "", location: ""})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Room</Label>
                <Select 
                  value={newSessionData.room} 
                  onValueChange={(v) => {
                    const selectedRoom = rooms?.find(r => r.name === v && r.campus === newSessionData.campus)
                    setNewSessionData({...newSessionData, room: v, location: selectedRoom?.address || ""})
                  }}
                  disabled={!newSessionData.campus}
                >
                  <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                  <SelectContent>
                    {rooms?.filter(r => r.campus === newSessionData.campus).sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                      <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Day</Label>
                <Select value={newSessionData.day} onValueChange={(v: Day) => setNewSessionData({...newSessionData, day: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Timespan</Label>
                <div className="flex items-center gap-1">
                  <Input type="time" className="h-8 text-xs" value={newSessionData.startTime} onChange={e => setNewSessionData({...newSessionData, startTime: e.target.value})} />
                  <span className="text-xs">-</span>
                  <Input type="time" className="h-8 text-xs" value={newSessionData.endTime} onChange={e => setNewSessionData({...newSessionData, endTime: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSessionOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSessionToTeacher} disabled={!newSessionData.unitId || !newSessionData.room}>
              Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Session Edit Dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Class Session</DialogTitle></DialogHeader>
          {editingSession && (
            <div className="grid gap-4 py-4">
               {conflictWarning && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-xs">Scheduling Conflict</AlertTitle>
                  <AlertDescription className="text-[10px]">
                    {conflictWarning}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid gap-2">
                <Label>Subject (Qualified Only)</Label>
                <Select value={editingSession.unitId} onValueChange={(v) => setEditingSession({...editingSession, unitId: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {qualifiedUnitsList.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Campus</Label>
                  <Select 
                    value={editingSession.campus} 
                    onValueChange={(v: Campus) => setEditingSession({...editingSession, campus: v, room: "", location: ""})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Room</Label>
                  <Select 
                    value={editingSession.room} 
                    onValueChange={(v) => {
                      const selectedRoom = rooms?.find(r => r.name === v && r.campus === editingSession.campus)
                      setEditingSession({...editingSession, room: v, location: selectedRoom?.address || ""})
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Room" /></SelectTrigger>
                    <SelectContent>
                      {rooms?.filter(r => r.campus === editingSession.campus).sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                        <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Day</Label>
                  <Select value={editingSession.day} onValueChange={(v: Day) => setEditingSession({...editingSession, day: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Timespan</Label>
                  <div className="flex items-center gap-1">
                    <Input type="time" className="h-8 text-xs" value={editingSession.startTime} onChange={e => setEditingSession({...editingSession, startTime: e.target.value})} />
                    <span className="text-xs">-</span>
                    <Input type="time" className="h-8 text-xs" value={editingSession.endTime} onChange={e => setEditingSession({...editingSession, endTime: e.target.value})} />
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSession(null)}>Cancel</Button>
            <Button onClick={handleUpdateSession}>Save Changes</Button>
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
              <Input placeholder="e.g. Jane Smith" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Professional Email</Label>
              <Input type="email" placeholder="j.smith@novus.edu.au" value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSingleAdd}>Save Teacher</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Room Creation Dialog */}
      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Classroom</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Room Name</Label>
              <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="e.g. Room 301" />
            </div>
            <div className="space-y-2">
              <Label>Campus</Label>
              <Select value={newRoomCampus} onValueChange={(v: Campus) => setNewRoomCampus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddRoom} disabled={!newRoomName.trim()}>Save Classroom</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
