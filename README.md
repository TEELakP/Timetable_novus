# Smart Timetable Manager

An AI-powered academic scheduling and conflict resolution system built with Next.js, Genkit, and Firebase.

## Data Architecture

The application uses **Cloud Firestore** (NoSQL) for all data storage. The schema is organized to support real-time updates and efficient filtering:

### Core Collections

1.  **`/teachers`**: Stores faculty profiles.
    - Fields: `name`, `email`, `qualifiedUnits` (array of IDs), `campuses` (array), `availability`.
2.  **`/academicUnits`**: Stores subject/course definitions.
    - Fields: `name`, `type` (theory/practical/online), `durationHours`, `sessionsPerWeek`.
3.  **`/rooms`**: Stores physical and virtual location definitions.
    - Fields: `name`, `capacity`, `campus`.

### Timetable Sub-collections

1.  **`/timetables/{timetableId}/classSessions`**: Individual scheduled class instances.
    - Relationships: Links to `teacherId`, `unitId`, and uses `room` name for location.
    - Metadata: Includes `day`, `startTime`, `endTime`, `acknowledged` status, and conflict markers.

## Technical Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Cloud Firestore
- **Authentication**: Firebase Auth (Anonymous)
- **AI Engine**: Genkit (Google Gemini 2.5 Flash)
- **UI Components**: Shadcn UI / Tailwind CSS
- **Utilities**: Lucide Icons, Recharts, xlsx (Excel parsing), html-to-image (Printable views)

## How to Sync Data

Use the **Data Entry** tab to bulk-import your schedule from Excel. The application uses **Firestore Batched Writes** to process hundreds of records simultaneously, automatically creating any missing teacher, unit, or room entities.
