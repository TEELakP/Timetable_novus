
"use client"

import { useState } from "react"
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Loader2, 
  Building2,
  Users,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { CAMPUSES } from "@/lib/mock-data"
import { Room, Campus } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc, deleteDoc } from "firebase/firestore"
import { setDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function RoomsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const { data: rooms, isLoading } = useCollection<Room>(roomsRef)

  const [bulkInput, setBulkInput] = useState("")
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  
  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState("")
  const [newRoomCapacity, setNewRoomCapacity] = useState("30")
  const [newRoomCampus, setNewRoomCampus] = useState<Campus>('Online')

  const [editingRoom, setEditingRoom] = useState<Room | null>(null)

  const handleBulkAdd = () => {
    const names = bulkInput.split('\n').filter(n => n.trim() !== "")
    names.forEach((name, idx) => {
      const id = `r-${Date.now()}-${idx}`
      const roomData: Room = {
        id,
        name: name.trim(),
        capacity: 30,
        campus: 'Online'
      }
      setDocumentNonBlocking(doc(db, "rooms", id), roomData, { merge: true })
    })
    setBulkInput("")
    setIsBulkOpen(false)
    toast({ title: "Bulk Add Started", description: `Adding ${names.length} rooms...` })
  }

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) return
    const id = `r-${Date.now()}`
    const roomData: Room = {
      id,
      name: newRoomName.trim(),
      capacity: parseInt(newRoomCapacity) || 30,
      campus: newRoomCampus
    }
    setDocumentNonBlocking(doc(db, "rooms", id), roomData, { merge: true })
    setNewRoomName("")
    setNewRoomCapacity("30")
    setNewRoomCampus('Online')
    setIsSingleOpen(false)
    toast({ title: "Room Created", description: `${newRoomName} has been added.` })
  }

  const handleUpdateRoom = () => {
    if (!editingRoom) return
    setDocumentNonBlocking(doc(db, "rooms", editingRoom.id), editingRoom, { merge: true })
    setEditingRoom(null)
    toast({ title: "Room Updated", description: `${editingRoom.name} updated.` })
  }

  const handleDelete = (id: string) => {
    deleteDoc(doc(db, "rooms", id))
    toast({ title: "Room Deleted", description: "The room has been removed." })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Rooms</h2>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Bulk Add Names
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Add Rooms</DialogTitle>
                <DialogDescription>Add multiple room names at once. Defaults will be applied.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Label>Enter room names (one per line)</Label>
                <Textarea 
                  placeholder="Room 101&#10;Computer Lab A&#10;Lecture Theatre 1" 
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
              <DialogFooter>
                <Button onClick={handleBulkAdd}>Add All Rooms</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Room
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Room</DialogTitle>
                <DialogDescription>Define a new space for academic activities.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="room-name">Room Name</Label>
                  <Input 
                    id="room-name" 
                    placeholder="e.g. Room 402" 
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input 
                      id="capacity" 
                      type="number" 
                      value={newRoomCapacity}
                      onChange={(e) => setNewRoomCapacity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campus">Campus</Label>
                    <Select value={newRoomCampus} onValueChange={(v: Campus) => setNewRoomCampus(v)}>
                      <SelectTrigger id="campus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateRoom}>Save Room</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rooms?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rooms?.reduce((acc, r) => acc + (r.capacity || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Room Directory</CardTitle>
          <CardDescription>View and manage all available teaching spaces.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Room Name</TableHead>
                  <TableHead>Campus</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rooms?.map((room) => (
                  <TableRow key={room.id}>
                    <TableCell className="font-semibold">{room.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                        {room.campus}
                      </Badge>
                    </TableCell>
                    <TableCell>{room.capacity} students</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={!!editingRoom && editingRoom.id === room.id} onOpenChange={(open) => !open && setEditingRoom(null)}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingRoom(room)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Room</DialogTitle>
                            </DialogHeader>
                            {editingRoom && (
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-name">Room Name</Label>
                                  <Input 
                                    id="edit-name" 
                                    value={editingRoom.name}
                                    onChange={(e) => setEditingRoom({...editingRoom, name: e.target.value})}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-capacity">Capacity</Label>
                                    <Input 
                                      id="edit-capacity" 
                                      type="number" 
                                      value={editingRoom.capacity}
                                      onChange={(e) => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value) || 0})}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-campus">Campus</Label>
                                    <Select value={editingRoom.campus} onValueChange={(v: Campus) => setEditingRoom({...editingRoom, campus: v})}>
                                      <SelectTrigger id="edit-campus">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button onClick={handleUpdateRoom}>Save Changes</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(room.id)}>
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
