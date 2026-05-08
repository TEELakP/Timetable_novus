
import { Teacher, Unit, Day, Campus, Room, TimetableEntry } from './types';

export const CAMPUSES: Campus[] = ['Ultimo', 'Gosford', 'Perth', 'Online'];

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// Official institutional address mapping provided by the user
export const ADDRESS_MAP: Record<string, string> = {
  'Ultimo Campus': 'Level 3, Suite 3.09-3.11 22/36 Mountain St, Ultimo NSW 2007',
  'Gosford Campus': '153 Mann Street, Level 1, Suite 5, Gosford NSW 2250',
  'Ultimo Kitchen': 'Shop 7/68 Mountain St, Ultimo NSW 2007',
  'Gosford Kitchen': '5/131 Henry Parry Drive, Gosford',
  'Ultimo Workshop (Automotive)': '145 Gilba Road, Girraween NSW',
  'Gosford Workshop': '2/3 Luke Close, west Gosford',
  'Ultimo Workshop (Trade)': '8 Kendall St, Granville NSW',
  'Perth': 'Unit 53 188 Newcastle St, PERTH WA 6000'
};

// Configuration for site hierarchy
export const SITES_CONFIG = {
  Ultimo: [
    { name: 'Ultimo Campus', type: 'Classroom', address: ADDRESS_MAP['Ultimo Campus'] },
    { name: 'Ultimo Kitchen', type: 'Workshop', address: ADDRESS_MAP['Ultimo Kitchen'] },
    { name: 'Ultimo Workshop (Automotive)', type: 'Workshop', address: ADDRESS_MAP['Ultimo Workshop (Automotive)'] },
    { name: 'Ultimo Workshop (Trade)', type: 'Workshop', address: ADDRESS_MAP['Ultimo Workshop (Trade)'] }
  ],
  Gosford: [
    { name: 'Gosford Campus', type: 'Classroom', address: ADDRESS_MAP['Gosford Campus'] },
    { name: 'Gosford Kitchen', type: 'Workshop', address: ADDRESS_MAP['Gosford Kitchen'] },
    { name: 'Gosford Workshop', type: 'Workshop', address: ADDRESS_MAP['Gosford Workshop'] }
  ],
  Perth: [
    { name: 'Perth Campus', type: 'Classroom', address: ADDRESS_MAP['Perth'] }
  ],
  Online: [
    { name: 'Virtual Campus', type: 'Classroom', address: 'Remote' }
  ]
};

export const INITIAL_RULES: string[] = [
  "Teachers cannot teach two classes simultaneously.",
  "Teachers must be qualified for assigned units.",
  "No overlapping of rooms in the same campus at the same time."
];
