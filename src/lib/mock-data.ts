import { Teacher, Unit, Day, Campus, Room } from './types';

export const CAMPUSES: Campus[] = ['Ultimo', 'Gosford', 'Perth', 'Online'];

export const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export const NOVUS_TRAINERS: Teacher[] = [
  { id: 't-asim', name: 'Asim', qualifiedUnits: ['u-adccd-b2'], campuses: ['Perth'], availability: [] },
  { id: 't-bharath', name: 'Bharath', qualifiedUnits: ['u-dbc', 'u-adccd-b1', 'u-adccd-b2-b3'], campuses: ['Ultimo', 'Online'], availability: [] },
  { id: 't-george', name: 'George', qualifiedUnits: ['u-c3aet-b2'], campuses: ['Ultimo'], availability: [] },
  { id: 't-ghanshyam', name: 'Ghanshyam', qualifiedUnits: ['u-c3aet-b1', 'u-c3lvmt-b1', 'u-c4b', 'u-dam', 'u-dob', 'u-gdm', 'u-adb'], campuses: ['Ultimo', 'Perth', 'Gosford', 'Online'], availability: [] },
  { id: 't-harry', name: 'Harry', qualifiedUnits: ['u-c3bb-b1', 'u-c3pd-b1', 'u-c3wft', 'u-dbc'], campuses: ['Ultimo', 'Online'], availability: [] },
  { id: 't-issa', name: 'Issa', qualifiedUnits: ['u-c3lvmt-b1'], campuses: ['Ultimo'], availability: [] },
  { id: 't-jessy', name: 'Jessy', qualifiedUnits: ['u-adhm', 'u-c4km-b2', 'u-dhm'], campuses: ['Gosford', 'Ultimo'], availability: [] },
  { id: 't-kabir', name: 'Kabir', qualifiedUnits: ['u-c4km-b2'], campuses: ['Ultimo'], availability: [] },
  { id: 't-krunal', name: 'Krunal', qualifiedUnits: ['u-c3aet-b1', 'u-c3lvmt-b2', 'u-dam'], campuses: ['Ultimo'], availability: [] },
  { id: 't-kylie', name: 'Kylie', qualifiedUnits: ['u-elicos-b1'], campuses: ['Ultimo'], availability: [] },
  { id: 't-lakshmee', name: 'Lakshmee', qualifiedUnits: ['u-elicos-b2'], campuses: ['Ultimo'], availability: [] },
  { id: 't-madan', name: 'Madan', qualifiedUnits: ['u-adhm', 'u-adhm-ct', 'u-dhm'], campuses: ['Gosford', 'Ultimo', 'Perth', 'Online'], availability: [] },
  { id: 't-maxine', name: 'Maxine', qualifiedUnits: ['u-adcsm', 'u-adcsm-a', 'u-adcsm-b', 'u-adcsm-ict', 'u-dcs'], campuses: ['Perth', 'Gosford', 'Ultimo', 'Online'], availability: [] },
  { id: 't-meena', name: 'Meena', qualifiedUnits: ['u-adcsm'], campuses: ['Perth'], availability: [] },
  { id: 't-praveen', name: 'Praveen', qualifiedUnits: ['u-c4km-b1'], campuses: ['Ultimo'], availability: [] },
  { id: 't-rebecca', name: 'Rebecca', qualifiedUnits: ['u-dcs'], campuses: ['Ultimo'], availability: [] },
  { id: 't-raihan', name: 'Raihan', qualifiedUnits: ['u-adhm', 'u-adhm-ct', 'u-c4km', 'u-dhm', 'u-gdm'], campuses: ['Perth'], availability: [] },
  { id: 't-sagar', name: 'Sagar', qualifiedUnits: ['u-c4km-b1', 'u-c4km-b2', 'u-c4km', 'u-dhm', 'u-adhm', 'u-gdm'], campuses: ['Ultimo', 'Gosford', 'Perth', 'Online'], availability: [] },
  { id: 't-sajal', name: 'Sajal', qualifiedUnits: ['u-adcsm-b'], campuses: ['Ultimo'], availability: [] },
  { id: 't-sullaiman', name: 'Sullaiman', qualifiedUnits: ['u-c3bb-b1', 'u-c3bb-b2', 'u-c3wft'], campuses: ['Ultimo'], availability: [] },
  { id: 't-sushil', name: 'Sushil', qualifiedUnits: ['u-adb', 'u-dob', 'u-gdm'], campuses: ['Ultimo', 'Gosford'], availability: [] },
  { id: 't-taran', name: 'Taran', qualifiedUnits: ['u-adcsm', 'u-dcs'], campuses: ['Gosford'], availability: [] },
  { id: 't-vikesh', name: 'Vikesh', qualifiedUnits: ['u-c3aet-b1', 'u-c3aet-b2', 'u-c3lvmt-b2'], campuses: ['Ultimo'], availability: [] }
];

export const NOVUS_UNITS: Unit[] = [
  { id: 'u-adccd-b2', name: 'ADCCD B2', type: 'theory', durationHours: 20, sessionsPerWeek: 2 },
  { id: 'u-adccd-b1', name: 'ADCCD B1', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-adccd-b2-b3', name: 'ADCCD B2/B3', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-dbc', name: 'DBC', type: 'theory', durationHours: 20, sessionsPerWeek: 2 },
  { id: 'u-c3aet-b2', name: 'C3AET B2', type: 'practical', durationHours: 15, sessionsPerWeek: 2 },
  { id: 'u-c3aet-b1', name: 'C3AET B1', type: 'practical', durationHours: 15, sessionsPerWeek: 2 },
  { id: 'u-c3lvmt-b1', name: 'C3LVMT B1', type: 'practical', durationHours: 15, sessionsPerWeek: 2 },
  { id: 'u-c3lvmt-b2', name: 'C3LVMT B2', type: 'practical', durationHours: 15, sessionsPerWeek: 2 },
  { id: 'u-c4b', name: 'C4B', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-dam', name: 'DAM', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-dob', name: 'DOB', type: 'theory', durationHours: 20, sessionsPerWeek: 2 },
  { id: 'u-gdm', name: 'GDM', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-adb', name: 'ADB', type: 'theory', durationHours: 20, sessionsPerWeek: 2 },
  { id: 'u-c3bb-b1', name: 'C3BB B1', type: 'practical', durationHours: 15, sessionsPerWeek: 2 },
  { id: 'u-c3bb-b2', name: 'C3BB B2', type: 'practical', durationHours: 15, sessionsPerWeek: 2 },
  { id: 'u-c3pd-b1', name: 'C3PD B1', type: 'practical', durationHours: 15, sessionsPerWeek: 4 },
  { id: 'u-c3pd-b2', name: 'C3PD B2', type: 'practical', durationHours: 15, sessionsPerWeek: 4 },
  { id: 'u-c3wft', name: 'C3WFT', type: 'practical', durationHours: 15, sessionsPerWeek: 2 },
  { id: 'u-adhm', name: 'ADHM', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-adhm-ct', name: 'ADHM CT', type: 'theory', durationHours: 20, sessionsPerWeek: 2 },
  { id: 'u-dhm', name: 'DHM', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-c4km-b1', name: 'C4KM B1', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-c4km-b2', name: 'C4KM B2', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-c4km', name: 'C4KM', type: 'theory', durationHours: 20, sessionsPerWeek: 2 },
  { id: 'u-elicos-b1', name: 'ELICOS B1', type: 'theory', durationHours: 20, sessionsPerWeek: 4 },
  { id: 'u-elicos-b2', name: 'ELICOS B2', type: 'theory', durationHours: 20, sessionsPerWeek: 4 },
  { id: 'u-adcsm', name: 'ADCSM', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-adcsm-a', name: 'ADCSM Group A', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-adcsm-b', name: 'ADCSM Group B', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-adcsm-ict', name: 'ADCSM ICT', type: 'theory', durationHours: 20, sessionsPerWeek: 3 },
  { id: 'u-dcs', name: 'DCS', type: 'theory', durationHours: 20, sessionsPerWeek: 3 }
];

export const NOVUS_ROOMS: Room[] = [
  { id: 'r-p1', name: 'Unit 53 188 Newcastle St PERTH WA 6000', capacity: 30, campus: 'Perth' },
  { id: 'r-online', name: 'Online', capacity: 100, campus: 'Online' },
  { id: 'r-u1', name: 'Level 3, Suite 3.09-3.11 22/36 Mountain St, Ultimo NSW 2007', capacity: 40, campus: 'Ultimo' },
  { id: 'r-gir', name: '145 Gilba Road, Girraween NSW', capacity: 25, campus: 'Ultimo' },
  { id: 'r-gra', name: 'Unit 1A, 8 Kendall St, Granville NSW 2142', capacity: 25, campus: 'Ultimo' },
  { id: 'r-gos1', name: '153 Mann Street, Level 1, Suite 5, Gosford NSW 2250', capacity: 30, campus: 'Gosford' },
  { id: 'r-gos2', name: '5/131 Henry Parry Drive, Gosford', capacity: 25, campus: 'Gosford' },
  { id: 'r-shop', name: 'Shop 7/68 Mountain St, Ultimo NSW 2007', capacity: 20, campus: 'Ultimo' }
];

export const INITIAL_TEACHERS: Teacher[] = NOVUS_TRAINERS;
export const INITIAL_UNITS: Unit[] = NOVUS_UNITS;
export const INITIAL_RULES: string[] = [
  "Teachers cannot teach two classes simultaneously.",
  "Teachers must be qualified for assigned units.",
  "No overlapping of rooms in the same campus at the same time."
];
