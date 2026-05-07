
"use client"

import { useState } from "react"
import { Plus, BookOpen, Clock, Layers, Trash2, Edit2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { INITIAL_UNITS } from "@/lib/mock-data"
import { Unit } from "@/lib/types"

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS)
  const [bulkInput, setBulkInput] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)

  const handleBulkAdd = () => {
    const lines = bulkInput.split('\n').filter(l => l.trim() !== "")
    const newUnits: Unit[] = lines.map((name, idx) => ({
      id: `u-bulk-${Date.now()}-${idx}`,
      name: name.trim(),
      type: 'theory',
      durationHours: 2,
      sessionsPerWeek: 1
    }))
    setUnits([...units, ...newUnits])
    setBulkInput("")
    setIsBulkOpen(false)
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
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Create Unit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{units.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Theory Hours/Week</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {units.filter(u => u.type === 'theory').reduce((acc, u) => acc + (u.durationHours * u.sessionsPerWeek), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Practical Hours/Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {units.filter(u => u.type === 'practical').reduce((acc, u) => acc + (u.durationHours * u.sessionsPerWeek), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Unit Catalog</CardTitle>
          <CardDescription>Manage your course list and their requirements.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Sessions/Week</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={unit.type === 'theory' ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100" : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"}
                      >
                        {unit.type.charAt(0).toUpperCase() + unit.type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{unit.durationHours} hours</TableCell>
                    <TableCell>{unit.sessionsPerWeek}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Edit2 className="h-4 w-4" />
                        </Button>
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
