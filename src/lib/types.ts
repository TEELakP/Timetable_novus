
export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type Campus = 'Ultimo' | 'Gosford' | 'Perth' | 'Online';
export type RoomType = 'Classroom' | 'Workshop';

export interface TeacherAvailability {
  day: Day;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
}

export interface Teacher {
  id: string;
  name: string;
  email?: string;
  availability: TeacherAvailability[];
  qualifiedUnits: string[]; // IDs of units
  campuses: Campus[];
}

export interface Unit {
  id: string;
  name: string;
  type: 'theory' | 'practical' | 'online';
  durationHours: number;
  sessionsPerWeek: number;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  campus: Campus;
  siteName: string; // e.g., 'Main Campus', 'Kitchen', 'Workshop'
  address: string;
  type: RoomType;
}

export interface TimetableEntry {
  id: string; 
  unitId: string;
  teacherId: string;
  day: Day;
  startTime: string;
  endTime: string;
  room: string;
  location: string; // The specific site address/name
  campus: Campus; 
  isConflict?: boolean;
  acknowledged?: boolean;
}

export interface TimetableState {
  teachers: Teacher[];
  units: Unit[];
  rooms: Room[];
  schedulingRules: string[];
  timetable: TimetableEntry[];
}
