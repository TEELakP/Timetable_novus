
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, Users, BookOpen, Settings, LayoutDashboard, DoorOpen, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  {
    title: "Overview",
    url: "/dashboard/timetable",
    icon: LayoutDashboard,
  },
  {
    title: "Conflicts",
    url: "/dashboard/conflicts",
    icon: AlertTriangle,
  },
  {
    title: "Teachers",
    url: "/dashboard/teachers",
    icon: Users,
  },
  {
    title: "Units",
    url: "/dashboard/units",
    icon: BookOpen,
  },
  {
    title: "Rooms",
    url: "/dashboard/rooms",
    icon: DoorOpen,
  },
  {
    title: "Rules",
    url: "/dashboard/rules",
    icon: Settings,
  },
]

export function NavMain() {
  const pathname = usePathname()

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {items.map((item) => (
        <Link
          key={item.url}
          href={item.url}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
            pathname === item.url ? "bg-muted text-primary" : "text-muted-foreground"
          )}
        >
          <item.icon className={cn("h-4 w-4", item.title === "Conflicts" && pathname !== item.url && "text-destructive")} />
          {item.title}
        </Link>
      ))}
    </nav>
  )
}
