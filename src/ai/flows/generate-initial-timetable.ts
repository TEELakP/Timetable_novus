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
  schedulingRules: z.array(z.string()).describe('A list of rules that the timetable must adhere to. Examples: "Teachers cannot teach two classes simultaneously", "Teachers must be qualified for assigned units", "Practical units require special labs".'),
});
export type GenerateInitialTimetableInput = z.infer<typeof GenerateInitialTimetableInputSchema>;

// Output Schemas
const TimetableEntrySchema = z.object({
  unitId: z.string().describe('ID of the unit scheduled for this session.'),
  teacherId: z.string().describe('ID of the teacher assigned to this unit session.'),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']).describe('Day of the week for the session.'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time of the session in HH:MM format.'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'End time of the session in HH:MM format.'),
  room: z.string().describe('Assigned room for the session (e.g., "Lecture Hall 1", "Lab 3").'),
});

const GenerateInitialTimetableOutputSchema = z.object({
  timetable: z.array(TimetableEntrySchema).describe('A generated list of scheduled timetable entries, representing a conflict-free weekly timetable.'),
  conflicts: z.array(z.string()).describe('A list of any detected conflicts or unfulfilled rules. This array should be empty if the timetable is conflict-free and successfully generated.'),
});
export type GenerateInitialTimetableOutput = z.infer<typeof GenerateInitialTimetableOutputSchema>;


const generateTimetablePrompt = ai.definePrompt({
  name: 'generateInitialTimetablePrompt',
  input: { schema: GenerateInitialTimetableInputSchema },
  output: { schema: GenerateInitialTimetableOutputSchema },
  prompt: `You are an expert timetable generator. Your task is to create a conflict-free weekly timetable for academic units and teachers, strictly adhering to the provided rules, teacher availabilities, and qualifications.

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
1.  Each unit's required sessions per week are met.
2.  Teachers only teach units they are qualified for.
3.  Teachers only teach during their available times.
4.  No teacher is scheduled for two classes simultaneously.
5.  Assign a generic room (e.g., "Room A", "Lab B") for each session, considering unit type (e.g., "Lab" for practical, "Lecture Hall" for theory). Rooms should be descriptive and make sense for the unit type.
6.  The timetable should be for a 5-day week (Monday to Friday).
7.  The timetable should be as compact as possible, avoiding unnecessary gaps for teachers where possible, but always prioritizing conflict avoidance.
8.  Each session duration must match the 'durationHours' of the unit.
9.  Session start and end times should be on the hour or half-hour (e.g., 09:00, 09:30).

If it\'s impossible to create a conflict-free timetable given the constraints, provide a detailed explanation of the conflicts in the \`conflicts\` array. Otherwise, the \`conflicts\` array should be empty.

Your output must be a valid JSON object matching the provided schema.`,
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
