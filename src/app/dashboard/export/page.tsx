
"use client"

import { useState, useMemo } from "react"
import { 
  Download, 
  Filter, 
  DoorOpen, 
  User as UserIcon, 
  BookOpen, 
  Settings2,
  Loader2,
  FileSpreadsheet
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { TimetableEntry, Teacher, Unit, Room, Campus } from "@/lib/types"
import { CAMPUSES } from "@/lib/mock-data"
import * as XLSX from 'xlsx'
import { cn } from "@/lib/utils"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function ExportPage() {
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
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      const dayIndexA = days.indexOf(a.day)
      const dayIndexB = days.indexOf(b.day)
      if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB
      return a.startTime.localeCompare(b.startTime)
    })
  }, [sessions, filterCampus, filterTeacher, filterUnit, filterType, rooms, units])

  const handleExportExcel = () => {
    const exportData = filteredSessions.map(session => {
      const teacher = teachers?.find(t => t.id === session.teacherId)
      const unit = units?.find(u => u.id === session.unitId)
      const room = rooms?.find(r => r.name === session.room)

      return {
        "Campus": room?.campus || 'Online',
        "Location": session.room,
        "Class": unit?.name || 'Unknown',
        "Day": session.day,
        "Trainer": teacher?.name || 'Unassigned',
        "Email": teacher?.email || 'N/A',
        "Start": session.startTime,
        "Finish": session.endTime
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Timetable")
    XLSX.writeFile(workbook, `Novus_Timetable_${new Date().toISOString().split('T')[0]}.xlsx`)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Export & Reporting</h2>
          <p className="text-muted-foreground text-sm">Generate administrative spreadsheets from current schedules.</p>
        </div>
        <Button onClick={handleExportExcel} disabled={filteredSessions.length === 0}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Download Excel ({filteredSessions.length})
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Filters:</span>
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

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Export Preview</CardTitle>
          <CardDescription>A snapshot of the data that will be included in the Excel export.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Campus</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Trainer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Finish</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => {
                  const teacher = teachers?.find(t => t.id === session.teacherId)
                  const unit = units?.find(u => u.id === session.unitId)
                  const room = rooms?.find(r => r.name === session.room)
                  return (
                    <TableRow key={session.id}>
                      <TableCell className="text-xs">{room?.campus || 'Online'}</TableCell>
                      <TableCell className="text-xs">{session.room}</TableCell>
                      <TableCell className="font-bold text-xs">{unit?.name}</TableCell>
                      <TableCell className="text-xs">{session.day}</TableCell>
                      <TableCell className="text-xs">{teacher?.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{teacher?.email || 'N/A'}</TableCell>
                      <TableCell className="text-xs font-mono">{session.startTime}</TableCell>
                      <TableCell className="text-xs font-mono">{session.endTime}</TableCell>
                    </TableRow>
                  )
                })}
                {filteredSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No matching records to export.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
