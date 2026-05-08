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
  Info,
  ChevronRight,
  Filter,
  GraduationCap,
  Hammer
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
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
import { Room, Campus, RoomType } from "@/lib/types"
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

  // Filters
  const [activeCampus, setActiveCampus] = useState<Campus | 'All'>('All')
  const [activeType, setActiveType] = useState<RoomType | 'All'>('All')

  // Dialog States
  const [isSingleOpen, setIsSingleOpen] = useState(false)
  const [newRoom, setNewRoom] = useState<Partial<Room>>({
    name: "",
    capacity: 30,
    campus: 'Ultimo',
    siteName: SITES_CONFIG.Ultimo[0].name,
    type: 'Classroom'
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
      address: site?.address || "",
      type: (site?.type as RoomType) || 'Classroom'
    }
    
    setDocumentNonBlocking(doc(db, "rooms", id), roomData, { merge: true })
    setNewRoom({ name: "", capacity: 30, campus: 'Ultimo', siteName: SITES_CONFIG.Ultimo[0].name, type: 'Classroom' })
    setIsSingleOpen(false)
    toast({ title: "Room Created", description: `${newRoom.name} added to directory.` })
  }

  const handleUpdateRoom = () => {
    if (!editingRoom) return
    const site = SITES_CONFIG[editingRoom.campus as Campus]?.find(s => s.name === editingRoom.siteName)
    const updatedRoom = { 
      ...editingRoom, 
      address: site?.address || "",
      type: (site?.type as RoomType) || 'Classroom'
    }
    
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

  const filteredRooms = useMemo(() => {
    if (!rooms) return []
    return rooms.filter(room => {
      const matchCampus = activeCampus === 'All' || room.campus === activeCampus
      const matchType = activeType === 'All' || room.type === activeType
      return matchCampus && matchType
    })
  }, [rooms, activeCampus, activeType])

  const groupedRooms = useMemo(() => {
    const groups: Record<string, Record<string, Room[]>> = {}
    
    filteredRooms.forEach(room => {
      if (!groups[room.campus]) groups[room.campus] = {}
      if (!groups[room.campus][room.type]) groups[room.campus][room.type] = []
      groups[room.campus][room.type].push(room)
    })
    
    return groups
  }, [filteredRooms])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline text-primary">Institutional Hierarchy</h2>
          <p className="text-muted-foreground text-sm">City &gt; Category &gt; Classroom/Workshop Locations</p>
        </div>
        <Button onClick={() => setIsSingleOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Add Room/Location
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-muted/30 p-4 rounded-xl border">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-xs font-black uppercase tracking-tight">Filters:</span>
        </div>
        
        <Select value={activeCampus} onValueChange={(v: any) => setActiveCampus(v)}>
          <SelectTrigger className="w-[180px] h-9 bg-background">
            <SelectValue placeholder="All Campuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Cities</SelectItem>
            {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={activeType} onValueChange={(v: any) => setActiveType(v)}>
          <SelectTrigger className="w-[180px] h-9 bg-background">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Categories</SelectItem>
            <SelectItem value="Classroom">Theory Classrooms</SelectItem>
            <SelectItem value="Workshop">Workshops & Kitchens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-12">
        {CAMPUSES.filter(campus => activeCampus === 'All' || activeCampus === campus).map(campus => {
          const campusData = groupedRooms[campus]
          if (!campusData && activeCampus !== 'All') return null
          if (!campusData) return null

          return (
            <div key={campus} className="space-y-6">
              <div className="flex items-center gap-3 border-b-2 border-primary pb-2">
                <Badge className="bg-primary text-white font-black text-sm uppercase px-4 py-1.5">{campus}</Badge>
                <span className="text-xs text-muted-foreground font-black uppercase tracking-widest">Network Node</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Classroom Section */}
                <Card className={cn("border-none shadow-sm", !campusData.Classroom && "opacity-40")}>
                  <CardHeader className="bg-blue-50/50 border-b flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-blue-800">
                        <GraduationCap className="h-4 w-4" /> Theory Classrooms
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase font-bold text-blue-600/70">Academic Learning Spaces</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {campusData.Classroom ? (
                      <Table>
                        <TableHeader className="bg-blue-50/20">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Suite/Room Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Address Snapshot</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campusData.Classroom.map((room) => (
                            <TableRow key={room.id} className="group hover:bg-blue-50/30">
                              <TableCell className="font-black text-xs">{room.name}</TableCell>
                              <TableCell className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">{room.address}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoom(room)}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setRoomToDelete(room.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground italic">No classroom spaces defined for {campus}.</div>
                    )}
                  </CardContent>
                </Card>

                {/* Workshop Section */}
                <Card className={cn("border-none shadow-sm", !campusData.Workshop && "opacity-40")}>
                  <CardHeader className="bg-orange-50/50 border-b flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-orange-800">
                        <Hammer className="h-4 w-4" /> Workshops & Kitchens
                      </CardTitle>
                      <CardDescription className="text-[10px] uppercase font-bold text-orange-600/70">Practical Delivery Sites</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {campusData.Workshop ? (
                      <Table>
                        <TableHeader className="bg-orange-50/20">
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase">Location Name</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Full Site Address</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campusData.Workshop.map((room) => (
                            <TableRow key={room.id} className="group hover:bg-orange-50/30">
                              <TableCell className="font-black text-xs">{room.name}</TableCell>
                              <TableCell className="text-[10px] text-muted-foreground font-medium">{room.address}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRoom(room)}>
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setRoomToDelete(room.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="py-12 text-center text-xs text-muted-foreground italic">No practical spaces defined for {campus}.</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Room Dialog */}
      <Dialog open={isSingleOpen} onOpenChange={setIsSingleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Institutional Space</DialogTitle>
            <DialogDescription>Define a new teaching space within the network hierarchy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City / Campus</Label>
                <Select 
                  value={newRoom.campus} 
                  onValueChange={(v: Campus) => {
                    const firstSite = SITES_CONFIG[v][0]
                    setNewRoom({...newRoom, campus: v, siteName: firstSite.name, type: firstSite.type as RoomType})
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Specific Site Category</Label>
                <Select 
                  value={newRoom.siteName} 
                  onValueChange={(v) => {
                    const site = SITES_CONFIG[newRoom.campus as Campus].find(s => s.name === v)
                    setNewRoom({...newRoom, siteName: v, type: site?.type as RoomType})
                  }}
                >
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
              <Label>{newRoom.type === 'Classroom' ? 'Classroom Name (e.g., Suite 3.09)' : 'Location Identifier'}</Label>
              <Input 
                placeholder={newRoom.type === 'Classroom' ? "e.g. Suite 3.10" : "e.g. Workshop Area A"} 
                value={newRoom.name}
                onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Student Capacity</Label>
              <Input 
                type="number" 
                value={newRoom.capacity}
                onChange={(e) => setNewRoom({...newRoom, capacity: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="bg-muted/50 p-3 rounded-lg border border-dashed">
               <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Assigned Address:</p>
               <p className="text-[11px] font-medium">
                 {SITES_CONFIG[newRoom.campus as Campus]?.find(s => s.name === newRoom.siteName)?.address || 'Automatic based on site'}
               </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateRoom} disabled={!newRoom.name}>Confirm Space Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Room Dialog */}
      <Dialog open={!!editingRoom} onOpenChange={(open) => !open && setEditingRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Space Parameters</DialogTitle>
          </DialogHeader>
          {editingRoom && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select 
                    value={editingRoom.campus} 
                    onValueChange={(v: Campus) => {
                      const site = SITES_CONFIG[v][0]
                      setEditingRoom({...editingRoom, campus: v, siteName: site.name, type: site.type as RoomType})
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMPUSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Site Category</Label>
                  <Select 
                    value={editingRoom.siteName} 
                    onValueChange={(v) => {
                      const site = SITES_CONFIG[editingRoom.campus as Campus].find(s => s.name === v)
                      setEditingRoom({...editingRoom, siteName: v, type: site?.type as RoomType})
                    }}
                  >
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
                <Label>Room/Location Name</Label>
                <Input value={editingRoom.name} onChange={(e) => setEditingRoom({...editingRoom, name: e.target.value})} />
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
              Remove Location
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this space from the institutional hierarchy. All sessions linked to this location will lose their physical assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white">Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
