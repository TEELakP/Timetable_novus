
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { DAYS, CAMPUSES } from "@/lib/mock-data"
import { TimetableEntry, Teacher, Unit, Room, Day } from "@/lib/types"
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

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    let data = [...sessions]
    
    if (selectedCampuses.length > 0) {
      data = data.filter(s => {
        const room = rooms?.find(r => r.name === s.room)
        return room && selectedCampuses.includes(room.campus)
      })
    }
    if (selectedTeachers.length > 0) data = data.filter(s => selectedTeachers.includes(s.teacherId))
    if (selectedUnits.length > 0) data = data.filter(s => selectedUnits.includes(s.unitId))
    if (selectedDays.length > 0) data = data.filter(s => selectedDays.includes(s.day))
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
  }, [sessions, selectedCampuses, selectedTeachers, selectedUnits, selectedTypes, selectedDays, rooms, units])

  const sessionsByDay = useMemo(() => {
    const grouped: Record<string, TimetableEntry[]> = {}
    DAYS.forEach(day => {
      grouped[day] = filteredSessions.filter(s => s.day === day)
    })
    return grouped
  }, [filteredSessions])

  const handleDeleteSession = (id: string) => {
    deleteDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id))
    toast({ title: "Session Removed", description: "The scheduled session has been deleted." })
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
          <p className="text-muted-foreground text-sm">Reviewing {filteredSessions.length} active sessions across the network.</p>
        </div>
        <div className="flex items-center gap-2">
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

        {(selectedCampuses.length > 0 || selectedTeachers.length > 0 || selectedUnits.length > 0 || selectedTypes.length > 0 || selectedDays.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedCampuses([]); setSelectedTeachers([]); setSelectedUnits([]); setSelectedTypes([]); setSelectedDays([]); }}
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
                      {sessionsByDay[day].map(session => {
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
                            <div className="flex flex-wrap items-center gap-x-1 mb-0.5">
                              <span className="text-[11px] font-black tracking-tighter uppercase truncate max-w-full">
                                {unit?.name}
                              </span>
                              <span className="text-[10px] font-bold opacity-80 truncate">
                                • {teacher?.name}
                              </span>
                            </div>
                            <div className="text-[9px] font-bold opacity-70 whitespace-nowrap flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {session.startTime}-{session.endTime}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleDeleteSession(session.id)}
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
            <CardHeader>
              <CardTitle className="font-headline">Master List</CardTitle>
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
                    {filteredSessions.map((session) => {
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
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
