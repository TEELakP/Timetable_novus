
"use client"

import React, { useState, useMemo, useEffect } from "react"
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  Loader2,
  Table as TableIcon,
  Code2,
  FileSpreadsheet,
  Save,
  FileJson,
  Zap,
  AlertTriangle,
  Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase"
import { collection, doc, writeBatch, getDocs } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Campus, Day, Teacher, Unit, Room, TimetableEntry, RoomType } from "@/lib/types"
import { ADDRESS_MAP } from "@/lib/mock-data"

const ACTIVE_TIMETABLE_ID = "default-timetable"

type DataMode = 'excel' | 'json'
type EntityType = 'teachers' | 'academicUnits' | 'rooms' | 'sessions' | 'rules'

export default function DataEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const { isUserLoading } = useUser()
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  const rulesRef = useMemoFirebase(() => collection(db, "schedulingRules"), [db])
  
  const { data: teachers } = useCollection<Teacher>(teachersRef)
  const { data: units } = useCollection<Unit>(unitsRef)
  const { data: rooms } = useCollection<Room>(roomsRef)
  const { data: sessions } = useCollection<TimetableEntry>(sessionsRef)
  const { data: rules } = useCollection<{ id: string, name: string }>(rulesRef)

  const [mode, setMode] = useState<DataMode>('excel')
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('teachers')
  const [jsonInput, setJsonInput] = useState("")
  const [rawInput, setRawInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isWipeDialogOpen, setIsWipeDialogOpen] = useState(false)

  useEffect(() => {
    let currentData: any[] = []
    if (selectedEntity === 'teachers') currentData = teachers || []
    if (selectedEntity === 'academicUnits') currentData = units || []
    if (selectedEntity === 'rooms') currentData = rooms || []
    if (selectedEntity === 'sessions') currentData = sessions || []
    if (selectedEntity === 'rules') currentData = rules || []
    
    setJsonInput(JSON.stringify(currentData, null, 2))
  }, [selectedEntity, teachers, units, rooms, sessions, rules])

  const parseTime = (timeStr: string) => {
    if (!timeStr) return "09:00"
    const clean = timeStr.trim().toUpperCase()
    const match = clean.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/)
    if (!match) return "09:00"

    let hour = parseInt(match[1])
    const min = match[2].padStart(2, '0')
    const ampm = match[4]

    if (ampm === "PM" && hour < 12) hour += 12
    if (ampm === "AM" && hour === 12) hour = 0

    return `${hour.toString().padStart(2, '0')}:${min}`
  }

  const parsedData = useMemo(() => {
    if (!rawInput.trim()) return []
    const lines = rawInput.split('\n').filter(l => l.trim() !== "")
    
    return lines.map((line) => {
      const parts = line.split('\t').map(p => p.trim())
      // Expected Format (9 columns):
      // Campus (0), Location (1), Class (2), Day (3), Trainer (4), Email (5), Start (6), Finish (7), Class_name (8)
      if (parts.length < 9) return null
      
      const campus = parts[0] as Campus
      const locationName = parts[1]
      const className = parts[8] || campus // Fallback to Campus name if Class_name is empty
      
      return {
        campus,
        location: locationName,
        unit: parts[2],
        day: parts[3] as Day,
        trainer: parts[4],
        email: parts[5],
        start: parts[6],
        finish: parts[7],
        roomName: className
      }
    }).filter(Boolean)
  }, [rawInput])

  const handleClearDatabase = async () => {
    setIsProcessing(true)
    setIsWipeDialogOpen(false)
    
    try {
      const targetCollections = ["teachers", "academicUnits", "rooms", "schedulingRules", "timetables"];
      let totalDeleted = 0;

      for (const colName of targetCollections) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        
        if (snapshot.empty) continue;
        
        for (let i = 0; i < snapshot.docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = snapshot.docs.slice(i, i + 400);
          
          for (const docSnapshot of chunk) {
            if (colName === "timetables") {
              const sessionsRef = collection(db, "timetables", docSnapshot.id, "classSessions");
              const sessionsSnapshot = await getDocs(sessionsRef);
              if (!sessionsSnapshot.empty) {
                sessionsSnapshot.docs.forEach(sDoc => {
                  batch.delete(sDoc.ref);
                  totalDeleted++;
                });
              }
            }
            batch.delete(docSnapshot.ref);
            totalDeleted++;
          }
          await batch.commit();
        }
      }

      toast({ 
        title: "Nuclear Wipe Successful", 
        description: `Permanently removed ${totalDeleted} entries.` 
      });
      setRawInput("");
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Wipe Failed", 
        description: e.message 
      });
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSyncExcel = async () => {
    if (parsedData.length === 0) return
    setIsProcessing(true)
    
    const batch = writeBatch(db)
    const processedTeachers = new Set<string>()
    const processedUnits = new Set<string>()
    const processedRooms = new Set<string>()

    try {
      parsedData.forEach((row: any) => {
        // 1. Sanitize IDs
        const teacherId = row.trainer.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')
        const unitId = row.unit.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')
        const campus = row.campus as Campus
        const roomId = `${campus}-${row.roomName}`.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')

        // 2. Map Teacher
        if (teacherId && !processedTeachers.has(teacherId)) {
          batch.set(doc(db, "teachers", teacherId), { 
            id: teacherId, 
            name: row.trainer, 
            email: row.email, 
            qualifiedUnits: [unitId], 
            campuses: [campus], 
            availability: [] 
          }, { merge: true })
          processedTeachers.add(teacherId)
        }

        // 3. Map Unit
        if (unitId && !processedUnits.has(unitId)) {
          batch.set(doc(db, "academicUnits", unitId), { 
            id: unitId, 
            name: row.unit, 
            type: 'theory', 
            durationHours: 4, 
            sessionsPerWeek: 1 
          }, { merge: true })
          processedUnits.add(unitId)
        }

        // 4. Map Room
        if (roomId && !processedRooms.has(roomId)) {
          const siteAddress = ADDRESS_MAP[row.location] || ADDRESS_MAP[campus] || 'Default Address'
          const roomType: RoomType = row.location.toLowerCase().includes('kitchen') || row.location.toLowerCase().includes('workshop') ? 'Workshop' : 'Classroom'
          
          batch.set(doc(db, "rooms", roomId), { 
            id: roomId, 
            name: row.roomName, 
            capacity: 30, 
            campus,
            siteName: row.location,
            address: siteAddress,
            type: roomType
          }, { merge: true })
          processedRooms.add(roomId)
        }

        // 5. Map Session
        const startT = parseTime(row.start)
        const finishT = parseTime(row.finish)
        const sessionKey = `${teacherId}-${unitId}-${row.day.toLowerCase()}-${startT.replace(':', '')}`.replace(/[^a-z0-9]/g, '-')
        const sessionId = `s-${sessionKey}`
        
        batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), {
          id: sessionId,
          unitId,
          teacherId,
          room: row.roomName,
          campus,
          day: row.day,
          startTime: startT,
          endTime: finishT,
          acknowledged: false
        }, { merge: true })
      })

      await batch.commit()
      toast({ title: "Synchronization Complete", description: `Updated ${parsedData.length} records across all collections.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSyncJson = async () => {
    setIsProcessing(true)
    try {
      const data = JSON.parse(jsonInput)
      const batch = writeBatch(db)
      data.forEach((item: any) => {
        if (!item.id) return
        let ref;
        if (selectedEntity === 'sessions') {
          ref = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", item.id)
        } else if (selectedEntity === 'rules') {
          ref = doc(db, "schedulingRules", item.id)
        } else {
          ref = doc(db, selectedEntity === 'academicUnits' ? "academicUnits" : selectedEntity, item.id)
        }
        batch.set(ref, item, { merge: true })
      })
      await batch.commit()
      toast({ title: "JSON Update Complete" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Invalid JSON Structure" })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline text-primary">Data Entry Hub</h2>
          <p className="text-muted-foreground text-sm">Bulk propagate Teachers, Units, and Rooms via Excel Sync.</p>
        </div>
        <div className="flex gap-2">
           <Button 
             variant="destructive" 
             onClick={() => setIsWipeDialogOpen(true)} 
             disabled={isProcessing || isUserLoading}
           >
             {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-white" />}
             Wipe Database
           </Button>
           {mode === 'excel' ? (
             <Button onClick={handleSyncExcel} disabled={isProcessing || parsedData.length === 0} className="bg-primary">
               {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
               Sync {parsedData.length} Records
             </Button>
           ) : (
             <Button onClick={handleSyncJson} disabled={isProcessing} className="bg-primary">
               {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
               Save JSON
             </Button>
           )}
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="space-y-6">
        <TabsList className="grid w-[400px] grid-cols-2">
          <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel Sync</TabsTrigger>
          <TabsTrigger value="json" className="gap-2"><Code2 className="h-4 w-4" /> Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="excel" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-[500px] flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Excel Input (9 Columns)
                </CardTitle>
                <CardDescription>Format: Campus, Location, Class, Day, Trainer, Email, Start, Finish, Class_name</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <Textarea 
                  placeholder="Example: Ultimo	Ultimo Campus	DBC	Wednesday	Bharath	Bharath@novus.edu.au	4:00 PM	10:30 PM	Makalu"
                  className="font-mono text-[11px] h-full resize-none bg-muted/20"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              </CardContent>
            </Card>

            <Card className="h-[500px] flex flex-col overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" />
                  Processing Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-auto flex-1">
                 {parsedData.length > 0 ? (
                   <Table>
                     <TableHeader className="bg-muted/50 sticky top-0">
                       <TableRow>
                         <TableHead className="text-[10px]">Campus</TableHead>
                         <TableHead className="text-[10px]">Trainer</TableHead>
                         <TableHead className="text-[10px]">Subject</TableHead>
                         <TableHead className="text-[10px]">Room</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {parsedData.map((row: any, i) => (
                         <TableRow key={i}>
                           <TableCell className="text-[10px] font-bold">{row.campus}</TableCell>
                           <TableCell className="text-[10px]">{row.trainer}</TableCell>
                           <TableCell className="text-[10px]">{row.unit}</TableCell>
                           <TableCell className="text-[10px] font-black text-primary">{row.roomName}</TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full text-muted-foreground italic text-sm">
                      <FileSpreadsheet className="h-12 w-12 mb-2 opacity-20" />
                      Paste Excel data to preview
                   </div>
                 )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Raw Collection Data</CardTitle>
              <Select value={selectedEntity} onValueChange={(v: EntityType) => setSelectedEntity(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teachers">Teachers</SelectItem>
                  <SelectItem value="academicUnits">Units</SelectItem>
                  <SelectItem value="rooms">Rooms</SelectItem>
                  <SelectItem value="sessions">Sessions</SelectItem>
                  <SelectItem value="rules">Rules</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <Textarea 
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                className="font-mono text-[11px] min-h-[600px] bg-black text-green-400"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isWipeDialogOpen} onOpenChange={setIsWipeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Nuclear Database Wipe
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete ALL data across all collections including Teachers, Rooms, and Sessions. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive text-destructive-foreground">
              Confirm Nuclear Wipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
