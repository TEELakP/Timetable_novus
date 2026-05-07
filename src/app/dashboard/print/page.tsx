
"use client"

import React, { useMemo, useState } from "react"
import { 
  Printer, 
  Filter, 
  DoorOpen, 
  User as UserIcon, 
  BookOpen, 
  Settings2,
  Loader2,
  CalendarDays
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { TimetableEntry, Teacher, Unit, Room, Campus, Day } from "@/lib/types"
import { CAMPUSES, DAYS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function PrintPage() {
  const db = useFirestore()
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  const [filterCampus, setFilterCampus] = useState<Campus | "All">("All")
  const [filterTeacher, setFilterTeacher] = useState<string | "All">("All")
  const [filterUnit, setFilterUnit] = useState<string | "All">("All")
  const [filterType, setFilterType] = useState<string | "All">("All")

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    let data = [...sessions]
    
    if (filterCampus !== "All") {
      data = data.filter(s => {
        const room = rooms?.find(r => r.name === s.room)
        return room?.campus === filterCampus
      })
    }

    if (filterTeacher !== "All") {
      data = data.filter(s => s.teacherId === filterTeacher)
    }

    if (filterUnit !== "All") {
      data = data.filter(s => s.unitId === filterUnit)
    }

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

  const handlePrint = () => {
    window.print()
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
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Printable View</h2>
          <p className="text-muted-foreground text-sm">Unified weekly timetable optimized for PDF and paper distribution.</p>
        </div>
        <Button onClick={handlePrint} variant="default" className="bg-primary hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" /> Print Timetable
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/50 print:hidden">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Print Filters:</span>
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
      </div>

      <div className="bg-white p-8 rounded-lg border shadow-sm print:shadow-none print:border-none print:p-0 print:w-full">
        <div className="mb-8 text-center border-b pb-6 print:mb-4">
          <h1 className="text-2xl font-black uppercase tracking-tighter text-primary">Novus Academic Timetable</h1>
          <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mt-1">Weekly Institutional Schedule • Generated: {new Date().toLocaleDateString('en-AU')}</p>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50 print:bg-transparent">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[12%] font-bold text-[10px] uppercase text-primary border-r">Day</TableHead>
                <TableHead className="w-[28%] font-bold text-[10px] uppercase text-primary border-r">Unit Name</TableHead>
                <TableHead className="w-[25%] font-bold text-[10px] uppercase text-primary border-r">Trainer</TableHead>
                <TableHead className="w-[15%] font-bold text-[10px] uppercase text-primary border-r">Time</TableHead>
                <TableHead className="w-[20%] font-bold text-[10px] uppercase text-primary">Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSessions.map((session, index) => {
                const unit = units?.find(u => u.id === session.unitId)
                const teacher = teachers?.find(t => t.id === session.teacherId)
                const isFirstOfDay = index === 0 || filteredSessions[index - 1].day !== session.day
                
                return (
                  <TableRow key={session.id} className={cn("hover:bg-transparent border-b", isFirstOfDay && "border-t-2 border-primary/20")}>
                    <TableCell className={cn("font-black text-xs uppercase text-primary/70 border-r", !isFirstOfDay && "text-transparent")}>
                      {session.day}
                    </TableCell>
                    <TableCell className="font-bold py-3 border-r">
                      <div className="flex flex-col">
                        <span className="text-sm">{unit?.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-semibold">
                          {unit?.type === 'theory' ? 'Classroom' : unit?.type === 'practical' ? 'Workshop' : 'Online'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm border-r">{teacher?.name}</TableCell>
                    <TableCell className="text-sm font-mono font-medium border-r">{session.startTime} - {session.endTime}</TableCell>
                    <TableCell className="text-sm">{session.room}</TableCell>
                  </TableRow>
                )
              })}
              {filteredSessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-24 text-center text-muted-foreground italic">
                    No sessions match the current criteria for the week.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-8 pt-6 border-t text-[10px] text-muted-foreground flex justify-between items-center print:mt-4">
          <p>This document is for academic use and distribution only.</p>
          <p>Page 1 of 1</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }
          body {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          header, nav, .print\\:hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            display: block !important;
          }
          .flex-1 {
            display: block !important;
          }
          .rounded-lg {
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .border {
            border-color: #e5e7eb !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th {
            background-color: #f3f4f6 !important;
            color: black !important;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  )
}
