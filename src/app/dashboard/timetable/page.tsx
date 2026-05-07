
"use client"

import React, { useState, useMemo, useEffect } from "react"
import { 
  ChevronLeft, 
  ChevronRight, 
  Info,
  CheckCircle2,
  Users,
  Plus,
  Loader2,
  Trash2,
  DoorOpen,
  Filter,
  CalendarDays,
  LayoutGrid,
  List,
  Database,
  BookOpen,
  User as UserIcon,
  Clock,
  Layers,
  Globe,
  Settings2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DAYS, HOURS, CAMPUSES, NOVUS_TRAINERS, NOVUS_UNITS, NOVUS_ROOMS, NOVUS_SCHEDULE_RAW } from "@/lib/mock-data"
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
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  // Local UI State
  const [isSeeding, setIsSeeding] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [filterCampus, setFilterCampus] = useState<Campus | "All">("All")
  const [filterTeacher, setFilterTeacher] = useState<string | "All">("All")
  const [filterUnit, setFilterUnit] = useState<string | "All">("All")
  const [filterType, setFilterType] = useState<string | "All">("All")
  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily")
  
  const currentDay = DAYS[currentDayIndex]

  // New Session Form State
  const [selectedUnit, setSelectedUnit] = useState("")
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedStartTime, setSelectedStartTime] = useState("09:00")
  const [selectedEndTime, setSelectedEndTime] = useState("11:00")

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

  const allFilteredSessions = useMemo(() => {
    if (!sessions) return []
    let data = [...sessions]
    
    // Filter by Site (Campus)
    if (filterCampus !== "All") {
      data = data.filter(s => {
        const room = rooms?.find(r => r.name === s.room)
        return room?.campus === filterCampus
      })
    }

    // Filter by Teacher
    if (filterTeacher !== "All") {
      data = data.filter(s => s.teacherId === filterTeacher)
    }

    // Filter by Subject (Unit)
    if (filterUnit !== "All") {
      data = data.filter(s => s.unitId === filterUnit)
    }

    // Filter by Delivery Mode (Type)
    if (filterType !== "All") {
      data = data.filter(s => {
        const unit = units?.find(u => u.id === s.unitId)
        return unit?.type === filterType
      })
    }
    
    return data.sort((a, b) => {
      const dayIndexA = DAYS.indexOf(a.day)
      const dayIndexB = DAYS.indexOf(b.day)
      if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB
      return a.startTime.localeCompare(b.startTime)
    })
  }, [sessions, filterCampus, filterTeacher, filterUnit, filterType, rooms, units])

  const filteredSessions = useMemo(() => {
    return allFilteredSessions.filter(s => s.day === currentDay)
  }, [allFilteredSessions, currentDay])

  const handleAddSession = () => {
    if (!selectedUnit || !selectedTeacher || !selectedRoom) {
      toast({ title: "Validation Error", description: "Please select all required entities.", variant: "destructive" })
      return
    }

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
    toast({ title: "Session Added", description: `Scheduled successfully.` })
  }

  const handleDeleteSession = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id))
    toast({ title: "Session Removed", description: "The scheduled session has been deleted." })
  }

  const handleSeedDemoData = async () => {
    setIsSeeding(true)
    const batch = writeBatch(db)
    
    try {
      NOVUS_TRAINERS.forEach(t => batch.set(doc(db, "teachers", t.id), t))
      NOVUS_UNITS.forEach(u => batch.set(doc(db, "academicUnits", u.id), u))
      NOVUS_ROOMS.forEach(r => batch.set(doc(db, "rooms", r.id), r))

      NOVUS_SCHEDULE_RAW.forEach((entry, idx) => {
        const id = `novus-seed-${idx}`
        batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id), { ...entry, id })
      })

      await batch.commit()
      toast({ title: "Novus Institutional Data Seeded", description: "130+ sessions mapped to the full 7-day schedule." })
    } catch (error) {
      toast({ title: "Seeding Failed", variant: "destructive" })
    } finally {
      setIsSeeding(false)
    }
  }

  const navigateDay = (direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentDayIndex((prev) => (prev + 1) % DAYS.length)
    } else {
      setCurrentDayIndex((prev) => (prev - 1 + DAYS.length) % DAYS.length)
    }
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
      if (!placed) columns.push([session])
    })

    return columns.flatMap((colSessions, colIdx) => 
      colSessions.map(session => ({ ...session, colIdx, colSpan: columns.length }))
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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Institutional Overview</h2>
          <p className="text-muted-foreground text-sm">Managing 130+ active sessions across the Novus network.</p>
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

          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="daily" className="gap-2 h-8">
                <LayoutGrid className="h-4 w-4" /> Daily Grid
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2 h-8">
                <List className="h-4 w-4" /> Weekly List
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="bg-primary">
                <Plus className="mr-2 h-4 w-4" /> Add Match
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Session for {currentDay}</DialogTitle>
                <DialogDescription>Assign teacher, room, and exact time slot.</DialogDescription>
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
                    <Input type="time" value={selectedStartTime} onChange={e => setSelectedStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" value={selectedEndTime} onChange={e => setSelectedEndTime(e.target.value)} />
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Active Filters:</span>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <DoorOpen className="h-3 w-3" />
          <span className="font-semibold">Site:</span>
          <Select value={filterCampus} onValueChange={(v: any) => setFilterCampus(v)}>
            <SelectTrigger className="h-8 w-[120px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Sites</SelectItem>
              {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <UserIcon className="h-3 w-3" />
          <span className="font-semibold">Trainer:</span>
          <Select value={filterTeacher} onValueChange={setFilterTeacher}>
            <SelectTrigger className="h-8 w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Trainers</SelectItem>
              {teachers?.sort((a,b) => a.name.localeCompare(b.name)).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <BookOpen className="h-3 w-3" />
          <span className="font-semibold">Subject:</span>
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="h-8 w-[160px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Subjects</SelectItem>
              {units?.sort((a,b) => a.name.localeCompare(b.name)).map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Settings2 className="h-3 w-3" />
          <span className="font-semibold">Mode:</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-[130px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Modes</SelectItem>
              <SelectItem value="theory">Classroom</SelectItem>
              <SelectItem value="practical">Workshop</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(filterCampus !== "All" || filterTeacher !== "All" || filterUnit !== "All" || filterType !== "All") && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setFilterCampus("All"); setFilterTeacher("All"); setFilterUnit("All"); setFilterType("All"); }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="lg:col-span-1">
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
                    style={{ gridTemplateColumns: "80px 1fr", gridTemplateRows: `repeat(${HOURS.length}, ${ROW_HEIGHT}px)` }}
                  >
                    {HOURS.map((hour) => (
                      <React.Fragment key={hour}>
                        <div className="border-b border-r flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-muted/5 sticky left-0 z-20">
                          {hour}
                        </div>
                        <div className="border-b group relative bg-background/30">
                          <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-full bg-primary/10"
                              onClick={() => { setSelectedStartTime(hour); setIsAddOpen(true); }}
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
                      const startMin = parseInt(entry.startTime.split(':')[1])
                      const endHourNum = parseInt(entry.endTime.split(':')[0]) || 24
                      const endMinNum = parseInt(entry.endTime.split(':')[1]) || 0
                      
                      const startOffset = (startHour + (startMin / 60)) * ROW_HEIGHT
                      const endOffset = (endHourNum + (endMinNum / 60)) * ROW_HEIGHT
                      const durationPx = Math.max(endOffset - startOffset, ROW_HEIGHT / 2)
                      
                      const laneWidth = 100 / entry.colSpan
                      const leftPos = entry.colIdx * laneWidth

                      return (
                        <div 
                          key={entry.id}
                          className="absolute z-10 p-1 pointer-events-auto transition-all"
                          style={{ top: startOffset, height: durationPx, left: `${leftPos}%`, width: `${laneWidth}%` }}
                        >
                          <div 
                            className={cn(
                              "w-full h-full rounded-lg border border-white/20 shadow-xl p-3 text-white flex flex-col group overflow-hidden cursor-pointer",
                              unit?.type === 'theory' ? "bg-blue-600/90 hover:bg-blue-700" : 
                              unit?.type === 'practical' ? "bg-orange-600/90 hover:bg-orange-700" :
                              "bg-emerald-600/90 hover:bg-emerald-700"
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
                                 onClick={(e) => { e.stopPropagation(); handleDeleteSession(entry.id); }}
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
                              <DropdownMenuContent className="w-64">
                                <DropdownMenuLabel className="flex items-center gap-2">
                                  <Info className="h-4 w-4 text-primary" />
                                  Class Details
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <div className="p-3 space-y-3">
                                  <div className="flex items-center gap-2 text-xs">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Time Slot</span>
                                      <span className="font-semibold">{entry.startTime} - {entry.endTime}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Location</span>
                                      <span className="font-semibold">{entry.room}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Trainer</span>
                                      <span className="font-semibold">{teacher?.name}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    <div className="flex flex-col">
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Mode</span>
                                      <span className="font-semibold">
                                        {unit?.type === 'theory' ? 'Classroom' : unit?.type === 'practical' ? 'Workshop' : 'Online'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="mt-auto space-y-1">
                              <div className="flex items-center gap-2 text-[10px] font-semibold opacity-90 truncate">
                                 <UserIcon className="h-3 w-3 shrink-0" />
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
                <CardTitle className="font-headline">Weekly Overview</CardTitle>
                <CardDescription>Comprehensive list of all scheduled academic activities.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Academic Unit</TableHead>
                        <TableHead>Trainer</TableHead>
                        <TableHead>Location</TableHead>
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
                                <span className={cn(
                                  "text-[10px] uppercase font-bold px-1.5 rounded w-fit",
                                  unit?.type === 'theory' ? "bg-blue-100 text-blue-700" :
                                  unit?.type === 'practical' ? "bg-orange-100 text-orange-700" :
                                  "bg-emerald-100 text-emerald-700"
                                )}>
                                  {unit?.type === 'theory' ? 'Classroom' : unit?.type === 'practical' ? 'Workshop' : 'Online'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-medium">{teacher?.name}</TableCell>
                            <TableCell className="text-sm">{session.room}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100"
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
                            No sessions match current criteria.
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
      </div>
    </div>
  )
}
