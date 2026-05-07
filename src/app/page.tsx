
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Calendar, Users, BookOpen, Settings, Wand2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 h-16 flex items-center border-b bg-card sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Calendar className="h-6 w-6 text-primary" />
          <span className="font-headline tracking-tight">SmartTimetable</span>
        </Link>
        <nav className="ml-auto flex items-center gap-6">
          <Link href="/dashboard/timetable" className="text-sm font-medium hover:text-primary transition-colors">
            Generator
          </Link>
          <Link href="/dashboard/teachers" className="text-sm font-medium hover:text-primary transition-colors">
            Teachers
          </Link>
          <Button asChild variant="default" size="sm">
            <Link href="/dashboard/timetable">Go to Dashboard</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="py-24 px-6 text-center bg-gradient-to-b from-background to-muted/30">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium bg-background/50 backdrop-blur-sm shadow-sm">
              <Wand2 className="h-4 w-4 mr-2 text-primary" />
              <span>AI-Powered Academic Scheduling</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold font-headline tracking-tighter">
              Master Your Academic <br /> <span className="text-primary">Timetable with AI</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Automate complex scheduling, manage teacher availability, and resolve conflicts instantly with our intelligent management system.
            </p>
            <div className="flex flex-wrap justify-center gap-4 pt-4">
              <Button size="lg" className="px-8" asChild>
                <Link href="/dashboard/timetable">Start Generating</Link>
              </Button>
              <Button variant="outline" size="lg" className="px-8">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        <section className="py-24 px-6 max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <Card className="border-none shadow-lg bg-card/50">
            <CardHeader>
              <Users className="h-10 w-10 mb-4 text-blue-500" />
              <CardTitle className="font-headline">Teacher Management</CardTitle>
              <CardDescription>
                Track qualifications and set precise availability blocks for every faculty member.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-none shadow-lg bg-card/50">
            <CardHeader>
              <BookOpen className="h-10 w-10 mb-4 text-orange-500" />
              <CardTitle className="font-headline">Unit Definition</CardTitle>
              <CardDescription>
                Configure theory and practical units with specific durations and session requirements.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-none shadow-lg bg-card/50">
            <CardHeader>
              <Settings className="h-10 w-10 mb-4 text-purple-500" />
              <CardTitle className="font-headline">Rule Engine</CardTitle>
              <CardDescription>
                Define custom scheduling constraints that the AI strictly follows to ensure quality.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      </main>

      <footer className="border-t py-12 px-6 bg-card">
        <div className="max-w-6xl mx-auto flex flex-col md:row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Calendar className="h-5 w-5" />
            <span>SmartTimetable Manager</span>
          </div>
          <p>© 2024 SmartTimetable Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
