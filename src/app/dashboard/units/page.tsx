
"use client"

import { useState, useMemo } from "react"
import { 
  Plus, 
  BookOpen, 
  Trash2, 
  Loader2, 
  Settings2,
  Filter,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
import { Unit } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  // Deletion state
  const [unitToDelete, setUnitToDelete] = useState<string | null>(null)

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

  const confirmDelete = () => {
    if (!unitToDelete) return
    const unitRef = doc(db, "academicUnits", unitToDelete)
    deleteDocumentNonBlocking(unitRef)
    setUnitToDelete(null)
    toast({ title: "Unit Removed", description: "The academic unit has been deleted." })
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
        <Button onClick={() => setIsSingleOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Unit
        </Button>
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
                  <TableCell className="font-bold">{unit.name}</TableCell>
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

      {/* Deletion Confirmation */}
      <AlertDialog open={!!unitToDelete} onOpenChange={(open) => !open && setUnitToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this academic unit? This will permanently remove the unit definition. 
              Any scheduled sessions for this unit will remain but their subject details may be missing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
