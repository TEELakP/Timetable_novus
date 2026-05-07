
import { Teacher, Unit, Day } from './types';

export const INITIAL_TEACHERS: Teacher[] = [
  {
    id: 't1',
    name: 'Dr. Sarah Wilson',
    qualifiedUnits: ['u1', 'u2'],
    availability: [
      { day: 'Monday', startTime: '08:00', endTime: '12:00' },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '08:00', endTime: '12:00' }
    ]
  },
  {
    id: 't2',
    name: 'Prof. James Chen',
    qualifiedUnits: ['u2', 'u3'],
    availability: [
      { day: 'Monday', startTime: '13:00', endTime: '18:00' },
      { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'Friday', startTime: '08:00', endTime: '15:00' }
    ]
  },
  {
    id: 't3',
    name: 'Alice Johnson',
    qualifiedUnits: ['u4'],
    availability: [
      { day: 'Wednesday', startTime: '08:00', endTime: '18:00' },
      { day: 'Friday', startTime: '08:00', endTime: '12:00' }
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
  "Practical units require dedicated laboratory spaces."
];

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const HOURS = Array.from({ length: 11 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);
