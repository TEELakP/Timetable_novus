
"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { 
  ChevronLeft, 
  ChevronRight, 
  Info,
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
  Settings2,
  Upload,
  Eraser
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { DAYS, HOURS, CAMPUSES, NOVUS_TRAINERS, NOVUS_UNITS, NOVUS_ROOMS, NOVUS_SCHEDULE_RAW } from "@/lib/mock-data"
import { TimetableEntry, Teacher, Unit, Room, Day, Campus } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, writeBatch } from "firebase/firestore"
import { deleteDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import * as XLSX from 'xlsx'

const ACTIVE_TIMETABLE_ID = "default-timetable"
const ROW_HEIGHT = 64

const DELIVERY_MODES = [
  { value: 'theory', label: 'Classroom' },
  { value: 'practical', label: 'Workshop' },
  { value: 'online', label: 'Online' },
]

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

export default function TimetablePage() {
  const { toast } = useToast()
  const db = useFirestore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  const [isSeeding, setIsSeeding] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  
  // Multi-select state
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const [currentDayIndex, setCurrentDayIndex] = useState(0)
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily")
  
  const currentDay = DAYS[currentDayIndex]

  const [selectedUnit, setSelectedUnit] = useState("")
  const [selectedTeacher, setSelectedTeacher] = useState("")
  const [selectedRoom, setSelectedRoom] = useState("")
  const [selectedStartTime, setSelectedStartTime] = useState("09:00")
  const [selectedEndTime, setSelectedEndTime] = useState("11:00")

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
    
    if (selectedCampuses.length > 0) {
      data = data.filter(s => {
        const room = rooms?.find(r => r.name === s.room)
        return room && selectedCampuses.includes(room.campus)
      })
    }

    if (selectedTeachers.length > 0) {
      data = data.filter(s => selectedTeachers.includes(s.teacherId))
    }

    if (selectedUnits.length > 0) {
      data = data.filter(s => selectedUnits.includes(s.unitId))
    }

    if (selectedTypes.length > 0) {
      data = data.filter(s => {
        const unit = units?.find(u => u.id === s.unitId)
        return unit && selectedTypes.includes(unit.type)
      })
    }
    
    return data.sort((a, b) => {
      const dayIndexA = DAYS.indexOf(a.day)
      const dayIndexB = DAYS.indexOf(b.day)
      if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB
      return a.startTime.localeCompare(b.startTime)
    })
  }, [sessions, selectedCampuses, selectedTeachers, selectedUnits, selectedTypes, rooms, units])

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

  const handleClearDatabase = async () => {
    if (!confirm("This will delete ALL trainers, subjects, rooms, and sessions from the database. Are you sure?")) return
    
    setIsSeeding(true)
    const batch = writeBatch(db)
    
    try {
      teachers?.forEach(t => batch.delete(doc(db, "teachers", t.id)))
      units?.forEach(u => batch.delete(doc(db, "academicUnits", u.id)))
      rooms?.forEach(r => batch.delete(doc(db, "rooms", r.id)))
      sessions?.forEach(s => batch.delete(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", s.id)))
      
      await batch.commit()
      toast({ title: "Database Cleared", description: "All institutional records have been removed." })
    } catch (error) {
      toast({ title: "Clear Failed", variant: "destructive" })
    } finally {
      setIsSeeding(false)
    }
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
      toast({ title: "Data Seeded", description: "Institutional data has been updated." })
    } catch (error) {
      toast({ title: "Seeding Failed", variant: "destructive" })
    } finally {
      setIsSeeding(false)
    }
  }

  const parseTime = (timeStr: string) => {
    if (!timeStr) return "09:00"
    const clean = timeStr.trim().toUpperCase()
    const match = clean.match(/(\d+):?(\d*)\s*(AM|PM)?/)
    if (!match) return "09:00"

    let hour = parseInt(match[1])
    const min = match[2] ? match[2].padStart(2, '0') : "00"
    const ampm = match[3]

    if (ampm === "PM" && hour < 12) hour += 12
    if (ampm === "AM" && hour === 12) hour = 0

    return `${hour.toString().padStart(2, '0')}:${min}`
  }

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) as any[]

        const batch = writeBatch(db)
        const processedTeachers = new Set<string>()
        const processedUnits = new Set<string>()
        const processedRooms = new Set<string>()

        data.forEach((row, idx) => {
          const teacherName = row.Trainer || row.trainer || "Unassigned"
          const teacherId = teacherName.toLowerCase().replace(/\s+/g, '-')
          const teacherEmail = row.Email || row.email || `${teacherId}@novus.edu.au`
          
          const unitName = row.Class || row.class || "Unknown Subject"
          const unitId = unitName.toLowerCase().replace(/\s+/g, '-')
          
          const roomName = row.Location || row.location || "Online"
          const roomId = roomName.toLowerCase().replace(/[^a-z0-9]/g, '-')
          const campus = (row.Campus || row.campus || "Online") as Campus

          const day = (row.Day || row.day || "Monday") as Day
          const startTime = parseTime(row.Start || row.start)
          const endTime = parseTime(row.Finish || row.finish)

          if (!processedTeachers.has(teacherId)) {
            batch.set(doc(db, "teachers", teacherId), { id: teacherId, name: teacherName, email: teacherEmail, qualifiedUnits: [], campuses: [campus], availability: [] }, { merge: true })
            processedTeachers.add(teacherId)
          }

          if (!processedUnits.has(unitId)) {
            batch.set(doc(db, "academicUnits", unitId), { id: unitId, name: unitName, type: 'theory', durationHours: 4, sessionsPerWeek: 1 }, { merge: true })
            processedUnits.add(unitId)
          }

          if (!processedRooms.has(roomId)) {
            batch.set(doc(db, "rooms", roomId), { id: roomId, name: roomName, capacity: 30, campus }, { merge: true })
            processedRooms.add(roomId)
          }

          const sessionId = `import-${Date.now()}-${idx}`
          batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), {
            id: sessionId,
            unitId,
            teacherId,
            room: roomName,
            day,
            startTime,
            endTime
          })
        })

        await batch.commit()
        toast({ title: "Import Successful", description: `Added ${data.length} sessions from Excel.` })
      } catch (err) {
        console.error(err)
        toast({ variant: "destructive", title: "Import Failed", description: "Ensure your columns match: Campus, Location, Class, Day, Trainer, Email, Start, Finish" })
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
    reader.readAsBinaryString(file)
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
    const lanes: TimetableEntry[][] = []
    
    sorted.forEach(session => {
      let placed = false
      for (let i = 0; i < lanes.length; i++) {
        const lastInLane = lanes[i][lanes[i].length - 1]
        // Check for temporal overlap
        if (session.startTime >= lastInLane.endTime) {
          lanes[i].push(session)
          placed = true
          break
        }
      }
      if (!placed) lanes.push([session])
    })

    return lanes.flatMap((laneSessions, laneIdx) => 
      laneSessions.map(session => ({ ...session, laneIdx, totalLanes: lanes.length }))
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
          <p className="text-muted-foreground text-sm">Managing {sessions?.length || 0} active sessions across the network.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleExcelImport} 
          />
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="border-dashed"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import Excel
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearDatabase} 
            disabled={isSeeding}
            className="text-destructive border-destructive/20 hover:bg-destructive/5"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}
            Clear All Data
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSeedDemoData} 
            disabled={isSeeding}
            className="text-primary border-primary/20 hover:bg-primary/5"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
            Seed Data
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

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Multi-Filters:</span>
        </div>
        
        <MultiSelectFilter 
          label="Sites"
          icon={DoorOpen}
          options={CAMPUSES.map(c => ({ label: c, value: c }))}
          selected={selectedCampuses}
          onChange={setSelectedCampuses}
        />

        <MultiSelectFilter 
          label="Trainers"
          icon={UserIcon}
          options={teachers?.sort((a,b) => a.name.localeCompare(b.name)).map(t => ({ label: t.name, value: t.id })) || []}
          selected={selectedTeachers}
          onChange={setSelectedTeachers}
        />

        <MultiSelectFilter 
          label="Subjects"
          icon={BookOpen}
          options={units?.sort((a,b) => a.name.localeCompare(b.name)).map(u => ({ label: u.name, value: u.id })) || []}
          selected={selectedUnits}
          onChange={setSelectedUnits}
        />

        <MultiSelectFilter 
          label="Modes"
          icon={Settings2}
          options={DELIVERY_MODES}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />

        {(selectedCampuses.length > 0 || selectedTeachers.length > 0 || selectedUnits.length > 0 || selectedTypes.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedCampuses([]); setSelectedTeachers([]); setSelectedUnits([]); setSelectedTypes([]); }}
          >
            Clear All
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
                      
                      const widthPct = 100 / entry.totalLanes
                      const leftPct = entry.laneIdx * widthPct

                      return (
                        <div 
                          key={entry.id}
                          className="absolute z-10 p-1 pointer-events-auto transition-all"
                          style={{ top: startOffset, height: durationPx, left: `${leftPct}%`, width: `${widthPct}%` }}
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
