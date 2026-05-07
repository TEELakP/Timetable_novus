
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
  ExternalLink,
  AlertTriangle,
  Edit2
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
import { Teacher, Campus, Unit, Room, TimetableEntry, Day } from "@/lib/types"
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

  // Session Edit/Add State
  const [editingSession, setEditingSession] = useState<TimetableEntry | null>(null)
  const [newRoomForSession, setNewRoomForSession] = useState("")
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false)
  const [newSessionData, setNewSessionData] = useState({
    unitId: "",
    day: "Monday" as Day,
    startTime: "09:00",
    endTime: "11:00",
    room: ""
  })

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

  const handleUpdateSessionRoom = () => {
    if (!editingSession) return
    const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", editingSession.id)
    updateDocumentNonBlocking(sessionRef, { room: newRoomForSession })
    setEditingSession(null)
    toast({ title: "Session Updated", description: "Classroom assignment changed." })
  }

  const handleAddSessionToTeacher = () => {
    if (!selectedTeacherForDetail || !newSessionData.unitId) return
    const id = `s-${Date.now()}`
    const sessionData: TimetableEntry = {
      ...newSessionData,
      id,
      teacherId: selectedTeacherForDetail.id,
      acknowledged: false
    }
    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id), sessionData, { merge: true })
    setIsAddSessionOpen(false)
    toast({ title: "Session Added" })
  }

  const confirmDelete = () => {
    if (!teacherToDelete) return
    const teacherRef = doc(db, "teachers", teacherToDelete)
    deleteDocumentNonBlocking(teacherRef)
    setTeacherToDelete(null)
    toast({ title: "Teacher Removed", description: "The trainer profile has been deleted." })
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
          <p className="text-muted-foreground text-sm">Manage faculty profiles and view individual class schedules.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><DoorOpen className="mr-2 h-4 w-4" /> Add Room</Button>
            </DialogTrigger>
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
          <Button onClick={() => setIsSingleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Teacher
          </Button>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setTeacherToDelete(teacher.id)}>
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

      {/* Deletion Confirmation */}
      <AlertDialog open={!!teacherToDelete} onOpenChange={(open) => !open && setTeacherToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you absolutely sure you want to delete this trainer? This will remove their faculty profile permanently. 
              Scheduled sessions assigned to this trainer will remain but may appear as unassigned.
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
        <DialogContent className="max-w-4xl">
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
              <Button onClick={() => setIsAddSessionOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Session
              </Button>
            </div>
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
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingSession(session)
                              setNewRoomForSession(session.room)
                            }}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTeacherForDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Session Dialog for Specific Teacher */}
      <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Session for {selectedTeacherForDetail?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Subject</Label>
              <Select value={newSessionData.unitId} onValueChange={(v) => setNewSessionData({...newSessionData, unitId: v})}>
                <SelectTrigger><SelectValue placeholder="Select Academic Unit" /></SelectTrigger>
                <SelectContent>
                  {units?.sort((a,b) => a.name.localeCompare(b.name)).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label>Location</Label>
                <Select value={newSessionData.room} onValueChange={(v) => setNewSessionData({...newSessionData, room: v})}>
                  <SelectTrigger><SelectValue placeholder="Room" /></SelectTrigger>
                  <SelectContent>
                    {rooms?.sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                      <SelectItem key={r.id} value={r.name}>{r.name} ({r.campus})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input type="time" value={newSessionData.startTime} onChange={e => setNewSessionData({...newSessionData, startTime: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>End Time</Label>
                <Input type="time" value={newSessionData.endTime} onChange={e => setNewSessionData({...newSessionData, endTime: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSessionOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSessionToTeacher}>Save Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Edit Dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Session Classroom</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Existing Room</Label>
              <Select value={newRoomForSession} onValueChange={setNewRoomForSession}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rooms?.sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                    <SelectItem key={r.id} value={r.name}>{r.name} ({r.campus})</SelectItem>
                  ))}
                  <SelectItem value="Other">Custom Location...</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manual Entry (or Custom)</Label>
              <Input 
                value={newRoomForSession} 
                onChange={e => setNewRoomForSession(e.target.value)}
                placeholder="Type location manually..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSession(null)}>Cancel</Button>
            <Button onClick={handleUpdateSessionRoom}>Apply Change</Button>
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
              <Input placeholder="e.g. John Doe" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Professional Email</Label>
              <Input type="email" placeholder="johndoe@novus.edu.au" value={newTeacherEmail} onChange={e => setNewTeacherEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleSingleAdd}>Save Teacher</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
