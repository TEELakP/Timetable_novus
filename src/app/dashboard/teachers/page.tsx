"use client"

import { useState, useEffect } from "react"
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Loader2, 
  Calendar as CalendarIcon, 
  Clock, 
  X,
  Building2,
  BookOpen,
  CalendarPlus,
  MapPin,
  User,
  MoreVertical,
  Mail
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CAMPUSES, DAYS } from "@/lib/mock-data"
import { Teacher, Campus, Day, Unit, TimetableEntry, Room } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function TeachersPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units } = useCollection<Unit>(unitsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)
  const { data: rooms } = useCollection<Room>(roomsRef)

  const [bulkInput, setBulkInput] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  
  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  
  // Scheduling State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [schedulingTeacher, setSchedulingTeacher] = useState<Teacher | null>(null)
  const [editingSession, setEditingSession] = useState<TimetableEntry | null>(null)
  
  const [selectedUnit, setSelectedUnit] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedDay, setSelectedDay] = useState<Day>("Monday")
  const [selectedStartTime, setSelectedStartTime] = useState("09:00")
  const [selectedEndTime, setSelectedEndTime] = useState("11:00")

  // Single Add Teacher State
  const [newTeacherName, setNewTeacherName] = useState("")
  const [newTeacherEmail, setNewTeacherEmail] = useState("")
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [selectedCampuses, setSelectedCampuses] = useState<Campus[]>(['Online'])

  // Availability State for UI
  const [newAvailDay, setNewAvailDay] = useState<Day>('Monday')
  const [newAvailStart, setNewAvailStart] = useState("09:00")
  const [newAvailEnd, setNewAvailEnd] = useState("17:00")

  // Auto-generate email when name changes in Single Add
  useEffect(() => {
    if (!newTeacherEmail && newTeacherName) {
      const suggestedEmail = newTeacherName.trim().toLowerCase().replace(/\s+/g, '') + "@novus.edu.au"
      setNewTeacherEmail(suggestedEmail)
    }
  }, [newTeacherName, newTeacherEmail])

  // Auto-calculate suggested end time based on unit requirements
  useEffect(() => {
    if (selectedUnit && selectedStartTime) {
      const unit = units?.find(u => u.id === selectedUnit)
      if (unit) {
        const startHour = parseInt(selectedStartTime.split(':')[0])
        const sessionBudget = Math.ceil(unit.durationHours / (unit.sessionsPerWeek || 1))
        const endHour = Math.min(startHour + sessionBudget, 23)
        setSelectedEndTime(`${endHour.toString().padStart(2, '0')}:00`)
      }
    }
  }, [selectedUnit, selectedStartTime, units])

  const handleBulkAdd = () => {
    const names = bulkInput.split('\n').filter(n => n.trim() !== "")
    names.forEach((name, idx) => {
      const id = `t-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
      const email = name.trim().toLowerCase().replace(/\s+/g, '') + "@novus.edu.au"
      const teacherData: Teacher = {
        id,
        name: name.trim(),
        email: email,
        qualifiedUnits: [],
        campuses: ['Online'],
        availability: []
      }
      setDocumentNonBlocking(doc(db, "teachers", id), teacherData, { merge: true })
    })
    setBulkInput("")
    setIsBulkOpen(false)
    toast({ title: "Bulk Add Started", description: `Adding ${names.length} teachers with institutional emails...` })
  }

  const handleSingleAdd = () => {
    if (!newTeacherName.trim()) return
    const id = `t-${Date.now()}`
    const teacherData: Teacher = {
      id,
      name: newTeacherName.trim(),
      email: newTeacherEmail.trim() || (newTeacherName.trim().toLowerCase().replace(/\s+/g, '') + "@novus.edu.au"),
      qualifiedUnits: selectedUnitIds,
      campuses: selectedCampuses,
      availability: []
    }
    setDocumentNonBlocking(doc(db, "teachers", id), teacherData, { merge: true })
    setNewTeacherName("")
    setNewTeacherEmail("")
    setSelectedUnitIds([])
    setSelectedCampuses(['Online'])
    setIsSingleOpen(false)
    toast({ title: "Teacher Added", description: `${newTeacherName} has been created.` })
  }

  const handleDelete = (id: string) => {
    const docRef = doc(db, "teachers", id)
    deleteDoc(docRef).catch(() => {
       toast({ variant: "destructive", title: "Delete Failed", description: "Could not remove teacher." })
    })
  }

  const handleSaveSession = () => {
    if ((!schedulingTeacher && !editingSession) || !selectedUnit || !selectedRoom || !selectedDay) {
      toast({ title: "Error", description: "Missing required fields.", variant: "destructive" })
      return
    }

    const sessionId = editingSession ? editingSession.id : `session-${Date.now()}`
    const teacherId = editingSession ? editingSession.teacherId : schedulingTeacher!.id
    const roomName = rooms?.find(r => r.id === selectedRoom)?.name || rooms?.find(r => r.name === selectedRoom)?.name || "Unknown"

    const sessionData: TimetableEntry = {
      id: sessionId,
      unitId: selectedUnit,
      teacherId: teacherId,
      room: roomName,
      day: selectedDay,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      acknowledged: editingSession?.acknowledged || false
    }

    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), sessionData, { merge: true })
    setIsScheduleOpen(false)
    setSchedulingTeacher(null)
    setEditingSession(null)
    toast({ title: editingSession ? "Session Updated" : "Session Scheduled", description: "Changes saved to timetable." })
  }

  const openScheduleDialog = (teacher: Teacher) => {
    setSchedulingTeacher(teacher)
    setEditingSession(null)
    setSelectedUnit("")
    setSelectedRoom("")
    setSelectedDay("Monday")
    setSelectedStartTime("09:00")
    setIsScheduleOpen(true)
  }

  const openEditSessionDialog = (session: TimetableEntry) => {
    const teacher = teachers?.find(t => t.id === session.teacherId)
    setSchedulingTeacher(teacher || null)
    setEditingSession(session)
    setSelectedUnit(session.unitId)
    const room = rooms?.find(r => r.name === session.room)
    setSelectedRoom(room ? room.id : session.room)
    setSelectedDay(session.day)
    setSelectedStartTime(session.startTime)
    setSelectedEndTime(session.endTime)
    setIsScheduleOpen(true)
  }

  const handleDeleteSession = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id))
    toast({ title: "Session Removed", description: "Class deleted from timetable." })
  }

  const toggleUnit = (teacher: Teacher, unitId: string) => {
    const qualifiedUnits = teacher.qualifiedUnits.includes(unitId)
      ? teacher.qualifiedUnits.filter(id => id !== unitId)
      : [...teacher.qualifiedUnits, unitId]
    
    const updated = { ...teacher, qualifiedUnits }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", teacher.id), updated, { merge: true })
  }

  const toggleCampus = (teacher: Teacher, campus: Campus) => {
    const campuses = teacher.campuses.includes(campus)
      ? teacher.campuses.filter(c => c !== campus)
      : [...teacher.campuses, campus]
    
    const updated = { ...teacher, campuses }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", teacher.id), updated, { merge: true })
  }

  const addAvailability = () => {
    if (!editingTeacher) return
    const newSlot = { day: newAvailDay, startTime: newAvailStart, endTime: newAvailEnd }
    const availability = [...(editingTeacher.availability || []), newSlot]
    const updated = { ...editingTeacher, availability }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", editingTeacher.id), updated, { merge: true })
  }

  const removeAvailability = (index: number) => {
    if (!editingTeacher) return
    const availability = editingTeacher.availability.filter((_, i) => i !== index)
    const updated = { ...editingTeacher, availability }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", editingTeacher.id), updated, { merge: true })
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
        <h2 className="text-3xl font-bold tracking-tight font-headline">Faculty Directory</h2>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <BookOpen className="mr-2 h-4 w-4" /> Bulk Add Names
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Add Teachers</DialogTitle>
                <DialogDescription>Emails will be auto-generated as name@novus.edu.au</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Label>Enter teacher names (one per line)</Label>
                <Textarea 
                  placeholder="John Doe&#10;Jane Smith&#10;Dr. Alan Grant" 
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAdd}>Add All Teachers</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Teacher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Teacher Profile</DialogTitle>
                <DialogDescription>Input basic details and initial connections.</DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Dr. Sarah Wilson" 
                      value={newTeacherName}
                      onChange={(e) => setNewTeacherName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      placeholder="name@novus.edu.au" 
                      value={newTeacherEmail}
                      onChange={(e) => setNewTeacherEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" /> Initial Units
                      </Label>
                      <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2 bg-muted/20">
                         {units?.map(unit => (
                            <div key={unit.id} className="flex items-center space-x-2">
                               <Checkbox 
                                  id={`new-unit-${unit.id}`}
                                  checked={selectedUnitIds.includes(unit.id)}
                                  onCheckedChange={(checked) => {
                                     setSelectedUnitIds(prev => checked ? [...prev, unit.id] : prev.filter(id => id !== unit.id))
                                  }}
                               />
                               <Label htmlFor={`new-unit-${unit.id}`} className="text-xs font-normal cursor-pointer">{unit.name}</Label>
                            </div>
                         ))}
                      </div>
                   </div>
                   <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" /> Primary Campuses
                      </Label>
                      <div className="border rounded-md p-3 space-y-2 bg-muted/20">
                         {CAMPUSES.map(campus => (
                            <div key={campus} className="flex items-center space-x-2">
                               <Checkbox 
                                  id={`new-campus-${campus}`}
                                  checked={selectedCampuses.includes(campus)}
                                  onCheckedChange={(checked) => {
                                     setSelectedCampuses(prev => checked ? [...prev, campus] : prev.filter(c => c !== campus))
                                  }}
                               />
                               <Label htmlFor={`new-campus-${campus}`} className="text-xs font-normal cursor-pointer">{campus}</Label>
                            </div>
                         ))}
                      </div>
                   </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSingleAdd}>Save Profile</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Faculty List</CardTitle>
          <CardDescription>Manage teacher qualifications, availability, and active class assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center py-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search faculty by name..." className="pl-8" />
            </div>
          </div>
          <div className="rounded-md border overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Teacher Name & Email</TableHead>
                  <TableHead>Qualified Units</TableHead>
                  <TableHead>Campuses</TableHead>
                  <TableHead>Weekly Availability</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers?.map((teacher) => {
                  const teacherSessions = sessions?.filter(s => s.teacherId === teacher.id) || []
                  
                  return (
                    <TableRow key={teacher.id} className="group">
                      <TableCell className="font-semibold">
                        <div className="flex flex-col">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="link" className="p-0 h-auto font-bold text-foreground hover:underline decoration-primary underline-offset-4 justify-start">
                                {teacher.name}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-80 p-0 overflow-hidden shadow-2xl border-primary/10">
                              <DropdownMenuLabel className="bg-primary text-primary-foreground p-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  Assigned Classes ({teacherSessions.length})
                                </div>
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="m-0" />
                              {teacherSessions.length > 0 ? (
                                <div className="max-h-[400px] overflow-y-auto">
                                  {teacherSessions.map((s) => {
                                    const unit = units?.find(u => u.id === s.unitId)
                                    return (
                                      <div key={s.id} className="p-4 border-b last:border-0 hover:bg-muted/50 group/session transition-colors">
                                        <div className="flex items-start justify-between">
                                          <div className="space-y-1.5">
                                            <div className="font-bold text-sm">{unit?.name}</div>
                                            <div className="flex items-center gap-2 font-black text-[10px] text-primary">
                                              <CalendarIcon className="h-3 w-3" />
                                              {s.day}, {s.startTime} - {s.endTime}
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                              <MapPin className="h-3 w-3" />
                                              Room: {s.room}
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1 opacity-0 group-hover/session:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSessionDialog(s)}>
                                              <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSession(s.id)}>
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <div className="p-6 text-center text-xs text-muted-foreground italic bg-muted/20">
                                  No sessions currently assigned.
                                </div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Mail className="h-2.5 w-2.5" />
                            {teacher.email || 'N/A'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {teacher.qualifiedUnits.length > 0 ? teacher.qualifiedUnits.map(unitId => {
                            const unit = units?.find(u => u.id === unitId)
                            return (
                              <Badge key={unitId} variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                                {unit?.name || unitId}
                              </Badge>
                            )
                          }) : <span className="text-[10px] text-muted-foreground italic">No units assigned</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {teacher.campuses.map(campus => (
                            <Badge key={campus} variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-primary/20 bg-primary/5 text-primary">
                              {campus}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                           {teacher.availability?.length > 0 ? teacher.availability.slice(0, 2).map((slot, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                 <Clock className="h-2.5 w-2.5" />
                                 <span>{slot.day.substring(0, 3)}: {slot.startTime}-{slot.endTime}</span>
                              </div>
                           )) : <span className="text-[10px] text-muted-foreground italic">Availability not set</span>}
                           {teacher.availability?.length > 2 && <span className="text-[10px] font-bold text-primary">+{teacher.availability.length - 2} more slots</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1 text-xs"
                            onClick={() => openScheduleDialog(teacher)}
                          >
                            <CalendarPlus className="h-3.5 w-3.5" /> Schedule
                          </Button>

                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTeacher(teacher)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
                              <DialogHeader className="p-6 pb-0">
                                <DialogTitle className="text-2xl font-headline">Edit Teacher: {teacher.name}</DialogTitle>
                                <DialogDescription>Update qualifications, campus assignments, and weekly availability.</DialogDescription>
                              </DialogHeader>
                              {editingTeacher && (
                                <Tabs defaultValue="profile" className="flex-1 overflow-hidden flex flex-col">
                                  <div className="px-6 border-b">
                                    <TabsList className="bg-transparent h-12 w-full justify-start gap-4">
                                      <TabsTrigger value="profile" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none h-full">General Info</TabsTrigger>
                                      <TabsTrigger value="qualifications" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none h-full">Qualifications</TabsTrigger>
                                      <TabsTrigger value="availability" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none shadow-none h-full">Availability</TabsTrigger>
                                    </TabsList>
                                  </div>
                                  <div className="flex-1 overflow-y-auto p-6">
                                    <TabsContent value="profile" className="m-0 space-y-6">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          <Label>Full Name</Label>
                                          <Input 
                                            value={editingTeacher.name} 
                                            onChange={e => {
                                              const updated = {...editingTeacher, name: e.target.value};
                                              setEditingTeacher(updated);
                                              setDocumentNonBlocking(doc(db, "teachers", updated.id), updated, { merge: true });
                                            }} 
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Email Address</Label>
                                          <Input 
                                            value={editingTeacher.email || ""} 
                                            onChange={e => {
                                              const updated = {...editingTeacher, email: e.target.value};
                                              setEditingTeacher(updated);
                                              setDocumentNonBlocking(doc(db, "teachers", updated.id), updated, { merge: true });
                                            }} 
                                          />
                                        </div>
                                      </div>
                                    </TabsContent>
                                    
                                    <TabsContent value="qualifications" className="m-0 space-y-8">
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                          <BookOpen className="h-4 w-4" />
                                          <h4>Connect Teacher to Academic Units</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/10 max-h-[300px] overflow-y-auto">
                                          {units?.map(unit => (
                                            <div key={unit.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors">
                                              <Checkbox 
                                                id={`edit-unit-${unit.id}`} 
                                                checked={editingTeacher.qualifiedUnits.includes(unit.id)}
                                                onCheckedChange={() => toggleUnit(editingTeacher, unit.id)}
                                              />
                                              <Label htmlFor={`edit-unit-${unit.id}`} className="text-xs font-medium cursor-pointer flex-1">
                                                {unit.name} <span className="text-[10px] text-muted-foreground ml-1">({unit.type})</span>
                                              </Label>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                          <Building2 className="h-4 w-4" />
                                          <h4>Campus Assignments</h4>
                                        </div>
                                        <div className="flex flex-wrap gap-6 border rounded-lg p-4 bg-muted/10">
                                          {CAMPUSES.map(campus => (
                                            <div key={campus} className="flex items-center space-x-2">
                                              <Checkbox 
                                                id={`edit-campus-${campus}`} 
                                                checked={editingTeacher.campuses.includes(campus)}
                                                onCheckedChange={() => toggleCampus(editingTeacher, campus)}
                                              />
                                              <Label htmlFor={`edit-campus-${campus}`} className="text-sm font-medium cursor-pointer">{campus}</Label>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </TabsContent>

                                    <TabsContent value="availability" className="m-0 space-y-6">
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                          <CalendarIcon className="h-4 w-4" />
                                          <h4>Recurring Weekly Time Slots</h4>
                                        </div>
                                        <div className="grid grid-cols-4 gap-3 items-end p-4 border rounded-lg bg-primary/5">
                                          <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold tracking-wider">Work Day</Label>
                                            <Select value={newAvailDay} onValueChange={(v: Day) => setNewAvailDay(v)}>
                                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                {DAYS.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold tracking-wider">Start Time</Label>
                                            <Input type="time" className="h-9 text-xs" value={newAvailStart} onChange={e => setNewAvailStart(e.target.value)} />
                                          </div>
                                          <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase font-bold tracking-wider">End Time</Label>
                                            <Input type="time" className="h-9 text-xs" value={newAvailEnd} onChange={e => setNewAvailEnd(e.target.value)} />
                                          </div>
                                          <Button size="sm" className="h-9 gap-1.5" onClick={addAvailability}>
                                            <Plus className="h-4 w-4" /> Add Slot
                                          </Button>
                                        </div>

                                        <div className="space-y-2 mt-4">
                                           <Label className="text-xs text-muted-foreground">Configured Availability:</Label>
                                           {editingTeacher.availability?.length > 0 ? (
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                               {editingTeacher.availability.map((slot, idx) => (
                                                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs shadow-sm group/slot">
                                                     <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                          {slot.day.substring(0, 1)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                          <span className="font-bold">{slot.day}</span>
                                                          <span className="text-muted-foreground flex items-center gap-1">
                                                            <Clock className="h-3 w-3" /> {slot.startTime} - {slot.endTime}
                                                          </span>
                                                        </div>
                                                     </div>
                                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover/slot:opacity-100 transition-opacity" onClick={() => removeAvailability(idx)}>
                                                        <X className="h-4 w-4" />
                                                     </Button>
                                                  </div>
                                               ))}
                                             </div>
                                           ) : (
                                             <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground italic text-sm">
                                                No availability slots defined for this teacher.
                                             </div>
                                           )}
                                        </div>
                                      </div>
                                    </TabsContent>
                                  </div>
                                  <div className="p-4 border-t bg-muted/20 flex justify-end">
                                     <DialogTrigger asChild>
                                        <Button variant="outline">Close Profile Editor</Button>
                                     </DialogTrigger>
                                  </div>
                                </Tabs>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(teacher.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Teacher-Context Scheduling/Editing Dialog */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingSession ? <Edit2 className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
              {editingSession ? "Edit Assignment" : "Schedule New Assignment"}
            </DialogTitle>
            <DialogDescription>
              {editingSession ? `Updating entry for ${schedulingTeacher?.name}` : `Assigning ${schedulingTeacher?.name} to a subject and room.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Trainer</span>
                 <Badge variant="outline" className="text-[10px] h-4 bg-background uppercase">Qualified Faculty</Badge>
               </div>
               <p className="text-sm font-bold">{schedulingTeacher?.name}</p>
               <p className="text-[10px] text-muted-foreground">{schedulingTeacher?.email}</p>
             </div>

            <div className="space-y-2">
              <Label>Subject (Qualified Only)</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                <SelectContent>
                  {units?.filter(u => schedulingTeacher?.qualifiedUnits.includes(u.id)).map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.type})
                    </SelectItem>
                  ))}
                  {schedulingTeacher?.qualifiedUnits.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground italic">No qualified subjects assigned to this trainer.</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Day</Label>
              <Select value={selectedDay} onValueChange={(v: any) => setSelectedDay(v)}>
                <SelectTrigger><SelectValue placeholder="Select Day" /></SelectTrigger>
                <SelectContent>
                  {DAYS.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={selectedStartTime} onChange={e => setSelectedStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={selectedEndTime} onChange={e => setSelectedEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Room / Location</Label>
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                <SelectContent>
                  {rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.campus})</SelectItem>)}
                  {!rooms?.find(r => r.id === selectedRoom) && selectedRoom && (
                    <SelectItem value={selectedRoom}>{selectedRoom}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveSession} className="w-full">
              {editingSession ? "Save Changes" : "Confirm Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
