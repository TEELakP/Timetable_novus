
"use client"

import { useState, useMemo } from "react"
import { 
  Plus, 
  BookOpen, 
  Trash2, 
  Loader2, 
  Settings2,
  Filter,
  AlertTriangle,
  ExternalLink,
  Clock,
  DoorOpen,
  Edit2,
  User as UserIcon
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Unit, Teacher, TimetableEntry, Room, Campus, Day } from "@/lib/types"
import { DAYS, CAMPUSES } from "@/lib/mock-data"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const ACTIVE_TIMETABLE_ID = "default-timetable"

const DELIVERY_MODES = [
  { value: 'theory', label: 'Classroom' },
  { value: 'practical', label: 'Workshop' },
  { value: 'online', label: 'Online' },
]

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

export default function UnitsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])

  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: teachers } = useCollection<Teacher>(teachersRef)
  const { data: rooms } = useCollection<Room>(roomsRef)
  const { data: sessions } = useCollection<TimetableEntry>(sessionsRef)

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Deletion state
  const [unitToDelete, setUnitToDelete] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  // Detail Modal State
  const [selectedUnitForDetail, setSelectedUnitForDetail] = useState<Unit | null>(null)

  // Session Edit/Add State
  const [editingSession, setEditingSession] = useState<TimetableEntry | null>(null)
  const [newRoomForSession, setNewRoomForSession] = useState("")
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false)
  const [newSessionData, setNewSessionData] = useState({
    teacherId: "",
    day: "Monday" as Day,
    startTime: "09:00",
    endTime: "11:00",
    room: ""
  })

  // Room Creation State
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomCampus, setNewRoomCampus] = useState<Campus>('Online')

  const filteredUnits = useMemo(() => {
    if (!units) return []
    let data = [...units]
    if (searchQuery) {
      data = data.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    if (selectedTypes.length > 0) {
      data = data.filter(u => selectedTypes.includes(u.type))
    }
    return data.sort((a,b) => a.name.localeCompare(b.name))
  }, [units, searchQuery, selectedTypes])

  const unitSessions = useMemo(() => {
    if (!selectedUnitForDetail || !sessions) return []
    return sessions
      .filter(s => s.unitId === selectedUnitForDetail.id)
      .sort((a, b) => {
        const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day)
        if (dayDiff !== 0) return dayDiff
        return a.startTime.localeCompare(b.startTime)
      })
  }, [selectedUnitForDetail, sessions])

  // Filter teachers to only show those qualified for the selected unit
  const qualifiedTeachers = useMemo(() => {
    if (!selectedUnitForDetail || !teachers) return []
    return teachers.filter(t => t.qualifiedUnits.includes(selectedUnitForDetail.id))
      .sort((a,b) => a.name.localeCompare(b.name))
  }, [selectedUnitForDetail, teachers])

  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitType, setNewUnitType] = useState<'theory' | 'practical' | 'online'>('theory')

  const handleCreateUnit = () => {
    if (!newUnitName.trim()) return
    const id = `u-${Date.now()}`
    setDocumentNonBlocking(doc(db, "academicUnits", id), {
      id,
      name: newUnitName.trim(),
      type: newUnitType,
      durationHours: 2,
      sessionsPerWeek: 1
    }, { merge: true })
    setIsSingleOpen(false)
    toast({ title: "Unit Created" })
  }

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return
    const id = `r-${Date.now()}`
    setDocumentNonBlocking(doc(db, "rooms", id), {
      id,
      name: newRoomName.trim(),
      campus: newRoomCampus,
      capacity: 30
    }, { merge: true })
    setNewRoomName("")
    setIsRoomDialogOpen(false)
    toast({ title: "Room Created", description: `${newRoomName} added to directory.` })
  }

  const handleUpdateSessionRoom = () => {
    if (!editingSession) return
    const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", editingSession.id)
    updateDocumentNonBlocking(sessionRef, { room: newRoomForSession })
    setEditingSession(null)
    toast({ title: "Session Updated", description: "Classroom assignment changed." })
  }

  const handleAddSessionToUnit = () => {
    if (!selectedUnitForDetail || !newSessionData.teacherId) return
    const id = `s-${Date.now()}`
    const sessionData: TimetableEntry = {
      ...newSessionData,
      id,
      unitId: selectedUnitForDetail.id,
      acknowledged: false
    }
    setDocumentNonBlocking(doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", id), sessionData, { merge: true })
    setIsAddSessionOpen(false)
    toast({ title: "Session Added" })
  }

  const confirmDeleteUnit = () => {
    if (!unitToDelete) return
    const unitRef = doc(db, "academicUnits", unitToDelete)
    deleteDocumentNonBlocking(unitRef)
    setUnitToDelete(null)
    toast({ title: "Unit Removed", description: "The academic unit has been deleted." })
  }

  const confirmDeleteSession = () => {
    if (!sessionToDelete) return
    const sessionRef = doc(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions", sessionToDelete)
    deleteDocumentNonBlocking(sessionRef)
    setSessionToDelete(null)
    toast({ title: "Session Removed", description: "The class instance has been deleted." })
  }

  if (loadingUnits) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Academic Catalog</h2>
        <div className="flex gap-2">
           <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><DoorOpen className="mr-2 h-4 w-4" /> Add Room</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Classroom</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Room Name</Label>
                  <Input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} placeholder="e.g. Room 301" />
                </div>
                <div className="space-y-2">
                  <Label>Campus</Label>
                  <Select value={newRoomCampus} onValueChange={(v: Campus) => setNewRoomCampus(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddRoom} disabled={!newRoomName.trim()}>Save Classroom</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => setIsSingleOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Unit
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Filters:</span>
        </div>
        
        <div className="relative w-64">
          <BookOpen className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Search by subject..." 
            className="pl-8 h-8 text-xs" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <MultiSelectFilter 
          label="Modes"
          icon={Settings2}
          options={DELIVERY_MODES}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />

        {(selectedTypes.length > 0 || searchQuery) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedTypes([]); setSearchQuery(""); }}
          >
            Clear All
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Unit Name</TableHead>
                <TableHead>Delivery Mode</TableHead>
                <TableHead>Requirements</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.map((unit) => (
                <TableRow key={unit.id} className="group">
                  <TableCell>
                    <button 
                      onClick={() => setSelectedUnitForDetail(unit)}
                      className="flex flex-col text-left hover:text-primary transition-colors group/btn"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold group-hover/btn:underline">{unit.name}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(
                      unit.type === 'theory' ? "bg-blue-100 text-blue-700" :
                      unit.type === 'practical' ? "bg-orange-100 text-orange-700" :
                      "bg-emerald-100 text-emerald-700"
                    )}>
                      {unit.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {unit.durationHours} hrs/week • {unit.sessionsPerWeek} session(s)
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setUnitToDelete(unit.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Deletion Confirmation for Unit */}
      <AlertDialog open={!!unitToDelete} onOpenChange={(open) => !open && setUnitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this academic unit? This will permanently remove the unit definition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteUnit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deletion Confirmation for Session */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Session
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this specific class session?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unit Detail Modal */}
      <Dialog open={!!selectedUnitForDetail} onOpenChange={(open) => !open && setSelectedUnitForDetail(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between w-full pr-8">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <span className="font-black text-primary uppercase tracking-tight">{selectedUnitForDetail?.name}</span>
                <Badge variant="outline">Catalog Schedule</Badge>
              </DialogTitle>
              <Button onClick={() => setIsAddSessionOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Session
              </Button>
            </div>
          </DialogHeader>
          
          <div className="py-4">
            <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 border-b pb-2">Active Sessions</h4>
            <div className="max-h-[400px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead>Day & Time</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitSessions.map((session) => {
                    const teacher = teachers?.find(t => t.id === session.teacherId)
                    return (
                      <TableRow key={session.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-xs">{session.day}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> {session.startTime} - {session.endTime}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">{teacher?.name || 'Unassigned'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{session.room}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingSession(session)
                                setNewRoomForSession(session.room)
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => setSessionToDelete(session.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUnitForDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Session Dialog for Specific Unit - TEACHER VALIDATION ENFORCED */}
      <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Session for {selectedUnitForDetail?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <UserIcon className="h-3 w-3" /> Qualified Trainer
              </Label>
              <Select value={newSessionData.teacherId} onValueChange={(v) => setNewSessionData({...newSessionData, teacherId: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Qualified Trainer" />
                </SelectTrigger>
                <SelectContent>
                  {qualifiedTeachers.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                  {qualifiedTeachers.length === 0 && (
                    <SelectItem value="none" disabled>No qualified trainers found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {qualifiedTeachers.length === 0 && (
                <p className="text-[10px] text-destructive font-medium italic">
                  Note: No trainers are currently marked as qualified to teach this unit.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Day</Label>
                <Select value={newSessionData.day} onValueChange={(v: Day) => setNewSessionData({...newSessionData, day: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Location</Label>
                <Select value={newSessionData.room} onValueChange={(v) => setNewSessionData({...newSessionData, room: v})}>
                  <SelectTrigger><SelectValue placeholder="Room" /></SelectTrigger>
                  <SelectContent>
                    {rooms?.sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                      <SelectItem key={r.id} value={r.name}>{r.name} ({r.campus})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input type="time" value={newSessionData.startTime} onChange={e => setNewSessionData({...newSessionData, startTime: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>End Time</Label>
                <Input type="time" value={newSessionData.endTime} onChange={e => setNewSessionData({...newSessionData, endTime: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSessionOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSessionToUnit} disabled={!newSessionData.teacherId || newSessionData.teacherId === 'none'}>
              Save Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Session Edit Dialog */}
      <Dialog open={!!editingSession} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Session Classroom</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Existing Room</Label>
              <Select value={newRoomForSession} onValueChange={setNewRoomForSession}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rooms?.sort((a,b) => a.name.localeCompare(b.name)).map(r => (
                    <SelectItem key={r.id} value={r.name}>{r.name} ({r.campus})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manual Entry (Optional)</Label>
              <Input 
                value={newRoomForSession} 
                onChange={e => setNewRoomForSession(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSession(null)}>Cancel</Button>
            <Button onClick={handleUpdateSessionRoom}>Apply Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Academic Unit</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Unit Name</Label>
              <Input value={newUnitName} onChange={e => setNewUnitName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newUnitType} onValueChange={(v: any) => setNewUnitType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="theory">Theory</SelectItem>
                  <SelectItem value="practical">Practical</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleCreateUnit}>Create Unit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
