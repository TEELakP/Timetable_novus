
import { Campus, Day } from './types';

export const CAMPUSES: Campus[] = ['Ultimo', 'Gosford', 'Perth', 'Online'];

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

// Official institutional address mapping
export const ADDRESS_MAP: Record<string, string> = {
  'Ultimo Campus': 'Level 3, Suite 3.09-3.11 22/36 Mountain St, Ultimo NSW 2007',
  'Gosford Campus': '153 Mann Street, Level 1, Suite 5, Gosford NSW 2250',
  'Perth Campus': 'Unit 53 188 Newcastle St, PERTH WA 6000',
  'Ultimo Kitchen': 'Shop 7/68 Mountain St, Ultimo NSW 2007',
  'Gosford Kitchen': '5/131 Henry Parry Drive, Gosford',
  'Ultimo Workshop (Automotive)': '145 Gilba Road, Girraween NSW',
  'Gosford Workshop': '2/3 Luke Close, west Gosford',
  'Ultimo Workshop (Trade)': '8 Kendall St, Granville NSW'
};

// Configuration for site hierarchy
// This defines the persistent room list for each location
export const SITES_CONFIG = {
  Ultimo: [
    { 
      name: 'Ultimo Campus', 
      address: ADDRESS_MAP['Ultimo Campus'],
      rooms: ['Suite 1', 'Suite 2', 'Suite 3', 'Suite 4', 'Suite 5', 'Suite 6']
    },
    { 
      name: 'Ultimo Kitchen', 
      address: ADDRESS_MAP['Ultimo Kitchen'],
      rooms: ['Kitchen A', 'Kitchen B']
    },
    { 
      name: 'Ultimo Workshop (Automotive)', 
      address: ADDRESS_MAP['Ultimo Workshop (Automotive)'],
      rooms: ['Bay 1', 'Bay 2']
    }
  ],
  Gosford: [
    { 
      name: 'Gosford Campus', 
      address: ADDRESS_MAP['Gosford Campus'],
      rooms: ['A1', 'A2', 'A3', 'A4']
    },
    { 
      name: 'Gosford Kitchen', 
      address: ADDRESS_MAP['Gosford Kitchen'],
      rooms: ['Kitchen 1']
    }
  ],
  Perth: [
    { 
      name: 'Perth Campus', 
      address: ADDRESS_MAP['Perth Campus'],
      rooms: ['P1', 'P2', 'P3', 'P4']
    }
  ],
  Online: [
    { 
      name: 'Virtual Campus', 
      address: 'Remote',
      rooms: ['Virtual Room']
    }
  ]
};

export const INITIAL_RULES: string[] = [
  "Teachers cannot teach two classes simultaneously.",
  "Teachers must be qualified for assigned units.",
  "No overlapping of rooms in the same campus at the same time."
];
