
"use client"

import { useState, useEffect } from "react"
import { 
  Plus, 
  BookOpen, 
  Clock, 
  Layers, 
  Trash2, 
  Edit2, 
  FileText, 
  Loader2,
  Calendar,
  User,
  MapPin,
  Globe,
  Settings2,
  CalendarPlus,
  MoreVertical,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Unit, TimetableEntry, Teacher, Room, Day } from "@/lib/types"
import { DAYS } from "@/lib/mock-data"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function UnitsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])

  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)

  // Catalog Management State
  const [bulkInput, setBulkInput] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)

  // Scheduling State
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [schedulingUnit, setSchedulingUnit] = useState<Unit | null>(null)
  const [editingSession, setEditingSession] = useState<TimetableEntry | null>(null)
  
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedDay, setSelectedDay] = useState<Day>("Monday")
  const [selectedStartTime, setSelectedStartTime] = useState("09:00")
  const [selectedEndTime, setSelectedEndTime] = useState("11:00")

  // Form State for new units
  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitType, setNewUnitType] = useState<'theory' | 'practical' | 'online'>('theory')
  const [newUnitDuration, setNewUnitDuration] = useState("2")
  const [newUnitSessions, setNewUnitSessions] = useState("1")

  // Auto-calculate suggested end time based on unit requirements for NEW sessions
  useEffect(() => {
    if (schedulingUnit && !editingSession && selectedStartTime) {
      const startHour = parseInt(selectedStartTime.split(':')[0])
      const sessionBudget = Math.ceil(schedulingUnit.durationHours / (schedulingUnit.sessionsPerWeek || 1))
      const endHour = Math.min(startHour + sessionBudget, 23)
      setSelectedEndTime(`${endHour.toString().padStart(2, '0')}:00`)
    }
  }, [schedulingUnit, selectedStartTime, editingSession])

  const handleBulkAdd = () => {
    const lines = bulkInput.split('\n').filter(l => l.trim() !== "")
    lines.forEach((name, idx) => {
      const id = `u-${Date.now()}-${idx}`
      const unitData: Unit = {
        id,
        name: name.trim(),
        type: 'theory',
        durationHours: 2,
        sessionsPerWeek: 1
      }
      setDocumentNonBlocking(doc(db, "academicUnits", id), unitData, { merge: true })
    })
    setBulkInput("")
    setIsBulkOpen(false)
    toast({ title: "Bulk Add Started", description: "Adding units to the catalog..." })
  }

  const handleCreateUnit = () => {
    if (!newUnitName.trim()) return
    const id = `u-${Date.now()}`
    const unitData: Unit = {
      id,
      name: newUnitName.trim(),
      type: newUnitType,
      durationHours: parseInt(newUnitDuration) || 2,
      sessionsPerWeek: parseInt(newUnitSessions) || 1
    }
    setDocumentNonBlocking(doc(db, "academicUnits", id), unitData, { merge: true })
    setNewUnitName("")
    setNewUnitType('theory')
    setNewUnitDuration("2")
    setNewUnitSessions("1")
    setIsSingleOpen(false)
    toast({ title: "Unit Created", description: `${newUnitName} has been added to the catalog.` })
  }

  const handleUpdateUnit = () => {
    if (!editingUnit) return
    setDocumentNonBlocking(doc(db, "academicUnits", editingUnit.id), editingUnit, { merge: true })
    setEditingUnit(null)
    toast({ title: "Unit Updated", description: `${editingUnit.name} has been updated.` })
  }

  const handleSaveSession = () => {
    if ((!schedulingUnit && !editingSession) || !selectedTeacher || !selectedRoom || !selectedDay) {
      toast({ title: "Error", description: "Missing required fields.", variant: "destructive" })
      return
    }

    const sessionId = editingSession ? editingSession.id : `session-${Date.now()}`
    const unitId = editingSession ? editingSession.unitId : schedulingUnit!.id
    const roomName = rooms?.find(r => r.id === selectedRoom)?.name || rooms?.find(r => r.name === selectedRoom)?.name || "Unknown"

    const sessionData: TimetableEntry = {
      id: sessionId,
      unitId: unitId,
      teacherId: selectedTeacher,
      room: roomName,
      day: selectedDay,
      startTime: selectedStartTime,
      endTime: selectedEndTime,
      acknowledged: editingSession?.acknowledged || false
    }

    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), sessionData, { merge: true })
    setIsScheduleOpen(false)
    setSchedulingUnit(null)
    setEditingSession(null)
    toast({ title: editingSession ? "Session Updated" : "Session Scheduled", description: "Changes saved to timetable." })
  }

  const openScheduleDialog = (unit: Unit) => {
    setSchedulingUnit(unit)
    setEditingSession(null)
    setSelectedTeacher("")
    setSelectedRoom("")
    setSelectedDay("Monday")
    setSelectedStartTime("09:00")
    setIsScheduleOpen(true)
  }

  const openEditSessionDialog = (session: TimetableEntry) => {
    const unit = units?.find(u => u.id === session.unitId)
    setSchedulingUnit(unit || null)
    setEditingSession(session)
    setSelectedTeacher(session.teacherId)
    // Find room ID if possible, otherwise use name
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

  const handleDeleteUnit = (id: string) => {
    deleteDoc(doc(db, "academicUnits", id))
    toast({ title: "Unit Deleted", description: "The unit has been removed." })
  }

  if (loadingUnits || loadingSessions || loadingTeachers || loadingRooms) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Academic Units</h2>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Bulk Add Subjects
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Add Subjects</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Label>Enter subject names (one per line)</Label>
                <Textarea 
                  placeholder="Computer Networks&#10;Machine Learning&#10;Discrete Mathematics" 
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAdd}>Add All Subjects</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Academic Unit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-name">Unit Name</Label>
                  <Input 
                    id="unit-name" 
                    placeholder="e.g. Advanced Mathematics" 
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit-type">Delivery Mode</Label>
                    <Select value={newUnitType} onValueChange={(value: any) => setNewUnitType(value)}>
                      <SelectTrigger id="unit-type">
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="theory">Classroom</SelectItem>
                        <SelectItem value="practical">Workshop</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Total Weekly Hours</Label>
                    <Input 
                      id="duration" 
                      type="number" 
                      min="1" 
                      max="40" 
                      value={newUnitDuration}
                      onChange={(e) => setNewUnitDuration(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessions">Expected Sessions per Week</Label>
                  <Input 
                    id="sessions" 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={newUnitSessions}
                    onChange={(e) => setNewUnitSessions(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateUnit}>Create Unit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{units?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classroom Hours</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {units?.filter(u => u.type === 'theory').reduce((acc, u) => acc + u.durationHours, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workshop Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {units?.filter(u => u.type === 'practical').reduce((acc, u) => acc + u.durationHours, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online Hours</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {units?.filter(u => u.type === 'online').reduce((acc, u) => acc + u.durationHours, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Unit Catalog</CardTitle>
          <CardDescription>Click a unit name to manage its active class sessions (edit/remove).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Unit Name</TableHead>
                  <TableHead>Delivery Mode</TableHead>
                  <TableHead>Weekly Total</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units?.map((unit) => {
                  const activeSessions = sessions?.filter(s => s.unitId === unit.id) || []
                  
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="link" className="p-0 h-auto font-bold text-foreground hover:underline decoration-primary underline-offset-4">
                              {unit.name}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-80 p-0 overflow-hidden shadow-2xl border-primary/10">
                            <DropdownMenuLabel className="bg-primary text-primary-foreground p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                Active Classes ({activeSessions.length})
                              </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="m-0" />
                            {activeSessions.length > 0 ? (
                              <div className="max-h-[400px] overflow-y-auto">
                                {activeSessions.map((s) => {
                                  const teacher = teachers?.find(t => t.id === s.teacherId)
                                  return (
                                    <div key={s.id} className="p-4 border-b last:border-0 hover:bg-muted/50 group/session transition-colors">
                                      <div className="flex items-start justify-between">
                                        <div className="space-y-1.5">
                                          <div className="flex items-center gap-2 font-black text-xs">
                                            <Calendar className="h-3 w-3 text-primary" />
                                            {s.day}, {s.startTime} - {s.endTime}
                                          </div>
                                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                            <User className="h-3 w-3" />
                                            Trainer: {teacher?.name || "Unassigned"}
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
                                No sessions currently scheduled.
                              </div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={
                            unit.type === 'theory' 
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" 
                              : unit.type === 'practical'
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                          }
                        >
                          {unit.type === 'theory' ? 'Classroom' : unit.type === 'practical' ? 'Workshop' : 'Online'}
                        </Badge>
                      </TableCell>
                      <TableCell>{unit.durationHours} hrs/week</TableCell>
                      <TableCell>{unit.sessionsPerWeek} sessions</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 gap-1 text-xs"
                            onClick={() => openScheduleDialog(unit)}
                          >
                            <CalendarPlus className="h-3.5 w-3.5" /> Schedule
                          </Button>

                          <Dialog open={!!editingUnit && editingUnit.id === unit.id} onOpenChange={(open) => !open && setEditingUnit(null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingUnit(unit)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Academic Unit</DialogTitle>
                              </DialogHeader>
                              {editingUnit && (
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-name">Unit Name</Label>
                                    <Input 
                                      id="edit-name" 
                                      value={editingUnit.name}
                                      onChange={(e) => setEditingUnit({...editingUnit, name: e.target.value})}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-type">Delivery Mode</Label>
                                      <Select value={editingUnit.type} onValueChange={(value: any) => setEditingUnit({...editingUnit, type: value})}>
                                        <SelectTrigger id="edit-type">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="theory">Classroom</SelectItem>
                                          <SelectItem value="practical">Workshop</SelectItem>
                                          <SelectItem value="online">Online</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-duration">Total Weekly Hours</Label>
                                      <Input 
                                        id="edit-duration" 
                                        type="number" 
                                        value={editingUnit.durationHours}
                                        onChange={(e) => setEditingUnit({...editingUnit, durationHours: parseInt(e.target.value) || 0})}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-sessions">Sessions per Week</Label>
                                    <Input 
                                      id="edit-sessions" 
                                      type="number" 
                                      value={editingUnit.sessionsPerWeek}
                                      onChange={(e) => setEditingUnit({...editingUnit, sessionsPerWeek: parseInt(e.target.value) || 0})}
                                    />
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <Button onClick={handleUpdateUnit}>Save Changes</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteUnit(unit.id)}>
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

      {/* Unified Scheduling/Editing Dialog */}
      <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingSession ? <Edit2 className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
              {editingSession ? "Edit Timetable Entry" : "Schedule New Session"}
            </DialogTitle>
            <DialogDescription>
              {editingSession ? `Updating entry for ${schedulingUnit?.name}` : `Assigning ${schedulingUnit?.name} to a trainer and room.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="rounded-lg bg-muted/50 p-3 border border-border/50">
               <div className="flex justify-between items-center mb-1">
                 <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Subject</span>
                 <Badge variant="outline" className="text-[10px] h-4 bg-background uppercase">{schedulingUnit?.type === 'theory' ? 'Classroom' : schedulingUnit?.type === 'practical' ? 'Workshop' : 'Online'}</Badge>
               </div>
               <p className="text-sm font-bold">{schedulingUnit?.name}</p>
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
              <Label>Assigned Trainer</Label>
              <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                <SelectTrigger><SelectValue placeholder="Select Instructor" /></SelectTrigger>
                <SelectContent>
                  {teachers?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
              {editingSession ? "Save Changes" : "Confirm Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
