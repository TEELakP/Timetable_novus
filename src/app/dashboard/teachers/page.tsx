
"use client"

import { useState } from "react"
import { Plus, Search, Trash2, Edit2, Users, FileText, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { INITIAL_TEACHERS, INITIAL_UNITS, CAMPUSES } from "@/lib/mock-data"
import { Teacher, Campus } from "@/lib/types"

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(INITIAL_TEACHERS)
  const [bulkInput, setBulkInput] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)

  const handleBulkAdd = () => {
    const names = bulkInput.split('\n').filter(n => n.trim() !== "")
    const newTeachers: Teacher[] = names.map((name, idx) => ({
      id: `t-bulk-${Date.now()}-${idx}`,
      name: name.trim(),
      qualifiedUnits: [],
      campuses: ['Online'],
      availability: []
    }))
    setTeachers([...teachers, ...newTeachers])
    setBulkInput("")
    setIsBulkOpen(false)
  }

  const toggleUnit = (teacher: Teacher, unitId: string) => {
    const qualifiedUnits = teacher.qualifiedUnits.includes(unitId)
      ? teacher.qualifiedUnits.filter(id => id !== unitId)
      : [...teacher.qualifiedUnits, unitId]
    
    updateTeacher({ ...teacher, qualifiedUnits })
  }

  const toggleCampus = (teacher: Teacher, campus: Campus) => {
    const campuses = teacher.campuses.includes(campus)
      ? teacher.campuses.filter(c => c !== campus)
      : [...teacher.campuses, campus]
    
    updateTeacher({ ...teacher, campuses })
  }

  const updateTeacher = (updatedTeacher: Teacher) => {
    setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t))
    if (editingTeacher?.id === updatedTeacher.id) {
      setEditingTeacher(updatedTeacher)
    }
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
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Single Teacher
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Faculty Directory</CardTitle>
          <CardDescription>Manage teacher profiles, qualifications, and campus assignments.</CardDescription>
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {teacher.qualifiedUnits.length > 0 ? teacher.qualifiedUnits.map(unitId => {
                          const unit = INITIAL_UNITS.find(u => u.id === unitId)
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTeacher(teacher)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Edit Profile: {teacher.name}</DialogTitle>
                            </DialogHeader>
                            {editingTeacher && (
                              <div className="grid gap-6 py-4">
                                <div className="space-y-4">
                                  <h4 className="text-sm font-semibold">Qualified Units</h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    {INITIAL_UNITS.map(unit => (
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
                                  <h4 className="text-sm font-semibold">Campus Assignment</h4>
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
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
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
