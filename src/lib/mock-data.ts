import { Teacher, Unit, Day, Campus } from './types';

export const CAMPUSES: Campus[] = ['Ultimo', 'Gosford', 'Perth', 'Online'];

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 't1',
    name: 'Dr. Sarah Wilson',
    qualifiedUnits: ['u1', 'u2'],
    campuses: ['Ultimo', 'Online'],
    availability: [
      { day: 'Monday', startTime: '08:00', endTime: '12:00' },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00' }
    ]
  },
  {
    id: 't2',
    name: 'Prof. James Chen',
    qualifiedUnits: ['u2', 'u3'],
    campuses: ['Gosford', 'Perth'],
    availability: [
      { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'Friday', startTime: '08:00', endTime: '15:00' }
    ]
  }
];

export const INITIAL_UNITS: Unit[] = [
  { id: 'u1', name: 'Intro to Algorithms', type: 'theory', durationHours: 2, sessionsPerWeek: 2 },
  { id: 'u2', name: 'Database Systems', type: 'theory', durationHours: 2, sessionsPerWeek: 1 },
  { id: 'u3', name: 'Cloud Infrastructure', type: 'theory', durationHours: 3, sessionsPerWeek: 1 },
  { id: 'u4', name: 'Software Engineering Lab', type: 'practical', durationHours: 4, sessionsPerWeek: 1 }
];

export const INITIAL_RULES: string[] = [
  "Teachers cannot teach two classes simultaneously.",
  "Teachers must be qualified for assigned units.",
  "Maximum of 6 hours of teaching per day for any teacher.",
  "Practical units require dedicated laboratory spaces.",
  "Classes must be scheduled within campus-specific operating hours."
];

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
