
import { Teacher, Unit, Day, Campus, Room, TimetableEntry } from './types';

export const CAMPUSES: Campus[] = ['Ultimo', 'Gosford', 'Perth', 'Online'];

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export const NOVUS_TRAINERS: Teacher[] = [];
export const NOVUS_UNITS: Unit[] = [];
export const NOVUS_ROOMS: Room[] = [];
export const NOVUS_SCHEDULE_RAW: Partial<TimetableEntry>[] = [];

export const INITIAL_TEACHERS: Teacher[] = NOVUS_TRAINERS;
export const INITIAL_UNITS: Unit[] = NOVUS_UNITS;
export const INITIAL_RULES: string[] = [
  "Teachers cannot teach two classes simultaneously.",
  "Teachers must be qualified for assigned units.",
  "No overlapping of rooms in the same campus at the same time."
];
