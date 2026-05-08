
"use client"

import { useState, useMemo } from "react"
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  Loader2, 
  Building2,
  Users,
  MapPin,
  AlertTriangle,
  Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
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
import { CAMPUSES, SITES_CONFIG } from "@/lib/mock-data"
import { Room, Campus } from "@/lib/types"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection, doc } from "firebase/firestore"
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export default function RoomsPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const { data: rooms, isLoading } = useCollection<Room>(roomsRef)

  // Dialog States
  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [newRoom, setNewRoom] = useState<Partial<Room>>({
    name: "",
    capacity: 30,
    campus: 'Ultimo',
    siteName: 'Ultimo Campus'
  })

  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null)

  const handleCreateRoom = () => {
    if (!newRoom.name || !newRoom.campus || !newRoom.siteName) return
    
    const id = `r-${Date.now()}`
    const site = SITES_CONFIG[newRoom.campus as Campus]?.find(s => s.name === newRoom.siteName)
    
    const roomData: Room = {
      id,
      name: newRoom.name,
      capacity: newRoom.capacity || 30,
      campus: newRoom.campus as Campus,
      siteName: newRoom.siteName,
      address: site?.address || ""
    }
    
    setDocumentNonBlocking(doc(db, "rooms", id), roomData, { merge: true })
    setNewRoom({ name: "", capacity: 30, campus: 'Ultimo', siteName: 'Ultimo Campus' })
    setIsSingleOpen(false)
    toast({ title: "Room Created", description: `${newRoom.name} added to ${newRoom.siteName}.` })
  }

  const handleUpdateRoom = () => {
    if (!editingRoom) return
    const site = SITES_CONFIG[editingRoom.campus as Campus]?.find(s => s.name === editingRoom.siteName)
    const updatedRoom = { ...editingRoom, address: site?.address || "" }
    
    setDocumentNonBlocking(doc(db, "rooms", editingRoom.id), updatedRoom, { merge: true })
    setEditingRoom(null)
    toast({ title: "Room Updated" })
  }

  const confirmDelete = () => {
    if (!roomToDelete) return
    deleteDocumentNonBlocking(doc(db, "rooms", roomToDelete))
    setRoomToDelete(null)
    toast({ title: "Room Deleted" })
  }

  // Group rooms by Campus and Site for the hierarchy view
  const groupedRooms = useMemo(() => {
    if (!rooms) return {}
    const groups: Record<string, Record<string, Room[]>> = {}
    
    rooms.forEach(room => {
      if (!groups[room.campus]) groups[room.campus] = {}
      if (!groups[room.campus][room.siteName]) groups[room.campus][room.siteName] = []
      groups[room.campus][room.siteName].push(room)
    })
    
    return groups
  }, [rooms])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline text-primary">Location Management</h2>
          <p className="text-muted-foreground text-sm">Organize physical teaching spaces across campuses, kitchens, and workshops.</p>
        </div>
        <Button onClick={() => setIsSingleOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Classroom
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary/70">Total Classrooms</CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{rooms?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary/70">Campus Presence</CardTitle>
            <MapPin className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{Object.keys(groupedRooms).length} Sites</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-primary/70">Global Capacity</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">
              {rooms?.reduce((acc, r) => acc + (r.capacity || 0), 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        {CAMPUSES.filter(c => groupedRooms[c]).map(campus => (
          <div key={campus} className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
               <Badge variant="default" className="bg-primary text-white font-black text-[10px] uppercase px-3 py-1">{campus}</Badge>
               <span className="text-xs text-muted-foreground font-medium uppercase tracking-tight">Campus Network</span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {Object.entries(groupedRooms[campus] || {}).map(([siteName, siteRooms]) => (
                <Card key={siteName} className="border-none shadow-sm overflow-hidden bg-muted/20">
                  <div className="bg-muted/50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-2 border-b">
                    <div>
                      <h3 className="font-black text-sm uppercase tracking-tight text-primary">{siteName}</h3>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                        <MapPin className="h-2.5 w-2.5" />
                        {siteRooms[0]?.address || 'No address defined'}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold bg-background">{siteRooms.length} Rooms</Badge>
                  </div>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] uppercase font-black py-2">Room / Suite</TableHead>
                          <TableHead className="text-[10px] uppercase font-black py-2">Capacity</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black py-2">Management</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siteRooms.sort((a,b) => a.name.localeCompare(b.name)).map((room) => (
                          <TableRow key={room.id} className="hover:bg-background/50 border-muted/50">
                            <TableCell className="font-bold text-xs py-3">{room.name}</TableCell>
                            <TableCell className="text-xs font-medium py-3 text-muted-foreground">{room.capacity} Students</TableCell>
                            <TableCell className="text-right py-3">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoom(room)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setRoomToDelete(room.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {rooms?.length === 0 && (
          <div className="py-24 text-center space-y-4 border-2 border-dashed rounded-xl">
            <Building2 className="h-12 w-12 mx-auto opacity-20" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold">No Rooms Defined</h3>
              <p className="text-sm text-muted-foreground">Start by adding your institutional locations.</p>
            </div>
            <Button onClick={() => setIsSingleOpen(true)}>Add First Room</Button>
          </div>
        )}
      </div>

      {/* Create Room Dialog */}
      <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Classroom Entry</DialogTitle>
            <DialogDescription>Assign a classroom to a specific campus and site.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Room / Suite Name</Label>
              <Input 
                placeholder="e.g. Suite 3.09" 
                value={newRoom.name}
                onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campus</Label>
                <Select value={newRoom.campus} onValueChange={(v: Campus) => setNewRoom({...newRoom, campus: v, siteName: SITES_CONFIG[v][0]?.name || ""})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Specific Site</Label>
                <Select value={newRoom.siteName} onValueChange={(v) => setNewRoom({...newRoom, siteName: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SITES_CONFIG[newRoom.campus as Campus]?.map(site => (
                      <SelectItem key={site.name} value={site.name}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Student Capacity</Label>
              <Input 
                type="number" 
                value={newRoom.capacity}
                onChange={(e) => setNewRoom({...newRoom, capacity: parseInt(e.target.value) || 0})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateRoom} disabled={!newRoom.name}>Save Classroom</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location Details</DialogTitle>
          </DialogHeader>
          {editingRoom && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Room Name</Label>
                <Input value={editingRoom.name} onChange={(e) => setEditingRoom({...editingRoom, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campus</Label>
                  <Select value={editingRoom.campus} onValueChange={(v: Campus) => setEditingRoom({...editingRoom, campus: v, siteName: SITES_CONFIG[v][0]?.name || ""})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Specific Site</Label>
                  <Select value={editingRoom.siteName} onValueChange={(v) => setEditingRoom({...editingRoom, siteName: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SITES_CONFIG[editingRoom.campus as Campus]?.map(site => (
                        <SelectItem key={site.name} value={site.name}>{site.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input type="number" value={editingRoom.capacity} onChange={(e) => setEditingRoom({...editingRoom, capacity: parseInt(e.target.value) || 0})} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleUpdateRoom}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion Confirmation */}
      <AlertDialog open={!!roomToDelete} onOpenChange={(open) => !open && setRoomToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this classroom? Sessions scheduled here will remain but will lose their linked location.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
