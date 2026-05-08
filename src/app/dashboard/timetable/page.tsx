
"use client"

import React, { useState, useMemo } from "react"
import { 
  Info,
  Plus,
  Loader2,
  Trash2,
  DoorOpen,
  Filter,
  CalendarDays,
  LayoutGrid,
  List,
  BookOpen,
  User as UserIcon,
  Clock,
  Settings2,
  AlertTriangle,
  MapPin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
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
import { DAYS, CAMPUSES } from "@/lib/mock-data"
import { TimetableEntry, Teacher, Unit, Room, Day, Campus } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { deleteDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase/non-blocking-updates"

const ACTIVE_TIMETABLE_ID = "default-timetable"

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
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [selectedRooms, setSelectedRooms] = useState<string[]>([])

  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false)
  const [newSession, setNewSession] = useState({
    unitId: "",
    teacherId: "",
    day: "Monday" as Day,
    startTime: "09:00",
    endTime: "11:00",
    room: "",
    campus: "Ultimo" as Campus
  })

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    let data = [...sessions]
    
    if (selectedCampuses.length > 0) {
      data = data.filter(s => selectedCampuses.includes(s.campus))
    }
    if (selectedTeachers.length > 0) data = data.filter(s => selectedTeachers.includes(s.teacherId))
    if (selectedUnits.length > 0) data = data.filter(s => selectedUnits.includes(s.unitId))
    if (selectedDays.length > 0) data = data.filter(s => selectedDays.includes(s.day))
    if (selectedRooms.length > 0) data = data.filter(s => selectedRooms.includes(s.room))
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
  }, [sessions, selectedCampuses, selectedTeachers, selectedUnits, selectedTypes, selectedDays, selectedRooms, units])

  const roomOptions = useMemo(() => {
    if (!sessions) return []
    const uniqueRooms = Array.from(new Set(sessions.map(s => s.room).filter(Boolean)))
    return uniqueRooms.sort().map(r => ({ label: r, value: r }))
  }, [sessions])

  const handleAddSession = () => {
    if (!newSession.unitId || !newSession.teacherId) return
    const id = `s-${Date.now()}`
    const sessionData: TimetableEntry = {
      ...newSession,
      id,
      acknowledged: false
    }
    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id), sessionData, { merge: true })
    setIsAddSessionOpen(false)
    toast({ title: "Session Added" })
  }

  const confirmDeleteSession = () => {
    if (!sessionToDelete) return
    const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionToDelete)
    deleteDocumentNonBlocking(sessionRef)
    setSessionToDelete(null)
    toast({ title: "Session Removed" })
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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Weekly Overview</h2>
          <p className="text-muted-foreground text-sm">Reviewing {filteredSessions.length} active sessions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddSessionOpen(true)} className="bg-primary">
            <Plus className="mr-2 h-4 w-4" /> New Session
          </Button>
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="grid" className="gap-2 h-8">
                <LayoutGrid className="h-4 w-4" /> Weekly Grid
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2 h-8">
                <List className="h-4 w-4" /> Weekly List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Filters:</span>
        </div>
        
        <MultiSelectFilter 
          label="Days"
          icon={CalendarDays}
          options={DAYS.map(d => ({ label: d, value: d }))}
          selected={selectedDays}
          onChange={setSelectedDays}
        />

        <MultiSelectFilter 
          label="Cities"
          icon={MapPin}
          options={CAMPUSES.map(c => ({ label: c, value: c }))}
          selected={selectedCampuses}
          onChange={setSelectedCampuses}
        />

        <MultiSelectFilter 
          label="Rooms"
          icon={DoorOpen}
          options={roomOptions}
          selected={selectedRooms}
          onChange={setSelectedRooms}
        />

        <MultiSelectFilter 
          label="Trainers"
          icon={UserIcon}
          options={teachers?.sort((a,b) => a.name.localeCompare(b.name)).map(t => ({ label: t.name, value: t.id })) || []}
          selected={selectedTeachers}
          onChange={setSelectedTeachers}
        />

        {(selectedCampuses.length > 0 || selectedTeachers.length > 0 || selectedRooms.length > 0 || selectedDays.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedCampuses([]); setSelectedTeachers([]); setSelectedUnits([]); setSelectedTypes([]); setSelectedDays([]); setSelectedRooms([]); }}
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {viewMode === 'grid' ? (
          <div className="overflow-x-auto p-1">
             <div className="grid grid-cols-7 border rounded-xl overflow-hidden shadow-xl bg-card">
                {DAYS.map(day => (
                  <div key={day} className="flex flex-col border-r last:border-r-0 min-w-[150px]">
                    <div className="bg-muted/50 border-b py-3 text-center font-black text-xs uppercase tracking-tight">
                      {day}
                    </div>
                    <div className="flex-1 bg-background p-1.5 space-y-1.5 min-h-[600px]">
                      {filteredSessions.filter(s => s.day === day).map(session => {
                        const unit = units?.find(u => u.id === session.unitId)
                        const teacher = teachers?.find(t => t.id === session.teacherId)
                        
                        let bgColor = "bg-blue-600/10 text-blue-700 border-blue-200"
                        if (unit?.type === 'practical') bgColor = "bg-orange-600/10 text-orange-700 border-orange-200"
                        if (unit?.type === 'online') bgColor = "bg-green-600/10 text-green-700 border-green-200"

                        return (
                          <div 
                            key={session.id} 
                            className={cn(
                              "p-2 rounded-lg border shadow-sm group relative flex flex-col leading-tight",
                              bgColor
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-x-1 mb-1">
                              <span className="text-[11px] font-black uppercase truncate max-w-full">
                                {unit?.name || session.unitId}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold opacity-80 truncate mb-1">
                              {teacher?.name || 'Unassigned'}
                            </div>
                            <div className="flex items-center justify-between mt-auto">
                              <div className="text-[9px] font-black opacity-70 whitespace-nowrap flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {session.startTime}
                              </div>
                              <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-white/50">{session.room}</Badge>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setSessionToDelete(session.id)}
                            >
                               <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        ) : (
          <Card className="border-none shadow-xl bg-card">
            <CardContent className="p-0">
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
                  {filteredSessions.map((session) => {
                    const unit = units?.find(u => u.id === session.unitId)
                    const teacher = teachers?.find(t => t.id === session.teacherId)
                    return (
                      <TableRow key={session.id} className="group">
                        <TableCell className="font-bold text-xs uppercase text-primary/70">{session.day}</TableCell>
                        <TableCell className="text-xs font-mono">{session.startTime} - {session.endTime}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{unit?.name || session.unitId}</span>
                            <span className="text-[9px] text-muted-foreground uppercase">{session.campus}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{teacher?.name || 'Unassigned'}</TableCell>
                        <TableCell className="text-sm">{session.room}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100"
                            onClick={() => setSessionToDelete(session.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>Remove this class from the schedule?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSession} className="bg-destructive text-destructive-foreground">
              Remove Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Add Manual Session</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Campus</Label>
              <Select value={newSession.campus} onValueChange={(v: Campus) => setNewSession({...newSession, campus: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Subject</Label>
              <Select value={newSession.unitId} onValueChange={(v) => setNewSession({...newSession, unitId: v})}>
                <SelectTrigger><SelectValue placeholder="Select Subject" /></SelectTrigger>
                <SelectContent>
                  {units?.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddSession}>Save Session</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
