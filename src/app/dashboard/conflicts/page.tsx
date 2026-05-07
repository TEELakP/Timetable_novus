
"use client"

import React, { useMemo, useState } from "react"
import { 
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  User as UserIcon,
  DoorOpen,
  CalendarDays,
  Clock,
  ExternalLink,
  CheckCircle,
  Filter,
  BookOpen,
  Settings2
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { TimetableEntry, Teacher, Unit, Room } from "@/lib/types"
import { DAYS, CAMPUSES } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

const ACTIVE_TIMETABLE_ID = "default-timetable"

interface ConflictItem {
  type: 'teacher' | 'room'
  message: string
  details: string
  day: string
  time: string
  involvedSessionIds: string[]
  teacherId?: string
  unitIds: string[]
}

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

export default function ConflictsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const [selectedConflict, setSelectedConflict] = useState<ConflictItem | null>(null)
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  // Filter state
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])

  const rawConflicts = useMemo(() => {
    const conflicts: ConflictItem[] = []
    if (!sessions || !teachers) return conflicts

    const activeSessions = sessions.filter(s => !s.acknowledged)
    const teacherUsage: Record<string, { slot: string, sessionId: string }[]> = {}
    const roomUsage: Record<string, { slot: string, sessionId: string }[]> = {}

    activeSessions.forEach(s => {
      const start = parseInt(s.startTime.split(':')[0])
      const end = parseInt(s.endTime.split(':')[0]) || 24
      
      for (let h = start; h < end; h++) {
        const slotKey = `${s.day}-${h.toString().padStart(2, '0')}:00`
        
        if (!teacherUsage[s.teacherId]) teacherUsage[s.teacherId] = []
        const existingTeacherSlot = teacherUsage[s.teacherId].find(u => u.slot === slotKey)
        
        if (existingTeacherSlot) {
          const teacher = teachers?.find(t => t.id === s.teacherId)
          const msg = `Teacher ${teacher?.name || 'Unknown'} is double-booked`
          const exists = conflicts.find(c => c.message === msg && c.day === s.day && c.time === `${h}:00`)
          
          if (!exists) {
            conflicts.push({
              type: 'teacher',
              message: msg,
              details: `Trainer "${teacher?.name}" has multiple classes assigned at the same time.`,
              day: s.day,
              time: `${h}:00`,
              involvedSessionIds: [existingTeacherSlot.sessionId, s.id],
              teacherId: s.teacherId,
              unitIds: [s.unitId]
            })
          } else {
            if (!exists.involvedSessionIds.includes(s.id)) exists.involvedSessionIds.push(s.id)
            if (!exists.unitIds.includes(s.unitId)) exists.unitIds.push(s.unitId)
          }
        }
        teacherUsage[s.teacherId].push({ slot: slotKey, sessionId: s.id })

        if (s.room !== "Online") {
          if (!roomUsage[s.room]) roomUsage[s.room] = []
          const existingRoomSlot = roomUsage[s.room].find(u => u.slot === slotKey)
          
          if (existingRoomSlot) {
            const msg = `Room ${s.room} is double-booked`
            const exists = conflicts.find(c => c.message === msg && c.day === s.day && c.time === `${h}:00`)
            
            if (!exists) {
              conflicts.push({
                type: 'room',
                message: msg,
                details: `Physical room capacity conflict detected at ${s.room}.`,
                day: s.day,
                time: `${h}:00`,
                involvedSessionIds: [existingRoomSlot.sessionId, s.id],
                unitIds: [s.unitId]
              })
            } else {
              if (!exists.involvedSessionIds.includes(s.id)) exists.involvedSessionIds.push(s.id)
              if (!exists.unitIds.includes(s.unitId)) exists.unitIds.push(s.unitId)
            }
          }
          roomUsage[s.room].push({ slot: slotKey, sessionId: s.id })
        }
      }
    })
    return conflicts
  }, [sessions, teachers])

  const filteredConflicts = useMemo(() => {
    let data = [...rawConflicts]
    if (selectedDays.length > 0) data = data.filter(c => selectedDays.includes(c.day))
    if (selectedTeachers.length > 0) data = data.filter(c => c.teacherId && selectedTeachers.includes(c.teacherId))
    if (selectedUnits.length > 0) data = data.filter(c => c.unitIds.some(u => selectedUnits.includes(u)))
    return data
  }, [rawConflicts, selectedDays, selectedTeachers, selectedUnits])

  const handleResolveConflict = () => {
    if (!selectedConflict) return
    selectedConflict.involvedSessionIds.forEach(sessionId => {
      const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId)
      setDocumentNonBlocking(sessionRef, { acknowledged: true }, { merge: true })
    })
    toast({ title: "Conflict Resolved" })
    setSelectedConflict(null)
  }

  if (loadingTeachers || loadingUnits || loadingSessions) {
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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Conflict Monitor</h2>
          <p className="text-muted-foreground text-sm">Review resource integrity and manually resolve overlapping schedules.</p>
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

        {(selectedDays.length > 0 || selectedTeachers.length > 0 || selectedUnits.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedDays([]); setSelectedTeachers([]); setSelectedUnits([]); }}
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <AlertTriangle className={filteredConflicts.length > 0 ? "text-destructive" : "text-muted-foreground"} />
              Active Conflicts ({filteredConflicts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredConflicts.length > 0 ? (
              <div className="grid gap-4">
                {filteredConflicts.map((conflict, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedConflict(conflict)}
                    className="w-full text-left flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5 items-start hover:bg-destructive/10 transition-colors group"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-destructive">{conflict.message}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-black bg-white/50">{conflict.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{conflict.details}</p>
                      <div className="flex items-center gap-4 pt-2">
                         <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {conflict.day}
                         </div>
                         <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                            <Clock className="h-3.5 w-3.5" />
                            {conflict.time}
                         </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 border-2 border-dashed rounded-xl">
                 <CheckCircle2 className="h-12 w-12 text-green-500" />
                 <h3 className="text-xl font-bold">No Active Conflicts</h3>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-primary text-primary-foreground h-fit">
           <CardHeader><CardTitle className="text-lg">Audit Status</CardTitle></CardHeader>
           <CardContent className="space-y-4">
              <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-2">
                 <span className="text-xs opacity-80 uppercase">Sessions</span>
                 <span className="text-xl font-black">{sessions?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs opacity-80 uppercase">Open Conflicts</span>
                 <span className={cn("text-xl font-black", filteredConflicts.length > 0 ? "text-yellow-400" : "text-green-400")}>
                    {filteredConflicts.length}
                 </span>
              </div>
           </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedConflict} onOpenChange={(open) => !open && setSelectedConflict(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Conflict Detail</DialogTitle></DialogHeader>
          <DialogFooter><Button onClick={handleResolveConflict}>Acknowledge & Resolve</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
