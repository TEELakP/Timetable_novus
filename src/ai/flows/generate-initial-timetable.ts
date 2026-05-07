
'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating an initial conflict-free timetable.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schemas
const TeacherAvailabilitySlotSchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
});

const TeacherSchema = z.object({
  id: z.string(),
  name: z.string(),
  availability: z.array(TeacherAvailabilitySlotSchema),
  qualifiedUnits: z.array(z.string()),
  campuses: z.array(z.enum(['Ultimo', 'Gosford', 'Perth', 'Online'])),
});

const UnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['theory', 'practical']),
  durationHours: z.number().describe('Total hours per week required for this unit.'),
  sessionsPerWeek: z.number().int().min(1).describe('Number of sessions to divide the weekly hours into.'),
});

const GenerateInitialTimetableInputSchema = z.object({
  teachers: z.array(TeacherSchema),
  units: z.array(UnitSchema),
  schedulingRules: z.array(z.string()),
});
export type GenerateInitialTimetableInput = z.infer<typeof GenerateInitialTimetableInputSchema>;

// Output Schemas
const TimetableEntrySchema = z.object({
  unitId: z.string(),
  teacherId: z.string(),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  room: z.string(),
});

const GenerateInitialTimetableOutputSchema = z.object({
  timetable: z.array(TimetableEntrySchema),
  conflicts: z.array(z.string()),
});
export type GenerateInitialTimetableOutput = z.infer<typeof GenerateInitialTimetableOutputSchema>;

const generateTimetablePrompt = ai.definePrompt({
  name: 'generateInitialTimetablePrompt',
  input: { schema: GenerateInitialTimetableInputSchema },
  output: { schema: GenerateInitialTimetableOutputSchema },
  prompt: `You are an expert timetable generator. Your task is to divide weekly academic unit requirements into specific daily sessions.

**Constraint Rules:**
1. Units have a 'durationHours' which represents the TOTAL hours per week.
2. Units have 'sessionsPerWeek'. You must split the total hours across exactly this many sessions.
3. For example, if 'durationHours' is 4 and 'sessionsPerWeek' is 2, you must create two 2-hour sessions on different days.
4. Teachers have 'availability' blocks and 'qualifiedUnits'.
5. No teacher or room can be double-booked at the same time on the same day.

**Data:**
Teachers: {{{JSON.stringify teachers}}}
Units: {{{JSON.stringify units}}}
Rules: {{#each schedulingRules}}- {{{this}}}{{/each}}

Generate a valid JSON object matching the schema for a complete 7-day schedule.`,
});

const generateInitialTimetableFlow = ai.defineFlow(
  {
    name: 'generateInitialTimetableFlow',
    inputSchema: GenerateInitialTimetableInputSchema,
    outputSchema: GenerateInitialTimetableOutputSchema,
  },
  async (input) => {
    const { output } = await generateTimetablePrompt(input);
    return output!;
  }
);

export async function generateInitialTimetable(
  input: GenerateInitialTimetableInput
): Promise<GenerateInitialTimetableOutput> {
  return generateInitialTimetableFlow(input);
}
