
"use client"

import { useState } from "react"
import { 
  Wand2, 
  Download, 
  Share2, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle,
  Info,
  MoreVertical,
  CheckCircle2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DAYS, HOURS, INITIAL_TEACHERS, INITIAL_UNITS, INITIAL_RULES } from "@/lib/mock-data"
import { generateInitialTimetable } from "@/ai/flows/generate-initial-timetable"
import { TimetableEntry } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export default function TimetablePage() {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [conflicts, setConflicts] = useState<string[]>([])
  const { toast } = useToast()

  const handleGenerate = async () => {
    setIsGenerating(true)
    setConflicts([])
    try {
      const result = await generateInitialTimetable({
        teachers: INITIAL_TEACHERS,
        units: INITIAL_UNITS,
        schedulingRules: INITIAL_RULES
      })
      
      const entriesWithIds = result.timetable.map((entry, idx) => ({
        ...entry,
        id: `entry-${idx}`
      }))
      
      setTimetable(entriesWithIds)
      setConflicts(result.conflicts)
      
      if (result.conflicts.length > 0) {
        toast({
          title: "Timetable Generated with Conflicts",
          description: "Check the conflict panel for details.",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Timetable Generated Successfully",
          description: "A conflict-free schedule is now ready.",
        })
      }
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "An error occurred while generating the timetable.",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const getEntryForSlot = (day: string, hour: string) => {
    return timetable.find(entry => entry.day === day && entry.startTime === hour)
  }

  return (
    <div className="flex-1 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Timetable</h2>
          <p className="text-muted-foreground">Manage and visualize your weekly academic schedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating} size="sm">
            {isGenerating ? "Generating..." : (
              <>
                <Wand2 className="mr-2 h-4 w-4" /> Generate
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="overflow-hidden border-none shadow-xl bg-card/40 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="font-semibold">Spring Semester 2024 - Week 12</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-500" /> Theory
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-orange-500" /> Practical
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-[80px_repeat(5,1fr)] min-w-[800px]">
                {/* Header */}
                <div className="h-12 border-b bg-muted/20" />
                {DAYS.map(day => (
                  <div key={day} className="h-12 border-b flex items-center justify-center font-bold text-sm bg-muted/20">
                    {day}
                  </div>
                ))}

                {/* Grid Rows */}
                {HOURS.map(hour => (
                  <div key={hour} className="contents">
                    <div className="h-24 border-b border-r flex items-center justify-center text-xs font-mono text-muted-foreground">
                      {hour}
                    </div>
                    {DAYS.map(day => {
                      const entry = getEntryForSlot(day, hour)
                      const unit = INITIAL_UNITS.find(u => u.id === entry?.unitId)
                      const teacher = INITIAL_TEACHERS.find(t => t.id === entry?.teacherId)
                      
                      return (
                        <div key={`${day}-${hour}`} className="h-24 border-b border-r p-1 relative group bg-background/50">
                          {entry ? (
                            <div 
                              className={cn(
                                "w-full h-full rounded-md p-2 text-white shadow-md transition-all group-hover:scale-[1.02] cursor-pointer overflow-hidden",
                                unit?.type === 'theory' ? "bg-blue-500 hover:bg-blue-600" : "bg-orange-500 hover:bg-orange-600",
                                entry.isConflict && "ring-4 ring-destructive ring-offset-2"
                              )}
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{unit?.type}</span>
                                <MoreVertical className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <p className="text-xs font-bold line-clamp-2 leading-tight mt-0.5">{unit?.name}</p>
                              <div className="mt-auto pt-1 flex flex-col gap-0.5">
                                <p className="text-[10px] opacity-90 truncate">{teacher?.name}</p>
                                <p className="text-[9px] font-mono opacity-80">{entry.room}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-muted">
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <AlertTriangle className={cn("h-5 w-5", conflicts.length > 0 ? "text-destructive" : "text-muted-foreground")} />
                Conflict Monitor
              </CardTitle>
              <CardDescription>Live tracking of schedule integrity.</CardDescription>
            </CardHeader>
            <CardContent>
              {conflicts.length > 0 ? (
                <div className="space-y-3">
                  {conflicts.map((conflict, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive flex gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {conflict}
                    </div>
                  ))}
                  <Button variant="outline" className="w-full text-xs h-8" size="sm">
                    Resolve all with AI
                  </Button>
                </div>
              ) : timetable.length > 0 ? (
                <div className="flex flex-col items-center py-6 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <p className="text-sm font-medium">No conflicts detected</p>
                  <p className="text-xs text-muted-foreground">The generated timetable is 100% efficient.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center space-y-2 text-muted-foreground">
                  <Info className="h-10 w-10 opacity-20" />
                  <p className="text-xs italic">Generate a timetable to start monitoring conflicts.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg border-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="secondary" className="justify-start h-9 text-xs" size="sm">
                <Users className="mr-2 h-4 w-4" /> View Teacher Load
              </Button>
              <Button variant="secondary" className="justify-start h-9 text-xs" size="sm">
                <BookOpen className="mr-2 h-4 w-4" /> Room Assignments
              </Button>
              <Button variant="secondary" className="justify-start h-9 text-xs" size="sm">
                <LayoutDashboard className="mr-2 h-4 w-4" /> Optimize Gaps
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Plus(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

function Users(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function LayoutDashboard(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}
