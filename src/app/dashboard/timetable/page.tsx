
"use client"

import React, { useState, useMemo, useEffect } from "react"
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
  CalendarDays,
  LayoutGrid,
  List,
  Database
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DAYS, HOURS, CAMPUSES, NOVUS_TRAINERS, NOVUS_UNITS, NOVUS_ROOMS } from "@/lib/mock-data"
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
  const [isSeeding, setIsSeeding] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [filterCampus, setFilterCampus] = useState<Campus | "All">("All")
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily")
  
  const currentDay = DAYS[currentDayIndex]

  // New Session Form State
  const [selectedUnit, setSelectedUnit] = useState("")
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedStartTime, setSelectedStartTime] = useState("09:00")
  const [selectedEndTime, setSelectedEndTime] = useState("11:00")

  // Auto-calculate suggested end time
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

  const allFilteredSessions = useMemo(() => {
    if (!sessions) return []
    let data = [...sessions]
    
    if (filterCampus !== "All") {
      data = data.filter(s => {
        const room = rooms?.find(r => r.name === s.room)
        return room?.campus === filterCampus
      })
    }
    
    return data.sort((a, b) => {
      const dayIndexA = DAYS.indexOf(a.day)
      const dayIndexB = DAYS.indexOf(b.day)
      if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB
      return a.startTime.localeCompare(b.startTime)
    })
  }, [sessions, filterCampus, rooms])

  const filteredSessions = useMemo(() => {
    return allFilteredSessions.filter(s => s.day === currentDay)
  }, [allFilteredSessions, currentDay])

  const handleAddSession = () => {
    if (!selectedUnit || !selectedTeacher || !selectedRoom) {
      toast({ title: "Validation Error", description: "Please select all required entities.", variant: "destructive" })
      return
    }

    const unit = units?.find(u => u.id === selectedUnit)
    const sessionId = `session-${Date.now()}`
    
    const newSession: TimetableEntry = {
      id: sessionId,
      unitId: selectedUnit,
      teacherId: selectedTeacher,
      room: rooms?.find(r => r.id === selectedRoom)?.name || "Unknown",
      day: currentDay,
      startTime: selectedStartTime,
      endTime: selectedEndTime
    }

    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), newSession, { merge: true })
    setIsAddOpen(false)
    toast({ title: "Session Added", description: `Scheduled ${unit?.name}.` })
  }

  const handleDeleteSession = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id))
    toast({ title: "Session Removed", description: "The scheduled session has been deleted." })
  }

  const handleSeedDemoData = async () => {
    setIsSeeding(true)
    const batch = writeBatch(db)
    
    try {
      // 1. Seed Teachers
      NOVUS_TRAINERS.forEach(t => {
        batch.set(doc(db, "teachers", t.id), t)
      })
      
      // 2. Seed Units
      NOVUS_UNITS.forEach(u => {
        batch.set(doc(db, "academicUnits", u.id), u)
      })
      
      // 3. Seed Rooms
      NOVUS_ROOMS.forEach(r => {
        batch.set(doc(db, "rooms", r.id), r)
      })

      await batch.commit()
      toast({ title: "Demo Data Seeded", description: "All Novus faculty, units, and rooms are now in Firestore." })
    } catch (error) {
      toast({ title: "Seeding Failed", variant: "destructive" })
    } finally {
      setIsSeeding(false)
    }
  }

  const handleGenerate = async () => {
    if (!teachers?.length || !units?.length || !rooms?.length) {
      toast({ title: "Incomplete Data", description: "Seed the demo data first.", variant: "destructive" })
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
      toast({ title: "Generation Failed", variant: "destructive" })
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
      const end = parseInt(s.endTime.split(':')[0]) || 24
      
      for (let h = start; h < end; h++) {
        const slotKey = `${s.day}-${h.toString().padStart(2, '0')}:00`
        
        if (!teacherUsage[s.teacherId]) teacherUsage[s.teacherId] = []
        if (teacherUsage[s.teacherId].includes(slotKey)) {
          const teacherName = teachers?.find(t => t.id === s.teacherId)?.name
          const conflictMsg = `Teacher ${teacherName} double-booked at ${s.day} ${h}:00`
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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Overview</h2>
          <p className="text-muted-foreground">Novus institution scheduling system.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSeedDemoData} 
            disabled={isSeeding}
            className="text-primary border-primary/20 hover:bg-primary/5"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            Seed Novus Data
          </Button>

          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="mr-2">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="daily" className="gap-2 h-8">
                <LayoutGrid className="h-4 w-4" /> Daily Grid
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2 h-8">
                <List className="h-4 w-4" /> Weekly List
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border text-xs mr-2">
            <Filter className="h-3 w-3 ml-2" />
            <span className="font-semibold">Campus:</span>
            <Select value={filterCampus} onValueChange={(v: any) => setFilterCampus(v)}>
              <SelectTrigger className="h-8 border-none bg-transparent shadow-none w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Sites</SelectItem>
                {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="mr-2 h-4 w-4" /> Match Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Match Session for {currentDay}</DialogTitle>
                <DialogDescription>Define the exact timeframe for this class session.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Academic Unit</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>
                      {units?.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select value={selectedStartTime} onValueChange={setSelectedStartTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select value={selectedEndTime} onValueChange={setSelectedEndTime}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Teacher</Label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger><SelectValue placeholder="Select Instructor" /></SelectTrigger>
                    <SelectContent>
                      {teachers?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Assigned Room</Label>
                  <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                    <SelectTrigger><SelectValue placeholder="Select Room" /></SelectTrigger>
                    <SelectContent>
                      {rooms?.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.campus})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddSession} className="w-full">Create Match</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button onClick={handleGenerate} disabled={isGenerating} size="sm" className="bg-primary/90">
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
          {viewMode === 'daily' ? (
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
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative overflow-y-auto max-h-[1200px]">
                  <div 
                    className="grid border-b w-full"
                    style={{ 
                      gridTemplateColumns: "80px 1fr",
                      gridTemplateRows: `repeat(${HOURS.length}, ${ROW_HEIGHT}px)`
                    }}
                  >
                    {HOURS.map((hour, rowIdx) => (
                      <React.Fragment key={hour}>
                        <div className="border-b border-r flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-muted/5 sticky left-0 z-20">
                          {hour}
                        </div>
                        <div className="border-b group relative bg-background/30">
                          <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-0">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20"
                              onClick={() => {
                                setSelectedStartTime(hour)
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

                  <div className="absolute top-0 left-[80px] right-0 h-full pointer-events-none">
                    {positionedSessions.map(entry => {
                      const unit = units?.find(u => u.id === entry.unitId)
                      const teacher = teachers?.find(t => t.id === entry.teacherId)
                      const startHour = parseInt(entry.startTime.split(':')[0])
                      const endHourNum = parseInt(entry.endTime.split(':')[0]) || 24
                      const duration = Math.max(endHourNum - startHour, 0.5)
                      
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
                               <div className="text-[8px] font-black uppercase bg-black/30 px-2 py-0.5 rounded-full">
                                 {entry.startTime} - {entry.endTime}
                               </div>
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
                                  <p className="text-xs font-black leading-tight hover:underline">
                                    {unit?.name}
                                  </p>
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-72">
                                <DropdownMenuLabel className="flex items-center gap-2">
                                  <Layers className="h-4 w-4" />
                                  Subject Timeline
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
                              <div className="flex items-center gap-2 text-[10px] font-semibold opacity-90 truncate">
                                 <Users className="h-3 w-3 shrink-0" />
                                 {teacher?.name}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] font-mono opacity-90 truncate">
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
          ) : (
            <Card className="border-none shadow-xl bg-card">
              <CardHeader>
                <CardTitle className="font-headline">Weekly Session List</CardTitle>
                <CardDescription>Comprehensive overview of all Novus scheduled classes.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Academic Unit</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allFilteredSessions.map((session) => {
                        const unit = units?.find(u => u.id === session.unitId)
                        const teacher = teachers?.find(t => t.id === session.teacherId)
                        return (
                          <TableRow key={session.id} className="group">
                            <TableCell className="font-bold text-xs uppercase text-primary/70">{session.day}</TableCell>
                            <TableCell className="text-xs font-mono">{session.startTime} - {session.endTime}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm">{unit?.name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{unit?.type}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{teacher?.name}</TableCell>
                            <TableCell className="text-sm">{session.room}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleDeleteSession(session.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {allFilteredSessions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                            No classes scheduled yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-none bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <AlertTriangle className={cn("h-5 w-5", detectedConflicts.filter(c => c.includes(viewMode === 'daily' ? currentDay : '') || viewMode === 'weekly').length > 0 ? "text-destructive" : "text-muted-foreground")} />
                Conflict Monitor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {detectedConflicts.filter(c => viewMode === 'daily' ? c.includes(currentDay) : true).length > 0 ? (
                <div className="space-y-3">
                  {detectedConflicts.filter(c => viewMode === 'daily' ? c.includes(currentDay) : true).map((conflict, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-[10px] font-medium text-destructive flex gap-2">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {conflict}
                    </div>
                  ))}
                  <Button variant="outline" className="w-full text-xs h-8 border-destructive/30" size="sm" onClick={handleGenerate}>
                    AI Re-Balance
                  </Button>
                </div>
              ) : (sessions?.length || 0) > 0 ? (
                <div className="flex flex-col items-center py-6 text-center space-y-2">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <p className="text-sm font-semibold">Integrity Verified</p>
                  <p className="text-[10px] text-muted-foreground">All Novus resources are validly allocated.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center space-y-2 text-muted-foreground opacity-50">
                  <Info className="h-8 w-8" />
                  <p className="text-xs italic">No matches scheduled.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-headline">Session Audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Sessions</p>
                  <p className="text-xl font-black">{viewMode === 'daily' ? filteredSessions.length : allFilteredSessions.length}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Trainers</p>
                  <p className="text-xl font-black">
                    {new Set((viewMode === 'daily' ? filteredSessions : allFilteredSessions).map(s => s.teacherId)).size}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
