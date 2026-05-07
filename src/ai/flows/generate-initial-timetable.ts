
'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating an initial conflict-free timetable.
 *
 * - generateInitialTimetable - A function that triggers the timetable generation process.
 * - GenerateInitialTimetableInput - The input type for the generateInitialTimetable function.
 * - GenerateInitialTimetableOutput - The return type for the generateInitialTimetable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schemas
const TeacherAvailabilitySlotSchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
}).describe('A specific time slot a teacher is available.');

const TeacherSchema = z.object({
  id: z.string().describe('Unique identifier for the teacher.'),
  name: z.string().describe('Name of the teacher.'),
  availability: z.array(TeacherAvailabilitySlotSchema).describe('List of available time slots for the teacher.'),
  qualifiedUnits: z.array(z.string()).describe('IDs of units the teacher is qualified to teach.'),
  campuses: z.array(z.enum(['Ultimo', 'Gosford', 'Perth', 'Online'])).describe('Campuses where the teacher can work.'),
});

const UnitSchema = z.object({
  id: z.string().describe('Unique identifier for the unit.'),
  name: z.string().describe('Name of the unit.'),
  type: z.enum(['theory', 'practical']).describe('Type of the unit (theory or practical).'),
  durationHours: z.number().int().min(1).max(4).describe('Duration of one session in hours.'),
  sessionsPerWeek: z.number().int().min(1).max(5).describe('Number of sessions required per week for this unit.'),
});

const GenerateInitialTimetableInputSchema = z.object({
  teachers: z.array(TeacherSchema).describe('List of available teachers with their profiles.'),
  units: z.array(UnitSchema).describe('List of academic units to be scheduled.'),
  schedulingRules: z.array(z.string()).describe('A list of rules that the timetable must adhere to.'),
});
export type GenerateInitialTimetableInput = z.infer<typeof GenerateInitialTimetableInputSchema>;

// Output Schemas
const TimetableEntrySchema = z.object({
  unitId: z.string().describe('ID of the unit scheduled for this session.'),
  teacherId: z.string().describe('ID of the teacher assigned to this unit session.'),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']).describe('Day of the week for the session.'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time of the session in HH:MM format.'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time of the session in HH:MM format.'),
  room: z.string().describe('Assigned room for the session.'),
  campus: z.enum(['Ultimo', 'Gosford', 'Perth', 'Online']).describe('Assigned campus for the session.'),
});

const GenerateInitialTimetableOutputSchema = z.object({
  timetable: z.array(TimetableEntrySchema).describe('A generated list of scheduled timetable entries.'),
  conflicts: z.array(z.string()).describe('A list of any detected conflicts.'),
});
export type GenerateInitialTimetableOutput = z.infer<typeof GenerateInitialTimetableOutputSchema>;


const generateTimetablePrompt = ai.definePrompt({
  name: 'generateInitialTimetablePrompt',
  input: { schema: GenerateInitialTimetableInputSchema },
  output: { schema: GenerateInitialTimetableOutputSchema },
  prompt: `You are an expert timetable generator for multiple campuses (Ultimo, Gosford, Perth, Online). Your task is to create a conflict-free weekly timetable.

**Teachers:**
\`\`\`json
{{{JSON.stringify teachers}}}
\`\`\`

**Units:**
\`\`\`json
{{{JSON.stringify units}}}
\`\`\`

**Scheduling Rules:**
\`\`\`
{{#each schedulingRules}}- {{{this}}}
{{/each}}
\`\`\`

Generate a timetable that is completely conflict-free. Ensure that:
1.  Teachers are only assigned to campuses they are authorized for.
2.  Each unit's required sessions per week are met.
3.  Teachers only teach units they are qualified for.
4.  Teachers only teach during their available times.
5.  No teacher is scheduled for two classes simultaneously across ANY campus.
6.  The timetable should be for a 5-day week (Monday to Friday).
7.  Session duration must match the 'durationHours' of the unit.

Output a valid JSON object matching the schema.`,
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
