
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
  Filter
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
const ROW_HEIGHT = 64

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
  
  // New Session Form State
  const [selectedUnit, setSelectedUnit] = useState("")
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedDay, setSelectedDay] = useState<Day>("Monday")
  const [selectedTime, setSelectedTime] = useState("09:00")

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    if (filterCampus === "All") return sessions
    return sessions.filter(s => {
      const room = rooms?.find(r => r.name === s.room)
      return room?.campus === filterCampus
    })
  }, [sessions, filterCampus, rooms])

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

  // Layout Logic for Overlapping Sessions
  const getPositionedSessions = (day: string) => {
    const daySessions = filteredSessions.filter(s => s.day === day)
    const sorted = [...daySessions].sort((a, b) => a.startTime.localeCompare(b.startTime))
    
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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Institutional Timetable</h2>
          <p className="text-muted-foreground">Manage overlapping class sessions across all campuses.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border text-xs">
            <Filter className="h-3 w-3 ml-2" />
            <span className="font-semibold">Campus:</span>
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
        <div className="lg:col-span-3">
          <Card className="overflow-hidden border-none shadow-xl bg-card/40 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Institution-wide 24h Weekly View</h3>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Theory</div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" /> Practical</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[1200px] relative">
                {/* Time Grid Background */}
                <div 
                  className="grid border-b"
                  style={{ 
                    gridTemplateColumns: "80px repeat(7, 1fr)",
                    gridTemplateRows: `48px repeat(${HOURS.length}, ${ROW_HEIGHT}px)`
                  }}
                >
                  <div className="row-start-1 col-start-1 bg-muted/20 border-b border-r" />
                  {DAYS.map((day, i) => (
                    <div key={day} style={{ gridColumn: i + 2 }} className="row-start-1 border-b border-r flex items-center justify-center font-bold text-xs bg-muted/20 uppercase tracking-widest text-muted-foreground">
                      {day}
                    </div>
                  ))}

                  {HOURS.map((hour, rowIdx) => (
                    <React.Fragment key={hour}>
                      <div 
                        style={{ gridRow: rowIdx + 2, gridColumn: 1 }} 
                        className="border-b border-r flex items-center justify-center text-[10px] font-mono text-muted-foreground bg-muted/5"
                      >
                        {hour}
                      </div>
                      {DAYS.map((day, colIdx) => (
                        <div 
                          key={`${day}-${hour}`} 
                          style={{ gridRow: rowIdx + 2, gridColumn: colIdx + 2 }} 
                          className="border-b border-r group relative bg-background/30"
                        >
                          <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-0">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20"
                              onClick={() => {
                                setSelectedDay(day as Day)
                                setSelectedTime(hour)
                                setIsAddOpen(true)
                              }}
                            >
                              <Plus className="h-3 w-3 text-primary" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>

                {/* Session Overlays with Multi-Lane Support */}
                {DAYS.map((day, dayIdx) => {
                  const daySessions = getPositionedSessions(day)
                  return daySessions.map(entry => {
                    const unit = units?.find(u => u.id === entry.unitId)
                    const teacher = teachers?.find(t => t.id === entry.teacherId)
                    const startHour = parseInt(entry.startTime.split(':')[0])
                    const duration = parseInt(entry.endTime.split(':')[0]) - startHour
                    
                    const leftOffset = (entry.colIdx / entry.colSpan) * 100
                    const width = (1 / entry.colSpan) * 100

                    return (
                      <div 
                        key={entry.id}
                        className="absolute z-10 transition-all p-0.5"
                        style={{
                          top: 48 + (startHour * ROW_HEIGHT),
                          height: duration * ROW_HEIGHT,
                          left: `calc(80px + (${dayIdx} * (100% - 80px) / 7) + (${leftOffset}% * (100% - 80px) / 7 / 100))`,
                          width: `calc((${width}% * (100% - 80px) / 7 / 100) - 2px)`
                        }}
                      >
                        <div 
                          className={cn(
                            "w-full h-full rounded border border-white/20 shadow-lg p-2 text-white flex flex-col group overflow-hidden cursor-pointer",
                            unit?.type === 'theory' ? "bg-blue-600/95 hover:bg-blue-700" : "bg-orange-600/95 hover:bg-orange-700"
                          )}
                        >
                          <div className="flex justify-between items-start">
                             <div className="text-[7px] font-black uppercase bg-black/20 px-1 rounded">{unit?.type}</div>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-4 w-4 text-white hover:bg-white/20 opacity-0 group-hover:opacity-100"
                               onClick={(e) => {
                                 e.stopPropagation()
                                 handleDeleteSession(entry.id)
                               }}
                             >
                               <Trash2 className="h-2.5 w-2.5" />
                             </Button>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="flex-1 min-h-0">
                                <p className="text-[10px] font-bold leading-tight mt-1 line-clamp-2 hover:underline">
                                  {unit?.name}
                                </p>
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-64">
                              <DropdownMenuLabel className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                Subject Timeline
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {sessions?.filter(s => s.unitId === entry.unitId).map(s => (
                                <DropdownMenuItem key={s.id} className="text-xs flex flex-col items-start py-2">
                                  <div className="font-semibold">{s.day} {s.startTime}-{s.endTime}</div>
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <DoorOpen className="h-2.5 w-2.5" /> {s.room} • <Users className="h-2.5 w-2.5" /> {teachers?.find(t => t.id === s.teacherId)?.name}
                                  </div>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <div className="mt-auto space-y-0.5">
                            <div className="flex items-center gap-1 text-[8px] opacity-80">
                               <Users className="h-2 w-2" />
                               <span className="truncate">{teacher?.name}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[8px] opacity-80 font-mono">
                               <DoorOpen className="h-2 w-2" />
                               <span className="truncate">{entry.room}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-none bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <AlertTriangle className={cn("h-5 w-5", detectedConflicts.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                Conflict Monitor
              </CardTitle>
              <CardDescription className="text-xs">Physical and personnel overlap checks.</CardDescription>
            </CardHeader>
            <CardContent>
              {detectedConflicts.length > 0 ? (
                <div className="space-y-3">
                  {detectedConflicts.map((conflict, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-[10px] font-medium text-destructive flex gap-2">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {conflict}
                    </div>
                  ))}
                  <Button variant="outline" className="w-full text-xs h-8 border-destructive/30 hover:bg-destructive/10" size="sm" onClick={handleGenerate}>
                    Auto-Resolve with AI
                  </Button>
                </div>
              ) : sessions && sessions.length > 0 ? (
                <div className="flex flex-col items-center py-6 text-center space-y-2">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-sm font-semibold">Integrity Verified</p>
                  <p className="text-[10px] text-muted-foreground">All rooms and staff are correctly distributed.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center space-y-2 text-muted-foreground opacity-50">
                  <Info className="h-8 w-8" />
                  <p className="text-xs italic">Awaiting schedule data...</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-headline">Session Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Total</p>
                  <p className="text-xl font-black">{sessions?.length || 0}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Staff</p>
                  <p className="text-xl font-black">
                    {new Set(sessions?.map(s => s.teacherId)).size}
                  </p>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase">Top Rooms</p>
                 {Array.from(new Set(sessions?.map(s => s.room))).slice(0, 3).map(room => (
                   <div key={room} className="flex justify-between items-center text-[10px]">
                      <span className="font-medium text-muted-foreground">{room}</span>
                      <span className="font-black">{sessions?.filter(s => s.room === room).length} sessions</span>
                   </div>
                 ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
