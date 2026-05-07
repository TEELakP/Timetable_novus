
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
  CheckCircle
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
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { TimetableEntry, Teacher, Unit, Room } from "@/lib/types"
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

  const detectedConflicts = useMemo(() => {
    const conflicts: ConflictItem[] = []
    if (!sessions || !teachers) return conflicts

    // Filter out sessions that are already acknowledged as "intended conflicts"
    const activeSessions = sessions.filter(s => !s.acknowledged)

    const teacherUsage: Record<string, { slot: string, sessionId: string }[]> = {}
    const roomUsage: Record<string, { slot: string, sessionId: string }[]> = {}

    activeSessions.forEach(s => {
      const start = parseInt(s.startTime.split(':')[0])
      const end = parseInt(s.endTime.split(':')[0]) || 24
      
      for (let h = start; h < end; h++) {
        const slotKey = `${s.day}-${h.toString().padStart(2, '0')}:00`
        
        // Teacher double-booking check
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
              involvedSessionIds: [existingTeacherSlot.sessionId, s.id]
            })
          } else {
            if (!exists.involvedSessionIds.includes(s.id)) exists.involvedSessionIds.push(s.id)
          }
        }
        teacherUsage[s.teacherId].push({ slot: slotKey, sessionId: s.id })

        // Room double-booking check (only if not online)
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
                involvedSessionIds: [existingRoomSlot.sessionId, s.id]
              })
            } else {
              if (!exists.involvedSessionIds.includes(s.id)) exists.involvedSessionIds.push(s.id)
            }
          }
          roomUsage[s.room].push({ slot: slotKey, sessionId: s.id })
        }
      }
    })
    return conflicts
  }, [sessions, teachers])

  const handleResolveConflict = () => {
    if (!selectedConflict) return

    // Update all involved sessions to be "acknowledged"
    selectedConflict.involvedSessionIds.forEach(sessionId => {
      const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId)
      setDocumentNonBlocking(sessionRef, { acknowledged: true }, { merge: true })
    })

    toast({
      title: "Conflict Resolved",
      description: "Involved sessions have been marked as acknowledged and will no longer appear as conflicts."
    })
    setSelectedConflict(null)
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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Conflict Monitor</h2>
          <p className="text-muted-foreground text-sm">Review resource integrity and manually resolve overlapping schedules.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <AlertTriangle className={detectedConflicts.length > 0 ? "text-destructive" : "text-muted-foreground"} />
              Active Conflicts ({detectedConflicts.length})
            </CardTitle>
            <CardDescription>
              Click a conflict card to review details or mark it as intended/resolved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detectedConflicts.length > 0 ? (
              <div className="grid gap-4">
                {detectedConflicts.map((conflict, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSelectedConflict(conflict)}
                    className="w-full text-left flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5 items-start hover:bg-destructive/10 transition-colors group"
                  >
                    <div className="p-2 rounded-full bg-destructive/10 text-destructive group-hover:bg-destructive/20 transition-colors">
                      {conflict.type === 'teacher' ? <UserIcon className="h-5 w-5" /> : <DoorOpen className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-destructive">{conflict.message}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-black bg-white/50">
                          {conflict.type}
                        </Badge>
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
                         <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-primary uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                           Review <ExternalLink className="h-3 w-3" />
                         </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 border-2 border-dashed rounded-xl">
                 <div className="p-4 rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                 </div>
                 <div className="max-w-xs">
                    <h3 className="text-xl font-bold">No Active Conflicts</h3>
                    <p className="text-muted-foreground text-sm">All trainer assignments and physical room bookings are valid or previously acknowledged.</p>
                 </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground">
             <CardHeader>
                <CardTitle className="text-lg font-headline">Quick Audit</CardTitle>
                <CardDescription className="text-primary-foreground/70">Snapshot of resource usage.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-2">
                   <span className="text-xs opacity-80 uppercase font-bold tracking-wider">Total Sessions</span>
                   <span className="text-xl font-black">{sessions?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center border-b border-primary-foreground/20 pb-2">
                   <span className="text-xs opacity-80 uppercase font-bold tracking-wider">Acknowledged</span>
                   <span className="text-xl font-black">{sessions?.filter(s => s.acknowledged).length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs opacity-80 uppercase font-bold tracking-wider">Open Conflicts</span>
                   <span className={cn("text-xl font-black", detectedConflicts.length > 0 ? "text-yellow-400" : "text-green-400")}>
                      {detectedConflicts.length}
                   </span>
                </div>
             </CardContent>
          </Card>

          <Card>
             <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline flex items-center gap-2">
                   <Info className="h-4 w-4" />
                   About Resolutions
                </CardTitle>
             </CardHeader>
             <CardContent className="text-xs text-muted-foreground leading-relaxed">
                Sometimes overlaps are intentional (e.g., co-teaching or large seminar rooms). 
                <p className="mt-2 font-medium">Resolving a conflict will:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Remove it from this monitor.</li>
                  <li>Keep the classes in the timetable.</li>
                  <li>Mark the resources as "Acknowleged".</li>
                </ul>
             </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedConflict} onOpenChange={(open) => !open && setSelectedConflict(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Conflict Detail
            </DialogTitle>
            <DialogDescription>
              Review the overlapping sessions below. You can manually adjust them in the Timetable or acknowledge the overlap as intentional.
            </DialogDescription>
          </DialogHeader>
          
          {selectedConflict && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm font-bold">{selectedConflict.message}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {selectedConflict.day}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {selectedConflict.time}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Involved Sessions</p>
                {selectedConflict.involvedSessionIds.map(id => {
                  const session = sessions?.find(s => s.id === id)
                  const unit = units?.find(u => u.id === session?.unitId)
                  const teacher = teachers?.find(t => t.id === session?.teacherId)
                  return (
                    <div key={id} className="flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold">{unit?.name || 'Unknown Subject'}</p>
                        <p className="text-xs text-muted-foreground">{teacher?.name} • {session?.room}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {session?.startTime} - {session?.endTime}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedConflict(null)}>
              Cancel
            </Button>
            <Button onClick={handleResolveConflict} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="mr-2 h-4 w-4" /> Acknowledge & Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
