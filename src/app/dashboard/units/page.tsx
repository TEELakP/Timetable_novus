
"use client"

import { useState } from "react"
import { 
  Plus, 
  BookOpen, 
  Clock, 
  Layers, 
  Trash2, 
  Edit2, 
  FileText, 
  Loader2,
  Calendar,
  User,
  MapPin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { Unit, TimetableEntry, Teacher } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"

const ACTIVE_TIMETABLE_ID = "default-timetable"

export default function UnitsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])

  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)

  const [bulkInput, setBulkInput] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  
  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [newUnitName, setNewUnitName] = useState("")
  const [newUnitType, setNewUnitType] = useState<'theory' | 'practical'>('theory')
  const [newUnitDuration, setNewUnitDuration] = useState("2")
  const [newUnitSessions, setNewUnitSessions] = useState("1")

  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)

  const handleBulkAdd = () => {
    const lines = bulkInput.split('\n').filter(l => l.trim() !== "")
    lines.forEach((name, idx) => {
      const id = `u-${Date.now()}-${idx}`
      const unitData: Unit = {
        id,
        name: name.trim(),
        type: 'theory',
        durationHours: 2,
        sessionsPerWeek: 1
      }
      setDocumentNonBlocking(doc(db, "academicUnits", id), unitData, { merge: true })
    })
    setBulkInput("")
    setIsBulkOpen(false)
    toast({ title: "Bulk Add Started", description: "Adding units to the catalog..." })
  }

  const handleCreateUnit = () => {
    if (!newUnitName.trim()) return
    const id = `u-${Date.now()}`
    const unitData: Unit = {
      id,
      name: newUnitName.trim(),
      type: newUnitType,
      durationHours: parseInt(newUnitDuration) || 2,
      sessionsPerWeek: parseInt(newUnitSessions) || 1
    }
    setDocumentNonBlocking(doc(db, "academicUnits", id), unitData, { merge: true })
    setNewUnitName("")
    setNewUnitType('theory')
    setNewUnitDuration("2")
    setNewUnitSessions("1")
    setIsSingleOpen(false)
    toast({ title: "Unit Created", description: `${newUnitName} has been added to the catalog.` })
  }

  const handleUpdateUnit = () => {
    if (!editingUnit) return
    setDocumentNonBlocking(doc(db, "academicUnits", editingUnit.id), editingUnit, { merge: true })
    setEditingUnit(null)
    toast({ title: "Unit Updated", description: `${editingUnit.name} has been updated.` })
  }

  const handleDelete = (id: string) => {
    deleteDoc(doc(db, "academicUnits", id))
    toast({ title: "Unit Deleted", description: "The unit has been removed." })
  }

  if (loadingUnits || loadingSessions || loadingTeachers) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Academic Units</h2>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Bulk Add Subjects
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Add Subjects</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Label>Enter subject names (one per line)</Label>
                <Textarea 
                  placeholder="Computer Networks&#10;Machine Learning&#10;Discrete Mathematics" 
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAdd}>Add All Subjects</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Unit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Academic Unit</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-name">Unit Name</Label>
                  <Input 
                    id="unit-name" 
                    placeholder="e.g. Advanced Mathematics" 
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit-type">Type</Label>
                    <Select value={newUnitType} onValueChange={(value: any) => setNewUnitType(value)}>
                      <SelectTrigger id="unit-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="theory">Theory</SelectItem>
                        <SelectItem value="practical">Practical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Total Weekly Hours</Label>
                    <Input 
                      id="duration" 
                      type="number" 
                      min="1" 
                      max="40" 
                      value={newUnitDuration}
                      onChange={(e) => setNewUnitDuration(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessions">Expected Sessions per Week</Label>
                  <Input 
                    id="sessions" 
                    type="number" 
                    min="1" 
                    max="10" 
                    value={newUnitSessions}
                    onChange={(e) => setNewUnitSessions(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateUnit}>Create Unit</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{units?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Theory Hours</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {units?.filter(u => u.type === 'theory').reduce((acc, u) => acc + u.durationHours, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Practical Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {units?.filter(u => u.type === 'practical').reduce((acc, u) => acc + u.durationHours, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Unit Catalog</CardTitle>
          <CardDescription>Click a unit name to view active class sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Unit Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Weekly Total</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units?.map((unit) => {
                  const activeSessions = sessions?.filter(s => s.unitId === unit.id) || []
                  
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="link" className="p-0 h-auto font-bold text-foreground hover:underline decoration-primary underline-offset-4">
                              {unit.name}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-80 p-0 overflow-hidden shadow-2xl border-primary/10">
                            <DropdownMenuLabel className="bg-primary text-primary-foreground p-3 flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              Active Classes: {unit.name}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="m-0" />
                            {activeSessions.length > 0 ? (
                              <div className="max-h-[300px] overflow-y-auto">
                                {activeSessions.map((s) => {
                                  const teacher = teachers?.find(t => t.id === s.teacherId)
                                  return (
                                    <DropdownMenuItem key={s.id} className="flex flex-col items-start gap-1 p-3 border-b last:border-0 hover:bg-muted/50 cursor-default">
                                      <div className="flex items-center gap-2 font-bold text-xs">
                                        <Calendar className="h-3 w-3 text-primary" />
                                        {s.day}, {s.startTime} - {s.endTime}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        Teacher: {teacher?.name || "Unassigned"}
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                        <MapPin className="h-3 w-3" />
                                        Room: {s.room}
                                      </div>
                                    </DropdownMenuItem>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="p-6 text-center text-xs text-muted-foreground italic bg-muted/20">
                                No sessions currently scheduled for this unit.
                              </div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={unit.type === 'theory' ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"}
                        >
                          {unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{unit.durationHours} hrs/week</TableCell>
                      <TableCell>{unit.sessionsPerWeek} sessions</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog open={!!editingUnit && editingUnit.id === unit.id} onOpenChange={(open) => !open && setEditingUnit(null)}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingUnit(unit)}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Academic Unit</DialogTitle>
                              </DialogHeader>
                              {editingUnit && (
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-name">Unit Name</Label>
                                    <Input 
                                      id="edit-name" 
                                      value={editingUnit.name}
                                      onChange={(e) => setEditingUnit({...editingUnit, name: e.target.value})}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-type">Type</Label>
                                      <Select value={editingUnit.type} onValueChange={(value: any) => setEditingUnit({...editingUnit, type: value})}>
                                        <SelectTrigger id="edit-type">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="theory">Theory</SelectItem>
                                          <SelectItem value="practical">Practical</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-duration">Total Weekly Hours</Label>
                                      <Input 
                                        id="edit-duration" 
                                        type="number" 
                                        value={editingUnit.durationHours}
                                        onChange={(e) => setEditingUnit({...editingUnit, durationHours: parseInt(e.target.value) || 0})}
                                      />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-sessions">Sessions per Week</Label>
                                    <Input 
                                      id="edit-sessions" 
                                      type="number" 
                                      value={editingUnit.sessionsPerWeek}
                                      onChange={(e) => setEditingUnit({...editingUnit, sessionsPerWeek: parseInt(e.target.value) || 0})}
                                    />
                                  </div>
                                </div>
                              )}
                              <DialogFooter>
                                <Button onClick={handleUpdateUnit}>Save Changes</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(unit.id)}>
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
        </CardContent>
      </Card>
    </div>
  )
}
