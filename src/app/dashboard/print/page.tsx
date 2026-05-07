
"use client"

import React, { useMemo, useState, useRef } from "react"
import { 
  Image as ImageIcon, 
  Filter, 
  DoorOpen, 
  User as UserIcon, 
  BookOpen, 
  Settings2,
  Loader2,
  CalendarDays,
  Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase"
import { collection } from "firebase/firestore"
import { TimetableEntry, Teacher, Unit, Room, Day } from "@/lib/types"
import { CAMPUSES, DAYS } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { toJpeg } from "html-to-image"
import { useToast } from "@/hooks/use-toast"

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
                {selected.length > 1 ? (
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
                id={`print-filter-${label}-${option.value}`} 
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

export default function PrintPage() {
  const { toast } = useToast()
  const db = useFirestore()
  const timetableRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  
  const teachersRef = useMemoFirebase(() => collection(db, "teachers"), [db])
  const unitsRef = useMemoFirebase(() => collection(db, "academicUnits"), [db])
  const roomsRef = useMemoFirebase(() => collection(db, "rooms"), [db])
  const sessionsRef = useMemoFirebase(() => collection(db, "timetables", ACTIVE_TIMETABLE_ID, "classSessions"), [db])
  
  const { data: teachers, isLoading: loadingTeachers } = useCollection<Teacher>(teachersRef)
  const { data: units, isLoading: loadingUnits } = useCollection<Unit>(unitsRef)
  const { data: rooms, isLoading: loadingRooms } = useCollection<Room>(roomsRef)
  const { data: sessions, isLoading: loadingSessions } = useCollection<TimetableEntry>(sessionsRef)

  // Multi-select state
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>([])
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([])
  const [selectedUnits, setSelectedUnits] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const filteredSessions = useMemo(() => {
    if (!sessions) return []
    let data = [...sessions]
    
    if (selectedCampuses.length > 0) {
      data = data.filter(s => {
        const room = rooms?.find(r => r.name === s.room)
        return room && selectedCampuses.includes(room.campus)
      })
    }

    if (selectedTeachers.length > 0) {
      data = data.filter(s => selectedTeachers.includes(s.teacherId))
    }

    if (selectedUnits.length > 0) {
      data = data.filter(s => selectedUnits.includes(s.unitId))
    }

    if (selectedTypes.length > 0) {
      data = data.filter(s => {
        const unit = units?.find(u => u.id === s.unitId)
        return unit && selectedTypes.includes(unit.type)
      })
    }
    
    return data
  }, [sessions, selectedCampuses, selectedTeachers, selectedUnits, selectedTypes, rooms, units])

  const sessionsByDay = useMemo(() => {
    const grouped: Record<string, TimetableEntry[]> = {}
    DAYS.forEach(day => {
      grouped[day] = filteredSessions
        .filter(s => s.day === day)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    })
    return grouped
  }, [filteredSessions])

  const handleDownloadJpg = async () => {
    if (!timetableRef.current) return
    
    setIsDownloading(true)
    try {
      const dataUrl = await toJpeg(timetableRef.current, { 
        quality: 0.95,
        backgroundColor: '#ffffff',
        fontEmbedCSS: '', 
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.download = `Novus_Weekly_Timetable_${new Date().toISOString().split('T')[0]}.jpg`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to download JPG:', err)
      toast({
        variant: "destructive",
        title: "Image Generation Failed",
        description: "A security restriction or external resource prevented the image download. Please try using a different browser or printing to PDF."
      })
    } finally {
      setIsDownloading(false)
    }
  }

  if (loadingTeachers || loadingUnits || loadingRooms || loadingSessions) {
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
          <h2 className="text-3xl font-bold tracking-tight font-headline">Weekly Grid View</h2>
          <p className="text-muted-foreground text-sm">A compact, grid-based weekly timetable optimized for downloading and sharing.</p>
        </div>
        <Button 
          onClick={handleDownloadJpg} 
          variant="default" 
          disabled={isDownloading}
          className="bg-primary hover:bg-primary/90"
        >
          {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download JPG
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-tight">Grid Filters:</span>
        </div>
        
        <MultiSelectFilter 
          label="Sites"
          icon={DoorOpen}
          options={CAMPUSES.map(c => ({ label: c, value: c }))}
          selected={selectedCampuses}
          onChange={setSelectedCampuses}
        />

        <MultiSelectFilter 
          label="Trainers"
          icon={UserIcon}
          options={teachers?.sort((a,b) => a.name.localeCompare(b.name)).map(t => ({ label: t.name, value: t.id })) || []}
          selected={selectedTeachers}
          onChange={setSelectedTeachers}
        />

        <MultiSelectFilter 
          label="Subjects"
          icon={BookOpen}
          options={units?.sort((a,b) => a.name.localeCompare(b.name)).map(u => ({ label: u.name, value: u.id })) || []}
          selected={selectedUnits}
          onChange={setSelectedUnits}
        />

        <MultiSelectFilter 
          label="Modes"
          icon={Settings2}
          options={DELIVERY_MODES}
          selected={selectedTypes}
          onChange={setSelectedTypes}
        />

        {(selectedCampuses.length > 0 || selectedTeachers.length > 0 || selectedUnits.length > 0 || selectedTypes.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-[10px] font-bold uppercase text-primary/60"
            onClick={() => { setSelectedCampuses([]); setSelectedTeachers([]); setSelectedUnits([]); setSelectedTypes([]); }}
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="overflow-x-auto p-4 bg-muted/20 rounded-lg">
        <div 
          ref={timetableRef}
          className="bg-white p-6 rounded-lg border shadow-sm min-w-[1000px] text-black"
        >
          <div className="mb-4 text-center border-b pb-4">
            <h1 className="text-xl font-black uppercase tracking-tighter text-primary">Novus Academic Weekly Timetable</h1>
            <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest mt-0.5">Week of {new Date().toLocaleDateString('en-AU')}</p>
          </div>

          <div className="grid grid-cols-7 border border-gray-300">
            {DAYS.map(day => (
              <div key={day} className="flex flex-col border-r border-gray-300 last:border-r-0">
                <div className="bg-gray-100 border-b border-gray-300 py-2 text-center font-black text-xs uppercase tracking-tight">
                  {day}
                </div>
                <div className="flex-1 bg-gray-50/30 p-1.5 space-y-1 min-h-[600px]">
                  {sessionsByDay[day].map(session => {
                    const unit = units?.find(u => u.id === session.unitId)
                    const teacher = teachers?.find(t => t.id === session.teacherId)
                    
                    let bgColor = "bg-blue-100"
                    if (unit?.type === 'practical') bgColor = "bg-orange-100"
                    if (unit?.type === 'online') bgColor = "bg-green-100"
                    if (unit?.name.includes('ELICOS')) bgColor = "bg-blue-200"
                    if (unit?.name.includes('DCS') || unit?.name.includes('Unit 1')) bgColor = "bg-yellow-100"
                    if (unit?.name.includes('ADCCD')) bgColor = "bg-purple-200"

                    return (
                      <div 
                        key={session.id} 
                        className={cn(
                          "p-1.5 rounded border border-gray-400/50 shadow-sm flex flex-col items-center text-center leading-tight",
                          bgColor
                        )}
                      >
                        <div className="text-[11px] font-black tracking-tight text-gray-900 line-clamp-2">
                          {unit?.name}
                        </div>
                        <div className="text-[10px] font-bold text-gray-800 mt-0.5">
                          {teacher?.name}
                        </div>
                        <div className="text-[9px] font-semibold text-gray-600 mt-0.5 whitespace-nowrap">
                          {session.startTime} - {session.endTime}
                        </div>
                      </div>
                    )
                  })}
                  {sessionsByDay[day].length === 0 && (
                    <div className="h-full flex items-center justify-center opacity-10">
                      <CalendarDays className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t text-[10px] text-muted-foreground flex justify-between items-center">
            <p>Institutional Schedule • Confirmed Room Bookings • Confirmed Trainer Assignments</p>
            <p className="font-bold">Novus Education</p>
          </div>
        </div>
      </div>
    </div>
  )
}
