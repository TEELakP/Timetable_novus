
"use client"

import React, { useState, useMemo } from "react"
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Table as TableIcon,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, writeBatch } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Campus, Day, Teacher, Unit, Room, TimetableEntry } from "@/lib/types"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function DataEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers } = useCollection<Teacher>(teachersRef)
  const { data: units } = useCollection<Unit>(unitsRef)
  const { data: rooms } = useCollection<Room>(roomsRef)
  const { data: sessions } = useCollection<TimetableEntry>(sessionsRef)

  const [rawInput, setRawInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

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

  const parsedData = useMemo(() => {
    if (!rawInput.trim()) return []
    const lines = rawInput.split('\n').filter(l => l.trim() !== "")
    // Detect if first line is header
    const startIdx = lines[0].toLowerCase().includes('trainer') || lines[0].toLowerCase().includes('class') ? 1 : 0
    
    return lines.slice(startIdx).map((line, idx) => {
      const parts = line.split('\t').map(p => p.trim())
      if (parts.length < 5) return null
      
      return {
        campus: parts[0] as Campus,
        location: parts[1],
        unit: parts[2],
        day: parts[3] as Day,
        trainer: parts[4],
        email: parts[5],
        start: parts[6],
        finish: parts[7]
      }
    }).filter(Boolean)
  }, [rawInput])

  const handleClearDatabase = async () => {
    if (!confirm("DANGER: This will delete ALL current institutional data including Teachers, Units, and Sessions. Continue?")) return
    setIsProcessing(true)
    const batch = writeBatch(db)
    try {
      teachers?.forEach(t => batch.delete(doc(db, "teachers", t.id)))
      units?.forEach(u => batch.delete(doc(db, "academicUnits", u.id)))
      rooms?.forEach(r => batch.delete(doc(db, "rooms", r.id)))
      sessions?.forEach(s => batch.delete(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", s.id)))
      await batch.commit()
      toast({ title: "Database Wiped", description: "You can now paste your new data." })
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Could not clear database." })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSyncData = async () => {
    if (parsedData.length === 0) return
    setIsProcessing(true)
    
    const batch = writeBatch(db)
    const processedTeachers = new Set<string>()
    const processedUnits = new Set<string>()
    const processedRooms = new Set<string>()

    try {
      parsedData.forEach((row: any, idx) => {
        const teacherId = row.trainer.toLowerCase().replace(/\s+/g, '-')
        const unitId = row.unit.toLowerCase().replace(/\s+/g, '-')
        const roomId = row.location.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const campus = (row.campus || "Online") as Campus

        if (!processedTeachers.has(teacherId)) {
          batch.set(doc(db, "teachers", teacherId), { 
            id: teacherId, 
            name: row.trainer, 
            email: row.email || `${teacherId}@novus.edu.au`, 
            qualifiedUnits: [], 
            campuses: [campus], 
            availability: [] 
          }, { merge: true })
          processedTeachers.add(teacherId)
        }

        if (!processedUnits.has(unitId)) {
          batch.set(doc(db, "academicUnits", unitId), { 
            id: unitId, 
            name: row.unit, 
            type: row.location.toLowerCase().includes('online') ? 'online' : 'theory', 
            durationHours: 4, 
            sessionsPerWeek: 1 
          }, { merge: true })
          processedUnits.add(unitId)
        }

        if (!processedRooms.has(roomId)) {
          batch.set(doc(db, "rooms", roomId), { 
            id: roomId, 
            name: row.location, 
            capacity: 30, 
            campus 
          }, { merge: true })
          processedRooms.add(roomId)
        }

        const sessionId = `entry-${Date.now()}-${idx}`
        batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), {
          id: sessionId,
          unitId,
          teacherId,
          room: row.location,
          day: row.day,
          startTime: parseTime(row.start),
          endTime: parseTime(row.finish)
        })
      })

      await batch.commit()
      setRawInput("")
      toast({ title: "Sync Complete", description: `Processed ${parsedData.length} records successfully.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed", description: "Format error detected." })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Institutional Data Entry</h2>
          <p className="text-muted-foreground text-sm">Bulk manage your timetable directly from Excel sheets.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5" onClick={handleClearDatabase} disabled={isProcessing}>
             <Trash2 className="mr-2 h-4 w-4" /> Clear Master Database
           </Button>
           <Button onClick={handleSyncData} disabled={isProcessing || parsedData.length === 0} className="bg-primary">
             {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
             Sync {parsedData.length} Records
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Excel Copy-Paste Area
            </CardTitle>
            <CardDescription>
              Copy rows from your spreadsheet (including Campus, Location, Class, Day, Trainer, etc.) and paste them here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <Textarea 
              placeholder="Perth	Unit 53	ADCCD B2	Saturday	Asim	asim@novus.edu.au	9:30 AM	4:00 PM..."
              className="font-mono text-[10px] min-h-[400px] h-full resize-none bg-muted/20 focus:bg-background transition-colors"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <TableIcon className="h-5 w-5 text-primary" />
              Preview & Validation
            </CardTitle>
            <CardDescription>
              Check the parsed rows before committing them to the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
             {parsedData.length > 0 ? (
               <Table>
                 <TableHeader className="bg-muted/50 sticky top-0">
                   <TableRow>
                     <TableHead className="text-[10px]">Site</TableHead>
                     <TableHead className="text-[10px]">Subject</TableHead>
                     <TableHead className="text-[10px]">Day</TableHead>
                     <TableHead className="text-[10px]">Time</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {parsedData.map((row: any, i) => (
                     <TableRow key={i}>
                       <TableCell className="text-[10px] font-bold">{row.campus}</TableCell>
                       <TableCell className="text-[10px]">{row.unit}</TableCell>
                       <TableCell className="text-[10px]">{row.day}</TableCell>
                       <TableCell className="text-[10px] font-mono">{row.start}-{row.finish}</TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             ) : (
               <div className="flex flex-col items-center justify-center py-32 text-center px-8">
                  <div className="p-4 rounded-full bg-muted mb-4">
                     <AlertCircle className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-bold">No Data Detected</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                    Paste content from your Excel file to begin the automatic entity mapping process.
                  </p>
               </div>
             )}
          </CardContent>
          {parsedData.length > 0 && (
            <div className="p-4 bg-muted/30 border-t flex justify-between items-center">
               <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                 <CheckCircle2 className="h-3 w-3 text-green-500" /> 
                 {parsedData.length} records ready for processing
               </span>
               <div className="flex items-center text-[10px] text-primary font-black uppercase">
                 Review Required <ChevronRight className="h-3 w-3" />
               </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
