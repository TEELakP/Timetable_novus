import { config } from 'dotenv';
config();

import '@/ai/flows/generate-initial-timetable.ts';
import '@/ai/flows/suggest-conflict-resolution-flow.ts';