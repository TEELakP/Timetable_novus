
"use client"

import { useState } from "react"
import { 
  Wand2, 
  Download, 
  Share2, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  Info,
  MoreVertical,
  CheckCircle2,
  BookOpen,
  Plus,
  Users,
  LayoutDashboard,
  Loader2,
  Trash2,
  DoorOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { DAYS, HOURS } from "@/lib/mock-data"
import { generateInitialTimetable } from "@/ai/flows/generate-initial-timetable"
import { TimetableEntry, Teacher, Unit, Room, Day } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc, writeBatch } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function TimetablePage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  // Firestore Data
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const rulesRef = useMemoFirebase(() => collection(db, "schedulingRules"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: rulesData } = useCollection<any>(rulesRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  // Local UI State
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  
  // New Session Form State
  const [selectedUnit, setSelectedUnit] = useState("")
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedDay, setSelectedDay] = useState<Day>("Monday")
  const [selectedTime, setSelectedTime] = useState("09:00")

  const handleAddSession = () => {
    if (!selectedUnit || !selectedTeacher || !selectedRoom) {
      toast({ title: "Validation Error", description: "Please match all entities (Teacher, Unit, Room).", variant: "destructive" })
      return
    }

    const unit = units?.find(u => u.id === selectedUnit)
    const sessionId = `session-${Date.now()}`
    
    // Calculate end time based on unit duration
    const startHour = parseInt(selectedTime.split(':')[0])
    const duration = unit?.durationHours || 1
    const endHour = Math.min(startHour + duration, 21)
    const endTime = `${endHour.toString().padStart(2, '0')}:00`

    const newSession: TimetableEntry = {
      id: sessionId,
      unitId: selectedUnit,
      teacherId: selectedTeacher,
      room: rooms?.find(r => r.id === selectedRoom)?.name || "Unknown",
      day: selectedDay,
      startTime: selectedTime,
      endTime: endTime
    }

    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), newSession, { merge: true })
    
    setIsAddOpen(false)
    toast({ title: "Session Added", description: "Successfully matched entities and scheduled session." })
  }

  const handleDeleteSession = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id))
    toast({ title: "Session Removed", description: "The scheduled session has been deleted." })
  }

  const handleGenerate = async () => {
    if (!teachers?.length || !units?.length || !rooms?.length) {
      toast({
        title: "Incomplete Data",
        description: "Please ensure Teachers, Units, and Rooms are defined.",
        variant: "destructive"
      })
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateInitialTimetable({
        teachers: teachers.map(t => ({
          id: t.id,
          name: t.name,
          availability: t.availability || [],
          qualifiedUnits: t.qualifiedUnits || [],
          campuses: t.campuses || []
        })),
        units: units.map(u => ({
          id: u.id,
          name: u.name,
          type: u.type,
          durationHours: u.durationHours,
          sessionsPerWeek: u.sessionsPerWeek
        })),
        schedulingRules: rulesData?.map((r: any) => r.name) || []
      })
      
      // Batch clear and replace sessions
      const batch = writeBatch(db)
      
      // Clear existing
      sessions?.forEach(s => {
        batch.delete(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", s.id))
      })

      // Add new
      result.timetable.forEach((entry: any, idx: number) => {
        const id = `ai-gen-${Date.now()}-${idx}`
        batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id), {
          ...entry,
          id
        })
      })
      
      await batch.commit()
      
      toast({
        title: "AI Timetable Generated",
        description: `Successfully scheduled ${result.timetable.length} sessions.`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Generation Failed",
        description: "An error occurred while running the AI scheduler.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const getEntryForSlot = (day: string, hour: string) => {
    return sessions?.find(entry => entry.day === day && entry.startTime === hour)
  }

  // Detect logical conflicts in the UI
  const detectedConflicts: string[] = []
  if (sessions) {
    const teacherUsage: Record<string, string[]> = {}
    const roomUsage: Record<string, string[]> = {}

    sessions.forEach(s => {
      const slotKey = `${s.day}-${s.startTime}`
      
      // Teacher Overlap
      if (!teacherUsage[s.teacherId]) teacherUsage[s.teacherId] = []
      if (teacherUsage[s.teacherId].includes(slotKey)) {
        const teacherName = teachers?.find(t => t.id === s.teacherId)?.name
        detectedConflicts.push(`Teacher ${teacherName} has overlapping classes at ${s.day} ${s.startTime}`)
      }
      teacherUsage[s.teacherId].push(slotKey)

      // Room Overlap
      if (!roomUsage[s.room]) roomUsage[s.room] = []
      if (roomUsage[s.room].includes(slotKey)) {
        detectedConflicts.push(`Room ${s.room} has multiple classes scheduled at ${s.day} ${s.startTime}`)
      }
      roomUsage[s.room].push(slotKey)
    })
  }

  if (loadingTeachers || loadingUnits || loadingRooms || loadingSessions) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Timetable Matching</h2>
          <p className="text-muted-foreground">Match teachers, units, and rooms into the weekly schedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add Matching
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule a Class Session</DialogTitle>
                <DialogDescription>Manually match a teacher with a unit and a room.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Academic Unit</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger><SelectValue placeholder="Select Unit" /></SelectTrigger>
                    <SelectContent>
                      {units?.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.type})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Teacher</Label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger><SelectValue placeholder="Select Teacher" /></SelectTrigger>
                    <SelectContent>
                      {teachers?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room</Label>
                  <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                    <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                    <SelectContent>
                      {rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.name} - {r.campus}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Select value={selectedDay} onValueChange={(v: Day) => setSelectedDay(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select value={selectedTime} onValueChange={setSelectedTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddSession}>Add to Schedule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={handleGenerate} disabled={isGenerating} size="sm">
            {isGenerating ? "AI Processing..." : (
              <>
                <Wand2 className="mr-2 h-4 w-4" /> AI Generator
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden border-none shadow-xl bg-card/40 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="font-semibold">Interactive Weekly Grid</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" /> Theory
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-orange-500" /> Practical
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-[80px_repeat(5,1fr)] min-w-[800px]">
                {/* Header */}
                <div className="h-12 border-b bg-muted/20" />
                {DAYS.map(day => (
                  <div key={day} className="h-12 border-b flex items-center justify-center font-bold text-sm bg-muted/20">
                    {day}
                  </div>
                ))}

                {/* Grid Rows */}
                {HOURS.map(hour => (
                  <div key={hour} className="contents">
                    <div className="h-24 border-b border-r flex items-center justify-center text-xs font-mono text-muted-foreground">
                      {hour}
                    </div>
                    {DAYS.map(day => {
                      const entry = getEntryForSlot(day, hour)
                      const unit = units?.find(u => u.id === entry?.unitId)
                      const teacher = teachers?.find(t => t.id === entry?.teacherId)
                      
                      return (
                        <div key={`${day}-${hour}`} className="h-24 border-b border-r p-1 relative group bg-background/50">
                          {entry ? (
                            <div 
                              className={cn(
                                "w-full h-full rounded-md p-2 text-white shadow-md transition-all group-hover:scale-[1.02] cursor-pointer overflow-hidden relative",
                                unit?.type === 'theory' ? "bg-blue-500 hover:bg-blue-600" : "bg-orange-500 hover:bg-orange-600",
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{unit?.type}</span>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-5 w-5 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDeleteSession(entry.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-[11px] font-bold line-clamp-2 leading-tight mt-0.5">{unit?.name}</p>
                              <div className="mt-auto pt-1 flex flex-col gap-0.5">
                                <p className="text-[10px] opacity-90 truncate flex items-center gap-1">
                                  <Users className="h-2.5 w-2.5" /> {teacher?.name}
                                </p>
                                <p className="text-[9px] font-mono opacity-80 flex items-center gap-1">
                                  <DoorOpen className="h-2.5 w-2.5" /> {entry.room}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 rounded-full bg-muted"
                                onClick={() => {
                                  setSelectedDay(day as Day)
                                  setSelectedTime(hour)
                                  setIsAddOpen(true)
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <AlertTriangle className={cn("h-5 w-5", detectedConflicts.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                Conflict Monitor
              </CardTitle>
              <CardDescription>Real-time schedule integrity check.</CardDescription>
            </CardHeader>
            <CardContent>
              {detectedConflicts.length > 0 ? (
                <div className="space-y-3">
                  {detectedConflicts.map((conflict, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-[10px] font-medium text-destructive flex gap-2">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {conflict}
                    </div>
                  ))}
                  <Button variant="outline" className="w-full text-xs h-8" size="sm" onClick={handleGenerate}>
                    Auto-Resolve with AI
                  </Button>
                </div>
              ) : sessions && sessions.length > 0 ? (
                <div className="flex flex-col items-center py-6 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium">Schedule is Stable</p>
                  <p className="text-xs text-muted-foreground">All teachers and rooms are uniquely assigned.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center space-y-2 text-muted-foreground">
                  <Info className="h-10 w-10 opacity-20" />
                  <p className="text-xs italic">Schedule sessions to see conflict analysis.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-xs">
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Matched Sessions</span>
                <span className="font-bold">{sessions?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Teachers Scheduled</span>
                <span className="font-bold">
                  {new Set(sessions?.map(s => s.teacherId)).size} / {teachers?.length || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">Rooms Utilized</span>
                <span className="font-bold">
                  {new Set(sessions?.map(s => s.room)).size} / {rooms?.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
