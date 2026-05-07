
"use client"

import { useState } from "react"
import { Plus, Search, Trash2, Edit2, Users, FileText, Loader2, Calendar as CalendarIcon, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CAMPUSES, DAYS } from "@/lib/mock-data"
import { Teacher, Campus, Day } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function TeachersPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units } = useCollection<any>(unitsRef)

  const [bulkInput, setBulkInput] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  
  const [newTeacherName, setNewTeacherName] = useState("")

  // New Availability State for UI
  const [newAvailDay, setNewAvailDay] = useState<Day>('Monday')
  const [newAvailStart, setNewAvailStart] = useState("09:00")
  const [newAvailEnd, setNewAvailEnd] = useState("17:00")

  const handleBulkAdd = () => {
    const names = bulkInput.split('\n').filter(n => n.trim() !== "")
    names.forEach((name, idx) => {
      const id = `t-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
      const teacherData: Teacher = {
        id,
        name: name.trim(),
        qualifiedUnits: [],
        campuses: ['Online'],
        availability: []
      }
      setDocumentNonBlocking(doc(db, "teachers", id), teacherData, { merge: true })
    })
    setBulkInput("")
    setIsBulkOpen(false)
    toast({ title: "Bulk Add Started", description: `Adding ${names.length} teachers...` })
  }

  const handleSingleAdd = () => {
    if (!newTeacherName.trim()) return
    const id = `t-${Date.now()}`
    const teacherData: Teacher = {
      id,
      name: newTeacherName.trim(),
      qualifiedUnits: [],
      campuses: ['Online'],
      availability: []
    }
    setDocumentNonBlocking(doc(db, "teachers", id), teacherData, { merge: true })
    setNewTeacherName("")
    setIsSingleOpen(false)
    toast({ title: "Teacher Added", description: `${newTeacherName} has been created.` })
  }

  const handleDelete = (id: string) => {
    const docRef = doc(db, "teachers", id)
    deleteDoc(docRef).catch(() => {
       toast({ variant: "destructive", title: "Delete Failed", description: "Could not remove teacher." })
    })
  }

  const toggleUnit = (teacher: Teacher, unitId: string) => {
    const qualifiedUnits = teacher.qualifiedUnits.includes(unitId)
      ? teacher.qualifiedUnits.filter(id => id !== unitId)
      : [...teacher.qualifiedUnits, unitId]
    
    const updated = { ...teacher, qualifiedUnits }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", teacher.id), updated, { merge: true })
  }

  const toggleCampus = (teacher: Teacher, campus: Campus) => {
    const campuses = teacher.campuses.includes(campus)
      ? teacher.campuses.filter(c => c !== campus)
      : [...teacher.campuses, campus]
    
    const updated = { ...teacher, campuses }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", teacher.id), updated, { merge: true })
  }

  const addAvailability = () => {
    if (!editingTeacher) return
    const newSlot = { day: newAvailDay, startTime: newAvailStart, endTime: newAvailEnd }
    const availability = [...(editingTeacher.availability || []), newSlot]
    const updated = { ...editingTeacher, availability }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", editingTeacher.id), updated, { merge: true })
  }

  const removeAvailability = (index: number) => {
    if (!editingTeacher) return
    const availability = editingTeacher.availability.filter((_, i) => i !== index)
    const updated = { ...editingTeacher, availability }
    setEditingTeacher(updated)
    setDocumentNonBlocking(doc(db, "teachers", editingTeacher.id), updated, { merge: true })
  }

  if (loadingTeachers) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Teachers</h2>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Bulk Add Names
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Add Teachers</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Label>Enter teacher names (one per line)</Label>
                <Textarea 
                  placeholder="John Doe&#10;Jane Smith&#10;Dr. Alan Grant" 
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAdd}>Add All Teachers</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Single Teacher
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Teacher</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Dr. Sarah Wilson" 
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSingleAdd}>Create Teacher</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Faculty Directory</CardTitle>
          <CardDescription>Manage teacher profiles, qualifications, and availability.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center py-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by name..." className="pl-8" />
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Qualified Units</TableHead>
                  <TableHead>Campuses</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers?.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {teacher.qualifiedUnits.length > 0 ? teacher.qualifiedUnits.map(unitId => {
                          const unit = units?.find(u => u.id === unitId)
                          return (
                            <Badge key={unitId} variant="secondary" className="text-[10px]">
                              {unit?.name || unitId}
                            </Badge>
                          )
                        }) : <span className="text-xs text-muted-foreground">None assigned</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {teacher.campuses.map(campus => (
                          <Badge key={campus} variant="outline" className="text-[10px]">
                            {campus}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                         {teacher.availability?.length > 0 ? teacher.availability.slice(0, 2).map((slot, i) => (
                            <span key={i} className="text-[10px] text-muted-foreground">
                               {slot.day.substring(0, 3)} {slot.startTime}-{slot.endTime}
                            </span>
                         )) : <span className="text-[10px] text-muted-foreground">None set</span>}
                         {teacher.availability?.length > 2 && <span className="text-[10px] font-bold">+{teacher.availability.length - 2} more</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTeacher(teacher)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Profile: {teacher.name}</DialogTitle>
                            </DialogHeader>
                            {editingTeacher && (
                              <div className="grid gap-6 py-4">
                                <div className="space-y-4">
                                  <h4 className="text-sm font-semibold border-b pb-2">Qualified Units</h4>
                                  <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto p-1">
                                    {units?.map(unit => (
                                      <div key={unit.id} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`unit-${unit.id}`} 
                                          checked={editingTeacher.qualifiedUnits.includes(unit.id)}
                                          onCheckedChange={() => toggleUnit(editingTeacher, unit.id)}
                                        />
                                        <Label htmlFor={`unit-${unit.id}`} className="text-xs">{unit.name}</Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <h4 className="text-sm font-semibold border-b pb-2">Campus Assignment</h4>
                                  <div className="flex gap-4">
                                    {CAMPUSES.map(campus => (
                                      <div key={campus} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`campus-${campus}`} 
                                          checked={editingTeacher.campuses.includes(campus)}
                                          onCheckedChange={() => toggleCampus(editingTeacher, campus)}
                                        />
                                        <Label htmlFor={`campus-${campus}`} className="text-xs">{campus}</Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <h4 className="text-sm font-semibold border-b pb-2">Availability (Days & Timeframe)</h4>
                                  <div className="grid grid-cols-4 gap-2 items-end">
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Day</Label>
                                      <Select value={newAvailDay} onValueChange={(v: Day) => setNewAvailDay(v)}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {DAYS.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Start</Label>
                                      <Input type="time" className="h-8 text-xs" value={newAvailStart} onChange={e => setNewAvailStart(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">End</Label>
                                      <Input type="time" className="h-8 text-xs" value={newAvailEnd} onChange={e => setNewAvailEnd(e.target.value)} />
                                    </div>
                                    <Button size="sm" className="h-8" onClick={addAvailability}>Add Slot</Button>
                                  </div>

                                  <div className="space-y-2">
                                     {editingTeacher.availability?.map((slot, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted text-xs">
                                           <div className="flex items-center gap-2">
                                              <CalendarIcon className="h-3 w-3" />
                                              <span className="font-bold">{slot.day}</span>
                                              <Clock className="h-3 w-3 ml-2" />
                                              <span>{slot.startTime} - {slot.endTime}</span>
                                           </div>
                                           <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeAvailability(idx)}>
                                              <X className="h-3 w-3" />
                                           </Button>
                                        </div>
                                     ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(teacher.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
