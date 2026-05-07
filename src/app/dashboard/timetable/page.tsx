
"use client"

import React, { useState, useMemo } from "react"
import { 
  Wand2, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  Info,
  CheckCircle2,
  Users,
  Plus,
  Loader2,
  Trash2,
  DoorOpen,
  Layers,
  Filter,
  CalendarDays
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { DAYS, HOURS, CAMPUSES } from "@/lib/mock-data"
import { generateInitialTimetable } from "@/ai/flows/generate-initial-timetable"
import { TimetableEntry, Teacher, Unit, Room, Day, Campus } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, writeBatch } from "firebase/firestore"
import { deleteDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase/non-blocking-updates"

const ACTIVE_TIMETABLE_ID = "default-timetable"
const ROW_HEIGHT = 80 // Increased row height for single-day clarity

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
  const [filterCampus, setFilterCampus] = useState<Campus | "All">("All")
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  
  const currentDay = DAYS[currentDayIndex]

  // New Session Form State
  const [selectedUnit, setSelectedUnit] = useState("")
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedTime, setSelectedTime] = useState("09:00")

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    let data = sessions.filter(s => s.day === currentDay)
    
    if (filterCampus !== "All") {
      data = data.filter(s => {
        const room = rooms?.find(r => r.name === s.room)
        return room?.campus === filterCampus
      })
    }
    return data
  }, [sessions, currentDay, filterCampus, rooms])

  const handleAddSession = () => {
    if (!selectedUnit || !selectedTeacher || !selectedRoom) {
      toast({ title: "Validation Error", description: "Please match all entities (Teacher, Unit, Room).", variant: "destructive" })
      return
    }

    const unit = units?.find(u => u.id === selectedUnit)
    const sessionId = `session-${Date.now()}`
    
    const startHour = parseInt(selectedTime.split(':')[0])
    const duration = unit?.durationHours || 1
    const endHour = Math.min(startHour + duration, 24)
    const endTime = `${endHour.toString().padStart(2, '0')}:00`

    const newSession: TimetableEntry = {
      id: sessionId,
      unitId: selectedUnit,
      teacherId: selectedTeacher,
      room: rooms?.find(r => r.id === selectedRoom)?.name || "Unknown",
      day: currentDay,
      startTime: selectedTime,
      endTime: endTime
    }

    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), newSession, { merge: true })
    
    setIsAddOpen(false)
    toast({ title: "Session Added", description: `Scheduled ${unit?.name} for ${currentDay}.` })
  }

  const handleDeleteSession = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id))
    toast({ title: "Session Removed", description: "The scheduled session has been deleted." })
  }

  const handleGenerate = async () => {
    if (!teachers?.length || !units?.length || !rooms?.length) {
      toast({ title: "Incomplete Data", description: "Missing Teacher, Unit, or Room definitions.", variant: "destructive" })
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
      
      const batch = writeBatch(db)
      sessions?.forEach(s => {
        batch.delete(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", s.id))
      })

      result.timetable.forEach((entry: any, idx: number) => {
        const id = `ai-gen-${Date.now()}-${idx}`
        batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id), {
          ...entry,
          id
        })
      })
      
      await batch.commit()
      toast({ title: "AI Timetable Generated", description: `Successfully scheduled ${result.timetable.length} sessions.` })
    } catch (error) {
      console.error(error)
      toast({ title: "Generation Failed", description: "Error running the AI scheduler.", variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const navigateDay = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentDayIndex((prev) => (prev + 1) % DAYS.length)
    } else {
      setCurrentDayIndex((prev) => (prev - 1 + DAYS.length) % DAYS.length)
    }
  }

  // Detect logical conflicts
  const detectedConflicts: string[] = []
  if (sessions && teachers) {
    const teacherUsage: Record<string, string[]> = {}
    const roomUsage: Record<string, string[]> = {}

    sessions.forEach(s => {
      const start = parseInt(s.startTime.split(':')[0])
      const end = parseInt(s.endTime.split(':')[0])
      
      for (let h = start; h < end; h++) {
        const slotKey = `${s.day}-${h.toString().padStart(2, '0')}:00`
        
        if (!teacherUsage[s.teacherId]) teacherUsage[s.teacherId] = []
        if (teacherUsage[s.teacherId].includes(slotKey)) {
          const teacherName = teachers?.find(t => t.id === s.teacherId)?.name
          const conflictMsg = `Teacher ${teacherName} is double-booked at ${s.day} ${h}:00`
          if (!detectedConflicts.includes(conflictMsg)) detectedConflicts.push(conflictMsg)
        }
        teacherUsage[s.teacherId].push(slotKey)

        if (!roomUsage[s.room]) roomUsage[s.room] = []
        if (roomUsage[s.room].includes(slotKey)) {
          const conflictMsg = `Room ${s.room} has multiple classes at ${s.day} ${h}:00`
          if (!detectedConflicts.includes(conflictMsg)) detectedConflicts.push(conflictMsg)
        }
        roomUsage[s.room].push(slotKey)
      }
    })
  }

  // Layout Logic for Overlapping Sessions (Side-by-side)
  const positionedSessions = useMemo(() => {
    const sorted = [...filteredSessions].sort((a, b) => a.startTime.localeCompare(b.startTime))
    const columns: TimetableEntry[][] = []
    
    sorted.forEach(session => {
      let placed = false
      for (let i = 0; i < columns.length; i++) {
        const lastInCol = columns[i][columns[i].length - 1]
        if (session.startTime >= lastInCol.endTime) {
          columns[i].push(session)
          placed = true
          break
        }
      }
      if (!placed) {
        columns.push([session])
      }
    })

    return columns.flatMap((colSessions, colIdx) => 
      colSessions.map(session => ({
        ...session,
        colIdx,
        colSpan: columns.length
      }))
    )
  }, [filteredSessions])

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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Daily Planner</h2>
          <p className="text-muted-foreground">View overlapping sessions side-by-side for high-resolution scheduling.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border text-xs mr-2">
            <Filter className="h-3 w-3 ml-2" />
            <span className="font-semibold">Filter:</span>
            <Select value={filterCampus} onValueChange={(v: any) => setFilterCampus(v)}>
              <SelectTrigger className="h-8 border-none bg-transparent shadow-none w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Campuses</SelectItem>
                {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" /> Add Match
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Match for {currentDay}</DialogTitle>
                <DialogDescription>Match a teacher, unit, and room for this day.</DialogDescription>
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
        <div className="lg:col-span-3">
          <Card className="overflow-hidden border-none shadow-xl bg-card/40 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={() => navigateDay('prev')}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex flex-col items-center min-w-[150px]">
                    <span className="text-xl font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <CalendarDays className="h-5 w-5" />
                      {currentDay}
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => navigateDay('next')}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider hidden md:flex">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Theory</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> Practical</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative overflow-y-auto max-h-[1000px]">
                {/* Time Grid Background */}
                <div 
                  className="grid border-b w-full"
                  style={{ 
                    gridTemplateColumns: "100px 1fr",
                    gridTemplateRows: `repeat(${HOURS.length}, ${ROW_HEIGHT}px)`
                  }}
                >
                  {HOURS.map((hour, rowIdx) => (
                    <React.Fragment key={hour}>
                      <div 
                        style={{ gridRow: rowIdx + 1, gridColumn: 1 }} 
                        className="border-b border-r flex items-center justify-center text-xs font-mono text-muted-foreground bg-muted/5 sticky left-0 z-20"
                      >
                        {hour}
                      </div>
                      <div 
                        style={{ gridRow: rowIdx + 1, gridColumn: 2 }} 
                        className="border-b group relative bg-background/30"
                      >
                        <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-0">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20"
                            onClick={() => {
                              setSelectedTime(hour)
                              setIsAddOpen(true)
                            }}
                          >
                            <Plus className="h-4 w-4 text-primary" />
                          </Button>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {/* Session Overlays with Side-by-Side Multi-Lane Support */}
                <div className="absolute top-0 left-[100px] right-0 h-full pointer-events-none">
                  {positionedSessions.map(entry => {
                    const unit = units?.find(u => u.id === entry.unitId)
                    const teacher = teachers?.find(t => t.id === entry.teacherId)
                    const startHour = parseInt(entry.startTime.split(':')[0])
                    const duration = (parseInt(entry.endTime.split(':')[0]) || 24) - startHour
                    
                    const laneWidth = 100 / entry.colSpan
                    const leftPos = entry.colIdx * laneWidth

                    return (
                      <div 
                        key={entry.id}
                        className="absolute z-10 p-1 pointer-events-auto transition-all"
                        style={{
                          top: startHour * ROW_HEIGHT,
                          height: duration * ROW_HEIGHT,
                          left: `${leftPos}%`,
                          width: `${laneWidth}%`
                        }}
                      >
                        <div 
                          className={cn(
                            "w-full h-full rounded-lg border border-white/20 shadow-xl p-3 text-white flex flex-col group overflow-hidden cursor-pointer",
                            unit?.type === 'theory' ? "bg-blue-600/90 hover:bg-blue-700" : "bg-orange-600/90 hover:bg-orange-700"
                          )}
                        >
                          <div className="flex justify-between items-start mb-1">
                             <div className="text-[9px] font-black uppercase bg-black/30 px-2 py-0.5 rounded-full">{unit?.type}</div>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-5 w-5 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100"
                               onClick={(e) => {
                                 e.stopPropagation()
                                 handleDeleteSession(entry.id)
                               }}
                             >
                               <Trash2 className="h-3 w-3" />
                             </Button>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="flex-1 min-h-0">
                                <p className="text-sm font-black leading-tight hover:underline">
                                  {unit?.name}
                                </p>
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-72">
                              <DropdownMenuLabel className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Subject Schedule
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {sessions?.filter(s => s.unitId === entry.unitId).map(s => (
                                <DropdownMenuItem key={s.id} className="text-xs flex flex-col items-start py-2">
                                  <div className="font-bold">{s.day} {s.startTime}-{s.endTime}</div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <DoorOpen className="h-3 w-3" /> {s.room} • <Users className="h-3 w-3" /> {teachers?.find(t => t.id === s.teacherId)?.name}
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <div className="mt-auto space-y-1">
                            <div className="flex items-center gap-2 text-[11px] font-semibold opacity-90 truncate">
                               <Users className="h-3 w-3 shrink-0" />
                               {teacher?.name}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-mono opacity-90 truncate">
                               <DoorOpen className="h-3 w-3 shrink-0" />
                               {entry.room}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-none bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <AlertTriangle className={cn("h-5 w-5", detectedConflicts.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                Daily Integrity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detectedConflicts.filter(c => c.includes(currentDay)).length > 0 ? (
                <div className="space-y-3">
                  {detectedConflicts.filter(c => c.includes(currentDay)).map((conflict, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-[10px] font-medium text-destructive flex gap-2">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {conflict}
                    </div>
                  ))}
                  <Button variant="outline" className="w-full text-xs h-8 border-destructive/30" size="sm" onClick={handleGenerate}>
                    AI Re-Balance
                  </Button>
                </div>
              ) : filteredSessions.length > 0 ? (
                <div className="flex flex-col items-center py-6 text-center space-y-2">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-sm font-semibold">Conflict-Free Day</p>
                  <p className="text-[10px] text-muted-foreground">All resources for {currentDay} are correctly allocated.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center space-y-2 text-muted-foreground opacity-50">
                  <Info className="h-8 w-8" />
                  <p className="text-xs italic">No sessions scheduled for today.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-headline">Day Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Classes</p>
                  <p className="text-xl font-black">{filteredSessions.length}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Staff</p>
                  <p className="text-xl font-black">
                    {new Set(filteredSessions.map(s => s.teacherId)).size}
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase">Campus Activity</p>
                 {CAMPUSES.map(campus => {
                   const count = filteredSessions.filter(s => {
                     const room = rooms?.find(r => r.name === s.room)
                     return room?.campus === campus
                   }).length
                   return (
                     <div key={campus} className="flex justify-between items-center text-[10px]">
                        <span className="font-medium text-muted-foreground">{campus}</span>
                        <span className="font-black">{count}</span>
                     </div>
                   )
                 })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
