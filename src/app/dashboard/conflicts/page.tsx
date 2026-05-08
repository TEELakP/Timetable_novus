
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
  Filter,
  BookOpen,
  AlertCircle,
  TrendingUp,
  Zap,
  ArrowRight,
  ShieldCheck,
  EyeOff
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
import { DAYS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

const ACTIVE_TIMETABLE_ID = "default-timetable"

interface ConflictItem {
  id: string
  level: 'low' | 'mid' | 'high'
  type: string
  message: string
  details: string
  day: string
  time: string
  involvedSessionIds: string[]
  teacherId?: string
  unitId?: string // Specifically for qualification fix
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
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])

  const rawConflicts = useMemo(() => {
    const conflicts: ConflictItem[] = []
    if (!sessions || !teachers || !units) return conflicts

    const addedConflictIds = new Set<string>()
    const activeSessions = sessions.filter(s => !s.acknowledged)

    const teacherUsage: Record<string, { slot: string, sessionId: string }[]> = {}
    const roomUsage: Record<string, { slot: string, sessionId: string }[]> = {}
    const unitMergeCheck: Record<string, { day: string, startTime: string, room: string, sessionId: string }[]> = {}

    activeSessions.forEach(s => {
      const teacher = teachers.find(t => t.id === s.teacherId)
      const unit = units.find(u => u.id === s.unitId)
      const room = rooms?.find(r => r.name === s.room && r.campus === s.campus)

      // --- HIGH LEVEL CONFLICTS ---

      // 1. Trainer Qualification Check
      if (teacher && unit && !teacher.qualifiedUnits.includes(unit.id)) {
        const qid = `qual-${s.id}`
        if (!addedConflictIds.has(qid)) {
          conflicts.push({
            id: qid,
            level: 'high',
            type: 'Qualification Mismatch',
            message: `${teacher.name} is not qualified for ${unit.name}`,
            details: `Institutional safety rule: Trainers must be certified for the specific unit code they deliver.`,
            day: s.day,
            time: s.startTime,
            involvedSessionIds: [s.id],
            teacherId: s.teacherId,
            unitId: unit.id
          })
          addedConflictIds.add(qid)
        }
      }

      // 2. Double Booking Detection (Trainer & Room)
      const startH = parseInt(s.startTime.split(':')[0])
      const endH = parseInt(s.endTime.split(':')[0]) || 24
      
      for (let h = startH; h < endH; h++) {
        const slotKey = `${s.day}-${h.toString().padStart(2, '0')}:00`
        
        // Trainer Overlap
        if (s.teacherId) {
          if (!teacherUsage[s.teacherId]) teacherUsage[s.teacherId] = []
          const overlaps = teacherUsage[s.teacherId].filter(u => u.slot === slotKey && u.sessionId !== s.id)
          
          overlaps.forEach(existing => {
            const conflictId = `overlap-t-${[s.id, existing.sessionId].sort().join('-')}`
            if (!addedConflictIds.has(conflictId)) {
              conflicts.push({
                id: conflictId,
                level: 'high',
                type: 'Trainer Overlap',
                message: `${teacher?.name || s.teacherId} is double-booked`,
                details: `Trainer is scheduled for multiple classes simultaneously. Legally, a trainer can only be in one place at one time.`,
                day: s.day,
                time: `${h}:00`,
                involvedSessionIds: [existing.sessionId, s.id],
                teacherId: s.teacherId
              })
              addedConflictIds.add(conflictId)
            }
          })
          teacherUsage[s.teacherId].push({ slot: slotKey, sessionId: s.id })
        }

        // Room Overlap
        if (s.room && s.room !== "Online") {
          const roomKey = `${s.campus}-${s.room}`
          if (!roomUsage[roomKey]) roomUsage[roomKey] = []
          const overlaps = roomUsage[roomKey].filter(u => u.slot === slotKey && u.sessionId !== s.id)
          
          overlaps.forEach(existing => {
            const conflictId = `overlap-r-${[s.id, existing.sessionId].sort().join('-')}`
            if (!addedConflictIds.has(conflictId)) {
              conflicts.push({
                id: conflictId,
                level: 'high',
                type: 'Room Overlap',
                message: `${s.room} is double-booked`,
                details: `Physical capacity conflict. Only one class can feasibly run in ${s.room} at any given time.`,
                day: s.day,
                time: `${h}:00`,
                involvedSessionIds: [existing.sessionId, s.id]
              })
              addedConflictIds.add(conflictId)
            }
          })
          roomUsage[roomKey].push({ slot: slotKey, sessionId: s.id })
        }
      }

      // --- MID LEVEL CONFLICTS ---

      // 3. Gosford After-Hours Rule
      if (s.campus === 'Gosford') {
        const finishH = parseInt(s.endTime.split(':')[0])
        if (finishH >= 17) {
          const gid = `gosford-${s.id}`
          if (!addedConflictIds.has(gid)) {
            conflicts.push({
              id: gid,
              level: 'mid',
              type: 'Institutional Constraint',
              message: `Gosford class ends after 5:00 PM`,
              details: `Buses in Gosford stop at 5pm. Institutional rule requires classes to finish earlier for student safety.`,
              day: s.day,
              time: s.startTime,
              involvedSessionIds: [s.id]
            })
            addedConflictIds.add(gid)
          }
        }
      }

      // 4. Capacity vs Type Check
      if (room && unit) {
        const isPractical = unit.type === 'practical'
        const limit = isPractical ? 20 : 30
        if (room.capacity < limit) {
          const cid = `cap-${s.id}`
          if (!addedConflictIds.has(cid)) {
            conflicts.push({
              id: cid,
              level: 'mid',
              type: 'Capacity Warning',
              message: `Room ${s.room} might be too small`,
              details: `${unit.type.toUpperCase()} classes aim for ${limit} students. This room only holds ${room.capacity}.`,
              day: s.day,
              time: s.startTime,
              involvedSessionIds: [s.id]
            })
            addedConflictIds.add(cid)
          }
        }
      }

      // --- LOW LEVEL CONFLICTS ---

      // 5. Merge Opportunity Check
      const mergeKey = `${unit?.id}-${s.day}-${s.startTime}`
      if (!unitMergeCheck[mergeKey]) unitMergeCheck[mergeKey] = []
      const potentialMerge = unitMergeCheck[mergeKey].find(m => m.room !== s.room)
      if (potentialMerge) {
        const mid = `merge-${[s.id, potentialMerge.sessionId].sort().join('-')}`
        if (!addedConflictIds.has(mid)) {
          conflicts.push({
            id: mid,
            level: 'low',
            type: 'Resource Optimization',
            message: `Potential Unit Merge: ${unit?.name}`,
            details: `Same unit is running in different rooms at the same time. Consider merging batches to save trainer hours if student count allows.`,
            day: s.day,
            time: s.startTime,
            involvedSessionIds: [potentialMerge.sessionId, s.id]
          })
          addedConflictIds.add(mid)
        }
      }
      unitMergeCheck[mergeKey].push({ day: s.day, startTime: s.startTime, room: s.room, sessionId: s.id })
    })

    return conflicts
  }, [sessions, teachers, units, rooms])

  const filteredConflicts = useMemo(() => {
    let data = [...rawConflicts]
    if (selectedDays.length > 0) data = data.filter(c => selectedDays.includes(c.day))
    if (selectedLevels.length > 0) data = data.filter(c => selectedLevels.includes(c.level))
    return data
  }, [rawConflicts, selectedDays, selectedLevels])

  const handleIgnoreConflict = () => {
    if (!selectedConflict) return
    selectedConflict.involvedSessionIds.forEach(sessionId => {
      const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId)
      updateDocumentNonBlocking(sessionRef, { acknowledged: true })
    })
    toast({ title: "Conflict Acknowledged", description: "The sessions will no longer appear in the monitor." })
    setSelectedConflict(null)
  }

  const handleGrantQualification = () => {
    if (!selectedConflict || !selectedConflict.teacherId || !selectedConflict.unitId) return
    const teacher = teachers?.find(t => t.id === selectedConflict.teacherId)
    if (!teacher) return

    const teacherRef = doc(db, "teachers", teacher.id)
    const newQualifications = [...new Set([...teacher.qualifiedUnits, selectedConflict.unitId])]
    
    updateDocumentNonBlocking(teacherRef, { qualifiedUnits: newQualifications })
    toast({ title: "Qualification Granted", description: `${teacher.name} is now qualified for the assigned unit.` })
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
          <p className="text-muted-foreground text-sm">Automated Audit: High (Blockers), Mid (Operational), Low (Optimization).</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Filters:</span>
        </div>
        
        <MultiSelectFilter 
          label="Severity"
          icon={AlertTriangle}
          options={[
            { label: 'High (Critical)', value: 'high' },
            { label: 'Mid (Warnings)', value: 'mid' },
            { label: 'Low (Optimizations)', value: 'low' }
          ]}
          selected={selectedLevels}
          onChange={setSelectedLevels}
        />

        <MultiSelectFilter 
          label="Days"
          icon={CalendarDays}
          options={DAYS.map(d => ({ label: d, value: d }))}
          selected={selectedDays}
          onChange={setSelectedDays}
        />

        {(selectedDays.length > 0 || selectedLevels.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedDays([]); setSelectedLevels([]); }}
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {['high', 'mid', 'low'].map((level) => {
            if (selectedLevels.length > 0 && !selectedLevels.includes(level)) return null
            const items = filteredConflicts.filter(c => c.level === level)
            const config = {
              high: { label: 'Critical Blockers', color: 'text-destructive', icon: Zap, bg: 'fill-destructive' },
              mid: { label: 'Operational Risks', color: 'text-orange-600', icon: AlertCircle, bg: 'fill-orange-600' },
              low: { label: 'Optimizations', color: 'text-blue-600', icon: TrendingUp, bg: '' }
            }[level as 'high' | 'mid' | 'low']

            return (
              <div key={level} className="space-y-4">
                 <h3 className={cn("text-sm font-black uppercase tracking-widest flex items-center gap-2", config.color)}>
                   <config.icon className={cn("h-4 w-4", config.bg)} /> {config.label}
                 </h3>
                 <div className="grid gap-3">
                   {items.map((c) => (
                     <ConflictCard key={c.id} conflict={c} onSelect={setSelectedConflict} />
                   ))}
                   {items.length === 0 && (
                     <div className="p-8 text-center border-2 border-dashed rounded-xl opacity-40 italic text-sm">No items found for this level.</div>
                   )}
                 </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground">
             <CardHeader><CardTitle className="text-lg">Audit Overview</CardTitle></CardHeader>
             <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-2">
                   <span className="text-xs opacity-80 uppercase font-bold">Blockers</span>
                   <span className="text-xl font-black text-destructive-foreground">{rawConflicts.filter(c => c.level === 'high').length}</span>
                </div>
                <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-2">
                   <span className="text-xs opacity-80 uppercase font-bold">Warnings</span>
                   <span className="text-xl font-black text-orange-300">{rawConflicts.filter(c => c.level === 'mid').length}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs opacity-80 uppercase font-bold">Optimizations</span>
                   <span className="text-xl font-black text-blue-300">{rawConflicts.filter(c => c.level === 'low').length}</span>
                </div>
             </CardContent>
          </Card>

          <Card className="bg-muted/50">
             <CardHeader>
               <CardTitle className="text-sm flex items-center gap-2">
                 <Info className="h-4 w-4" /> Policy Reference
               </CardTitle>
             </CardHeader>
             <CardContent className="text-[11px] space-y-2 text-muted-foreground leading-relaxed">
               <p><strong>Gosford:</strong> No classes after 5 PM due to local bus limitations.</p>
               <p><strong>Capacity:</strong> Theory classes limited to 30. Practical classes limited to 20.</p>
               <p><strong>Fast Track:</strong> Overlaps strictly monitored for dual-enrolled students.</p>
               <p><strong>Staffing:</strong> Maximize hours for FT employees (Shaffy, Manjit exceptions).</p>
             </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedConflict} onOpenChange={(open) => !open && setSelectedConflict(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <SeverityIcon level={selectedConflict?.level} />
              <DialogTitle className="text-xl">{selectedConflict?.type}</DialogTitle>
            </div>
            <DialogDescription className="text-base font-medium text-foreground">
              {selectedConflict?.message}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted rounded-xl text-sm border">
               <h4 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 text-primary">Details</h4>
               {selectedConflict?.details}
            </div>

            {selectedConflict?.involvedSessionIds && selectedConflict.involvedSessionIds.length > 1 && (
              <div className="space-y-2">
                <h4 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Conflicting Sessions:</h4>
                <div className="space-y-2">
                  {selectedConflict.involvedSessionIds.map(sid => {
                    const session = sessions?.find(s => s.id === sid)
                    const unit = units?.find(u => u.id === session?.unitId)
                    if (!session) return null
                    return (
                      <div key={sid} className="flex flex-col p-2 bg-muted/40 rounded border border-dashed text-xs">
                        <span className="font-bold text-primary">{unit?.name || session.unitId}</span>
                        <div className="flex items-center gap-2 opacity-70 mt-1">
                          <CalendarDays className="h-3 w-3" /> {session.day}
                          <Clock className="h-3 w-3 ml-2" /> {session.startTime} - {session.endTime}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground bg-muted/30 p-3 rounded-lg border-dashed border">
               <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {selectedConflict?.day}</div>
               <div className="flex items-center gap-2"><Clock className="h-4 w-4" /> {selectedConflict?.time}</div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setSelectedConflict(null)}>Close</Button>
            
            <Button variant="ghost" onClick={handleIgnoreConflict} className="text-muted-foreground hover:text-primary">
              <EyeOff className="mr-2 h-4 w-4" /> Ignore Conflict
            </Button>

            {selectedConflict?.type === 'Qualification Mismatch' && (
              <Button onClick={handleGrantQualification} className="bg-green-600 hover:bg-green-700 text-white">
                <ShieldCheck className="mr-2 h-4 w-4" /> Grant Qualification
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ConflictCard({ conflict, onSelect }: { conflict: ConflictItem, onSelect: (c: ConflictItem) => void }) {
  const levelColors = {
    high: "border-destructive/30 bg-destructive/5 hover:bg-destructive/10",
    mid: "border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10",
    low: "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10"
  }

  return (
    <button 
      onClick={() => onSelect(conflict)}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all group flex gap-4 items-center",
        levelColors[conflict.level]
      )}
    >
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-xs font-black uppercase tracking-tighter",
            conflict.level === 'high' ? "text-destructive" : conflict.level === 'mid' ? "text-orange-700" : "text-blue-700"
          )}>
            {conflict.type}
          </span>
          <Separator orientation="vertical" className="h-3" />
          <span className="text-sm font-bold">{conflict.message}</span>
        </div>
        <div className="flex items-center gap-4 pt-1 opacity-70">
           <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
              <CalendarDays className="h-3 w-3" /> {conflict.day}
           </div>
           <div className="flex items-center gap-1.5 text-[10px] font-black uppercase">
              <Clock className="h-3 w-3" /> {conflict.time}
           </div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

function SeverityIcon({ level }: { level?: string }) {
  if (level === 'high') return <Zap className="h-6 w-6 text-destructive fill-destructive" />
  if (level === 'mid') return <AlertCircle className="h-6 w-6 text-orange-600 fill-orange-600" />
  return <TrendingUp className="h-6 w-6 text-blue-600" />
}
