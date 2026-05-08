
import { Teacher, Unit, Day, Campus, Room, TimetableEntry } from './types';

export const CAMPUSES: Campus[] = ['Ultimo', 'Gosford', 'Perth', 'Online'];

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// Configuration for site hierarchy and addresses
export const SITES_CONFIG = {
  Ultimo: [
    { name: 'Ultimo Campus', address: 'Level 3, 22/36 Mountain St, Ultimo NSW 2007' },
    { name: 'Ultimo Kitchen', address: 'Shop 7/68 Mountain St, Ultimo NSW 2007' },
    { name: 'Ultimo Workshop (Automotive)', address: '145 Gilba Road, Girraween NSW' },
    { name: 'Ultimo Workshop (Trade)', address: '8 Kendall St, Granville NSW' }
  ],
  Gosford: [
    { name: 'Gosford Campus', address: '153 Mann Street, Level 1, Suite 5, Gosford NSW 2250' },
    { name: 'Gosford Kitchen', address: '5/131 Henry Parry Drive, Gosford' },
    { name: 'Gosford Workshop', address: '2/3 Luke Close, West Gosford' }
  ],
  Perth: [
    { name: 'Perth Campus', address: 'Unit 53 188 Newcastle St, PERTH WA 6000' }
  ],
  Online: [
    { name: 'Virtual Campus', address: 'Remote' }
  ]
};

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
