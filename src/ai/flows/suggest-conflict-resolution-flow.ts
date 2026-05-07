'use server';
/**
 * @fileOverview A Genkit flow for suggesting conflict resolutions in a timetable.
 *
 * - suggestConflictResolution - A function that handles the conflict resolution suggestion process.
 * - SuggestConflictResolutionInput - The input type for the suggestConflictResolution function.
 * - SuggestConflictResolutionOutput - The return type for the suggestConflictResolution function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const SuggestConflictResolutionInputSchema = z.object({
  conflictDescription: z
    .string()
    .describe('A detailed human-readable description of the conflict.'),
  conflictingClass: z
    .object({
      classId: z.string().describe('The ID of the class involved in the conflict.'),
      unitName: z.string().describe('The name of the unit for the conflicting class.'),
      teacherName: z.string().describe('The name of the teacher currently assigned to the conflicting class.'),
      timeSlot: z.string().describe('The time slot of the conflicting class (e.g., "Monday 10:00-11:00").'),
      roomName: z.string().describe('The room name of the conflicting class.'),
    })
    .describe('Details about the class that is causing or involved in the conflict.'),
  contextTimetableSnippet: z
    .string()
    .describe('A brief, relevant snippet of the current timetable around the conflict, providing context.'),
  availableTeachers: z
    .array(
      z.object({
        id: z.string().describe('The unique ID of the teacher.'),
        name: z.string().describe('The name of the teacher.'),
        availableTimeSlots: z
          .array(z.string())
          .describe('A list of time slots when the teacher is available (e.g., "Tuesday 09:00-10:00").'),
        qualifiedUnits: z
          .array(z.string())
          .describe('A list of unit names that the teacher is qualified to teach.'),
      })
    )
    .describe('A list of teachers who might be able to take on a class or move.'),
  availableTimeSlots: z
    .array(z.string())
    .describe('A list of currently open and suitable time slots.'),
  availableRooms: z
    .array(z.string())
    .describe('A list of currently available room names.'),
});

export type SuggestConflictResolutionInput = z.infer<typeof SuggestConflictResolutionInputSchema>;

// Output Schema
const SuggestConflictResolutionOutputSchema = z.object({
  suggestions: z
    .array(
      z.object({
        summary: z
          .string()
          .describe('A concise summary of the suggested resolution (e.g., "Move Math class from Monday 10:00 to Tuesday 10:00").'),
        details: z
          .string()
          .describe('A detailed explanation of the proposed change and why it resolves the conflict, considering teacher availability, room capacity, and unit qualifications.'),
        proposedAction: z
          .object({
            classId: z.string().describe('The ID of the class to which the action applies.'),
            actionType: z
              .enum(['move_class', 'reassign_teacher', 'change_room', 'adjust_time'])
              .describe('The type of action proposed.'),
            newTeacherId: z
              .string()
              .optional()
              .describe('The ID of the new teacher, if actionType is "reassign_teacher".'),
            newTimeSlot: z
              .string()
              .optional()
              .describe('The new time slot, if actionType is "move_class" or "adjust_time".'),
            newRoomId: z
              .string()
              .optional()
              .describe('The ID of the new room, if actionType is "move_class" or "change_room".'),
          })
          .describe('The specific actionable changes to resolve the conflict.'),
      })
    )
    .describe('A list of suggested resolutions for the conflict.'),
});

export type SuggestConflictResolutionOutput = z.infer<typeof SuggestConflictResolutionOutputSchema>;

// Wrapper function
export async function suggestConflictResolution(
  input: SuggestConflictResolutionInput
): Promise<SuggestConflictResolutionOutput> {
  return suggestConflictResolutionFlow(input);
}

// Prompt definition
const prompt = ai.definePrompt({
  name: 'suggestConflictResolutionPrompt',
  input: {schema: SuggestConflictResolutionInputSchema},
  output: {schema: SuggestConflictResolutionOutputSchema},
  prompt: `You are an AI assistant specialized in timetable management. Your task is to analyze a given timetable conflict and propose intelligent solutions.\n\nThe current conflict is:\nConflict Description: {{{conflictDescription}}}\nConflicting Class Details:\n  - Class ID: {{{conflictingClass.classId}}}\n  - Unit: {{{conflictingClass.unitName}}}\n  - Teacher: {{{conflictingClass.teacherName}}}\n  - Current Time Slot: {{{conflictingClass.timeSlot}}}\n  - Current Room: {{{conflictingClass.roomName}}}\n\nRelevant Timetable Context:\n{{{contextTimetableSnippet}}}\n\nAvailable Resources for Resolution:\nAvailable Teachers:\n{{#each availableTeachers}}\n- ID: {{this.id}}, Name: {{this.name}}, Available Slots: {{this.availableTimeSlots}}, Qualified Units: {{this.qualifiedUnits}}\n{{/each}}\nAvailable Time Slots: {{{availableTimeSlots}}}\nAvailable Rooms: {{{availableRooms}}}\n\nBased on the conflict and the available resources, suggest 1-3 conflict-free resolutions. For each suggestion, provide:\n1. A concise summary.\n2. A detailed explanation of why it resolves the conflict and maintains other scheduling rules (e.g., teacher qualification, availability, room capacity, no other new conflicts).\n3. A structured 'proposedAction' object detailing the specific changes. The 'actionType' must be one of "move_class", "reassign_teacher", "change_room", or "adjust_time".\n   - If 'actionType' is "move_class" (moving to a new time and potentially new room), provide 'newTimeSlot' and optionally 'newRoomId'.\n   - If 'actionType' is "reassign_teacher", provide 'newTeacherId'.\n   - If 'actionType' is "change_room" (same time, new room), provide 'newRoomId'.\n   - If 'actionType' is "adjust_time" (same room, new time), provide 'newTimeSlot'.\n\nEnsure the suggested changes are feasible given the provided 'Available Teachers', 'Available Time Slots', and 'Available Rooms'. Do not suggest moving a class if there are no available time slots or teachers. Prioritize minimal changes to resolve the conflict.\n`
});

// Flow definition
const suggestConflictResolutionFlow = ai.defineFlow(
  {
    name: 'suggestConflictResolutionFlow',
    inputSchema: SuggestConflictResolutionInputSchema,
    outputSchema: SuggestConflictResolutionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to generate conflict resolution suggestions.');
    }
    return output;
  }
);
