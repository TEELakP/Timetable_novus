
export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type Campus = 'Ultimo' | 'Gosford' | 'Perth' | 'Online';

export interface TeacherAvailability {
  day: Day;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface Teacher {
  id: string;
  name: string;
  availability: TeacherAvailability[];
  qualifiedUnits: string[]; // IDs of units
  campuses: Campus[];
}

export interface Unit {
  id: string;
  name: string;
  type: 'theory' | 'practical';
  durationHours: number;
  sessionsPerWeek: number;
}

export interface TimetableEntry {
  id: string; // Internal id for tracking UI
  unitId: string;
  teacherId: string;
  day: Day;
  startTime: string;
  endTime: string;
  room: string;
  isConflict?: boolean;
}

export interface TimetableState {
  teachers: Teacher[];
  units: Unit[];
  schedulingRules: string[];
  timetable: TimetableEntry[];
}
