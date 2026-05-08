
"use client"

import React, { useState, useMemo, useEffect } from "react"
import { 
  Database, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Table as TableIcon,
  ChevronRight,
  Code2,
  FileSpreadsheet,
  Save,
  FileJson,
  Zap,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { collection, doc, writeBatch, getDocs, query, limit } from "firebase/firestore"
import { useToast } from "@/hooks/use-toast"
import { Campus, Day, Teacher, Unit, Room, TimetableEntry, RoomType } from "@/lib/types"
import { SITES_CONFIG } from "@/lib/mock-data"

const ACTIVE_TIMETABLE_ID = "default-timetable"

type DataMode = 'excel' | 'json'
type EntityType = 'teachers' | 'academicUnits' | 'rooms' | 'sessions' | 'rules'

export default function DataEntryPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const { user, isUserLoading } = useUser()
  
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
    const match = clean.match(/(\d+):?(\d*):?(\d*)\s*(AM|PM)?/)
    if (!match) return "09:00"

    let hour = parseInt(match[1])
    const min = match[2] ? match[2].padStart(2, '0') : "00"
    const ampm = match[4]

    if (ampm === "PM" && hour < 12) hour += 12
    if (ampm === "AM" && hour === 12) hour = 0

    return `${hour.toString().padStart(2, '0')}:${min}`
  }

  const parsedData = useMemo(() => {
    if (!rawInput.trim()) return []
    const lines = rawInput.split('\n').filter(l => l.trim() !== "")
    const uniqueLines = Array.from(new Set(lines))
    
    return uniqueLines.map((line) => {
      const parts = line.split('\t').map(p => p.trim())
      if (parts.length < 5) return null
      
      return {
        campus: parts[0] as Campus,
        unit: parts[1],
        day: parts[2] as Day,
        trainer: parts[3],
        email: parts[4],
        start: parts[5],
        finish: parts[6],
        location: parts[7]
      }
    }).filter(Boolean)
  }, [rawInput])

  const handleClearDatabase = async () => {
    setIsProcessing(true)
    setIsWipeDialogOpen(false)
    console.log("--- STARTING NUCLEAR WIPE ---");
    
    try {
      let totalDeleted = 0;
      const targetCollections = ["teachers", "academicUnits", "rooms", "schedulingRules", "timetables"];

      for (const colName of targetCollections) {
        console.log(`Scanning collection: ${colName}...`);
        const colRef = collection(db, colName);
        const snapshot = await getDocs(colRef);
        
        if (snapshot.empty) {
          console.log(`Collection [${colName}] is already empty.`);
          continue;
        }

        console.log(`Found ${snapshot.size} documents in [${colName}]`);
        
        for (let i = 0; i < snapshot.docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = snapshot.docs.slice(i, i + 400);
          
          for (const docSnapshot of chunk) {
            if (colName === "timetables") {
              const sessionsRef = collection(db, "timetables", docSnapshot.id, "classSessions");
              const sessionsSnapshot = await getDocs(sessionsRef);
              
              if (!sessionsSnapshot.empty) {
                console.log(`-> Deleting ${sessionsSnapshot.size} nested sessions for timetable: ${docSnapshot.id}`);
                for (let j = 0; j < sessionsSnapshot.docs.length; j += 400) {
                  const subBatch = writeBatch(db);
                  sessionsSnapshot.docs.slice(j, j + 400).forEach(sDoc => {
                    subBatch.delete(sDoc.ref);
                    totalDeleted++;
                  });
                  await subBatch.commit();
                }
              }
            }
            batch.delete(docSnapshot.ref);
            totalDeleted++;
          }
          await batch.commit();
          console.log(`Committed deletion batch for [${colName}]`);
        }
      }

      console.log(`--- WIPE COMPLETE. TOTAL DELETED: ${totalDeleted} ---`);
      toast({ 
        title: "Database Reset Successful", 
        description: `Permanently removed ${totalDeleted} entries. Your database is now empty.` 
      });
      setRawInput("");
    } catch (e: any) {
      console.error("CRITICAL WIPE FAILURE:", e);
      toast({ 
        variant: "destructive", 
        title: "Wipe Operation Failed", 
        description: e.message || "A secure database error occurred." 
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
        const teacherId = row.trainer.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const unitId = row.unit.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const roomId = row.location.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const campus = (row.campus || "Online") as Campus

        if (!processedTeachers.has(teacherId)) {
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

        if (!processedUnits.has(unitId)) {
          batch.set(doc(db, "academicUnits", unitId), { 
            id: unitId, 
            name: row.unit, 
            type: 'theory', 
            durationHours: 4, 
            sessionsPerWeek: 1 
          }, { merge: true })
          processedUnits.add(unitId)
        }

        if (!processedRooms.has(roomId)) {
          const site = SITES_CONFIG[campus]?.find(s => s.type === 'Classroom')
          batch.set(doc(db, "rooms", roomId), { 
            id: roomId, 
            name: row.location, 
            capacity: 30, 
            campus,
            siteName: site?.name || campus,
            address: site?.address || "",
            type: 'Classroom'
          }, { merge: true })
          processedRooms.add(roomId)
        }

        const sessionKey = `${row.trainer}-${row.unit}-${row.day}-${row.start}-${row.location}`.toLowerCase().replace(/[^a-z0-9]/g, '-')
        const sessionId = `s-${sessionKey}`
        
        batch.set(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionId), {
          id: sessionId,
          unitId,
          teacherId,
          room: row.location,
          day: row.day,
          startTime: parseTime(row.start),
          endTime: parseTime(row.finish)
        }, { merge: true })
      })

      await batch.commit()
      toast({ title: "Sync Complete", description: `Processed ${parsedData.length} unique records.` })
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Failed" })
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
      toast({ variant: "destructive", title: "Invalid JSON" })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Data Manager</h2>
          <p className="text-muted-foreground text-sm">Bulk manage institutional records via Excel or raw JSON access.</p>
        </div>
        <div className="flex gap-2">
           <Button 
             variant="destructive" 
             className="shadow-lg border-2" 
             onClick={() => setIsWipeDialogOpen(true)} 
             disabled={isProcessing || isUserLoading}
           >
             {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4 fill-white" />}
             Wipe Database
           </Button>
           {mode === 'excel' ? (
             <Button onClick={handleSyncExcel} disabled={isProcessing || parsedData.length === 0} className="bg-primary">
               {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
               Sync {parsedData.length} Rows
             </Button>
           ) : (
             <Button onClick={handleSyncJson} disabled={isProcessing} className="bg-primary">
               {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
               Save Raw Data
             </Button>
           )}
        </div>
      </div>

      <Tabs value={mode} onValueChange={(v: any) => setMode(v)} className="space-y-6">
        <div className="flex items-center justify-between bg-muted/30 p-1.5 rounded-lg w-fit border">
          <TabsList className="bg-transparent">
            <TabsTrigger value="excel" className="gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel Paste</TabsTrigger>
            <TabsTrigger value="json" className="gap-2"><Code2 className="h-4 w-4" /> Raw JSON Editor</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="excel" className="space-y-6 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="h-[500px] flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Excel Copy-Paste Area
                </CardTitle>
                <CardDescription>Paste your spreadsheet rows here. Identical rows are automatically ignored.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <Textarea 
                  placeholder="Perth	Room 1	Class A	Monday	John..."
                  className="font-mono text-[10px] h-full resize-none bg-muted/20 focus:bg-background transition-colors"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                />
              </CardContent>
            </Card>

            <Card className="h-[500px] flex flex-col overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-primary" />
                  Preview & Mapping
                </CardTitle>
                <CardDescription>Verify the columns before syncing.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-auto flex-1">
                 {parsedData.length > 0 ? (
                   <Table>
                     <TableHeader className="bg-muted/50 sticky top-0 z-10">
                       <TableRow>
                         <TableHead className="text-[10px]">Site</TableHead>
                         <TableHead className="text-[10px]">Subject</TableHead>
                         <TableHead className="text-[10px]">Trainer</TableHead>
                         <TableHead className="text-[10px]">Time</TableHead>
                         <TableHead className="text-[10px]">Room</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {parsedData.map((row: any, i) => (
                         <TableRow key={i}>
                           <TableCell className="text-[10px] font-bold">{row.campus}</TableCell>
                           <TableCell className="text-[10px]">{row.unit}</TableCell>
                           <TableCell className="text-[10px]">{row.trainer}</TableCell>
                           <TableCell className="text-[10px] font-mono whitespace-nowrap">{row.day} {row.start}-{row.finish}</TableCell>
                           <TableCell className="text-[10px]">{row.location}</TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full text-center px-8 text-muted-foreground">
                      <FileSpreadsheet className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-sm">No spreadsheet data detected in the paste area.</p>
                   </div>
                 )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="json" className="space-y-6 mt-0">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-primary" />
                  Raw Data Access
                </CardTitle>
                <CardDescription>Directly edit the JSON files stored in the database.</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Select Data File:</span>
                <Select value={selectedEntity} onValueChange={(v: EntityType) => setSelectedEntity(v)}>
                  <SelectTrigger className="w-[200px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teachers">Teachers Directory</SelectItem>
                    <SelectItem value="academicUnits">Units Catalog</SelectItem>
                    <SelectItem value="rooms">Rooms List</SelectItem>
                    <SelectItem value="sessions">Class Sessions</SelectItem>
                    <SelectItem value="rules">Scheduling Rules</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="relative group">
                <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                   <Badge variant="secondary" className="font-mono text-[10px]">READ/WRITE ACCESS</Badge>
                </div>
                <Textarea 
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  className="font-mono text-[11px] min-h-[600px] bg-black text-green-400 focus:text-green-300 border-primary/30 leading-relaxed"
                  placeholder="[{ 'id': '...', ... }]"
                />
              </div>
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
              This will permanently delete ALL documents across ALL collections. Teachers, Units, Rooms, and all Scheduled Sessions will be lost forever. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm Nuclear Wipe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
