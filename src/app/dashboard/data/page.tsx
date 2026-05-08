
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
  Zap,
  AlertTriangle,
  Info,
  Server
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
import { collection, doc, writeBatch, getDocs, deleteDoc } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Campus, Day, Teacher, Unit, Room, TimetableEntry, RoomType } from "@/lib/types"
import { ADDRESS_MAP, SITES_CONFIG } from "@/lib/mock-data"

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

  const inferCampus = (location: string): Campus => {
    const loc = location.toLowerCase()
    if (loc.includes('ultimo')) return 'Ultimo'
    if (loc.includes('gosford')) return 'Gosford'
    if (loc.includes('perth')) return 'Perth'
    return 'Online'
  }

  const parsedData = useMemo(() => {
    if (!rawInput.trim()) return []
    const lines = rawInput.split('\n').filter(l => l.trim() !== "")
    
    return lines.map((line) => {
      const parts = line.split('\t').map(p => p.trim())
      // 8-column format: Location, Class, Day, Trainer, Email, Start, Finish, Class_name
      if (parts.length < 8) return null
      
      const location = parts[0]
      const campus = inferCampus(location)
      
      let roomName = parts[7]
      if (!roomName || roomName.trim() === "") {
        if (campus === 'Perth') roomName = 'P1'
        else if (campus === 'Ultimo') roomName = 'Ultimo Fallback'
        else if (campus === 'Gosford') roomName = 'A1'
        else roomName = campus
      }
      
      return {
        campus,
        location,
        unit: parts[1],
        day: parts[2] as Day,
        trainer: parts[3],
        email: parts[4],
        start: parts[5],
        finish: parts[6],
        roomName: roomName
      }
    }).filter(Boolean)
  }, [rawInput])

  const handleClearDatabase = async () => {
    setIsProcessing(true)
    setIsWipeDialogOpen(false)
    
    try {
      // EXCLUDE rooms from the wipe as per requirements
      const targetCollections = ["teachers", "academicUnits", "schedulingRules", "timetables"];
      let totalDeleted = 0;

      for (const colName of targetCollections) {
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        
        if (snapshot.empty) continue;
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnapshot => {
          batch.delete(docSnapshot.ref);
          totalDeleted++;
        });
        await batch.commit();
      }

      toast({ 
        title: "Database Reset Complete", 
        description: `Successfully removed ${totalDeleted} entries. Rooms directory was preserved.` 
      });
      setRawInput("");
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Reset Failed", 
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

    try {
      parsedData.forEach((row: any) => {
        const trainerName = row.trainer || "Unassigned"
        const teacherId = trainerName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')
        const unitName = row.unit || "Unknown Class"
        const unitId = unitName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')
        const campus = row.campus as Campus
        const roomIdentifier = row.roomName || campus

        if (!teacherId || !unitId) return

        if (!processedTeachers.has(teacherId)) {
          batch.set(doc(db, "teachers", teacherId), { 
            id: teacherId, 
            name: trainerName, 
            email: row.email || `${teacherId}@novus.edu.au`, 
            qualifiedUnits: [unitId], 
            campuses: [campus], 
            availability: [] 
          }, { merge: true })
          processedTeachers.add(teacherId)
        }

        if (!processedUnits.has(unitId)) {
          batch.set(doc(db, "academicUnits", unitId), { 
            id: unitId, 
            name: unitName, 
            type: 'theory', 
            durationHours: 4, 
            sessionsPerWeek: 1 
          }, { merge: true })
          processedUnits.add(unitId)
        }

        const startT = parseTime(row.start)
        const finishT = parseTime(row.finish)
        const dayKey = row.day.toLowerCase().trim()
        const sessionKey = `${teacherId}-${unitId}-${dayKey}-${startT.replace(':', '')}`.replace(/[^a-z0-9]/g, '-')
        const sessionId = `s-${sessionKey}`
        
        batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), {
          id: sessionId,
          unitId,
          teacherId,
          room: roomIdentifier,
          location: row.location,
          campus,
          day: row.day,
          startTime: startT,
          endTime: finishT,
          acknowledged: false
        }, { merge: true })
      })

      await batch.commit()
      toast({ title: "Synchronization Complete", description: `Updated ${parsedData.length} records. All rooms referenced.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSeedRooms = async () => {
    setIsProcessing(true)
    const batch = writeBatch(db)
    let count = 0

    try {
      Object.entries(SITES_CONFIG).forEach(([campus, sites]) => {
        sites.forEach(site => {
          site.rooms.forEach(roomName => {
            const id = `r-${campus}-${roomName}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            batch.set(doc(db, "rooms", id), {
              id,
              name: roomName,
              campus: campus as Campus,
              siteName: site.name,
              address: site.address,
              capacity: 30,
              type: site.type as RoomType
            }, { merge: true })
            count++
          })
        })
      })
      await batch.commit()
      toast({ title: "Institutional Rooms Created", description: `Seeded ${count} persistent rooms across all sites.` })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Seeding Failed" })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline text-primary">Data Manager</h2>
          <p className="text-muted-foreground text-sm">8-column Excel Sync & Institutional Hierarchy Reference.</p>
        </div>
        <div className="flex gap-2">
           <Button 
             variant="outline" 
             onClick={handleSeedRooms} 
             disabled={isProcessing || isUserLoading}
           >
             <Server className="mr-2 h-4 w-4" /> Seed Rooms
           </Button>
           <Button 
             variant="destructive" 
             onClick={() => setIsWipeDialogOpen(true)} 
             disabled={isProcessing || isUserLoading}
           >
             {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
             Wipe Schedule
           </Button>
           <Button onClick={handleSyncExcel} disabled={isProcessing || parsedData.length === 0} className="bg-primary">
             {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
             Sync {parsedData.length} Records
           </Button>
        </div>
      </div>

      <Tabs defaultValue="excel" className="space-y-6">
        <TabsList className="grid w-[400px] grid-cols-2">
          <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel Sync</TabsTrigger>
          <TabsTrigger value="json" className="gap-2"><Code2 className="h-4 w-4" /> Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="excel" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-[500px] flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  Excel Input (8 Columns)
                </CardTitle>
                <CardDescription>Format: Location, Class, Day, Trainer, Email, Start, Finish, Class_name</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <Textarea 
                  placeholder="Paste your 8-column schedule here..."
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
                         <TableHead className="text-[10px]">Site Address</TableHead>
                         <TableHead className="text-[10px]">Room (Referenced)</TableHead>
                         <TableHead className="text-[10px]">Subject</TableHead>
                         <TableHead className="text-[10px]">Trainer</TableHead>
                         <TableHead className="text-[10px]">Day/Time</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {parsedData.map((row: any, i) => (
                         <TableRow key={i}>
                           <TableCell className="text-[10px] font-bold max-w-[150px] truncate">{row.location}</TableCell>
                           <TableCell className="text-[10px] text-primary font-black">{row.roomName}</TableCell>
                           <TableCell className="text-[10px]">{row.unit}</TableCell>
                           <TableCell className="text-[10px]">{row.trainer}</TableCell>
                           <TableCell className="text-[10px]">{row.day} {row.start}</TableCell>
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
                readOnly
                value={jsonInput}
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
              Reset All Schedule Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all Sessions, Teachers, and Units. 
              <strong> The Rooms directory and institutional hierarchy will be PRESERVED.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive text-destructive-foreground">
              Confirm Schedule Wipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
