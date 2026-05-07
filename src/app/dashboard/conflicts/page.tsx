
"use client"

import React, { useMemo } from "react"
import { 
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  User as UserIcon,
  DoorOpen,
  CalendarDays,
  Clock
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { TimetableEntry, Teacher, Unit, Room } from "@/lib/types"
import { DAYS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function ConflictsPage() {
  const db = useFirestore()
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  const detectedConflicts = useMemo(() => {
    const conflicts: { type: 'teacher' | 'room', message: string, details: string, day: string, time: string }[] = []
    if (!sessions || !teachers) return conflicts

    const teacherUsage: Record<string, string[]> = {}
    const roomUsage: Record<string, string[]> = {}

    sessions.forEach(s => {
      const start = parseInt(s.startTime.split(':')[0])
      const end = parseInt(s.endTime.split(':')[0]) || 24
      
      for (let h = start; h < end; h++) {
        const slotKey = `${s.day}-${h.toString().padStart(2, '0')}:00`
        
        // Teacher double-booking
        if (!teacherUsage[s.teacherId]) teacherUsage[s.teacherId] = []
        if (teacherUsage[s.teacherId].includes(slotKey)) {
          const teacher = teachers?.find(t => t.id === s.teacherId)
          const msg = `Teacher ${teacher?.name || 'Unknown'} is double-booked`
          const exists = conflicts.find(c => c.message === msg && c.day === s.day && c.time === `${h}:00`)
          if (!exists) {
            conflicts.push({
              type: 'teacher',
              message: msg,
              details: `This trainer has multiple classes assigned at the same time on ${s.day}.`,
              day: s.day,
              time: `${h}:00`
            })
          }
        }
        teacherUsage[s.teacherId].push(slotKey)

        // Room double-booking (only if not online)
        if (s.room !== "Online") {
          if (!roomUsage[s.room]) roomUsage[s.room] = []
          if (roomUsage[s.room].includes(slotKey)) {
            const msg = `Room ${s.room} is double-booked`
            const exists = conflicts.find(c => c.message === msg && c.day === s.day && c.time === `${h}:00`)
            if (!exists) {
              conflicts.push({
                type: 'room',
                message: msg,
                details: `Physical room capacity conflict detected at ${s.room}.`,
                day: s.day,
                time: `${h}:00`
              })
            }
          }
          roomUsage[s.room].push(slotKey)
        }
      }
    })
    return conflicts
  }, [sessions, teachers])

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
          <p className="text-muted-foreground text-sm">Real-time resource integrity validation for the Novus network.</p>
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
              Any identified double-bookings for trainers or physical rooms will appear here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detectedConflicts.length > 0 ? (
              <div className="grid gap-4">
                {detectedConflicts.map((conflict, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5 items-start">
                    <div className="p-2 rounded-full bg-destructive/10 text-destructive">
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
                            Around {conflict.time}
                         </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 border-2 border-dashed rounded-xl">
                 <div className="p-4 rounded-full bg-green-500/10">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                 </div>
                 <div className="max-w-xs">
                    <h3 className="text-xl font-bold">No Conflicts Found</h3>
                    <p className="text-muted-foreground text-sm">All trainer assignments and physical room bookings are valid across the 7-day schedule.</p>
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
                   <span className="text-xs opacity-80 uppercase font-bold tracking-wider">Active Trainers</span>
                   <span className="text-xl font-black">{new Set(sessions?.map(s => s.teacherId)).size}</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-xs opacity-80 uppercase font-bold tracking-wider">Conflicts</span>
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
                   About Monitor
                </CardTitle>
             </CardHeader>
             <CardContent className="text-xs text-muted-foreground leading-relaxed">
                The Conflict Monitor continuously scans every class session. It checks for two main issues:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Trainer Overlap:</strong> One instructor cannot be in two places at once.</li>
                  <li><strong>Room Overlap:</strong> Physical rooms have a capacity of 1 class per time slot.</li>
                </ul>
                <p className="mt-3 italic">Note: Online classes do not trigger room capacity conflicts.</p>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
