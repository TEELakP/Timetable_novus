# Smart Timetable Manager

An AI-powered academic scheduling and conflict resolution system built with Next.js, Genkit, and Firebase.

## Project Directory Guide

Explore the following files to see how the system works:

### 1. Feature Pages (`src/app/dashboard/`)
- `timetable/page.tsx`: The **Weekly Grid** and List overview.
- `data/page.tsx`: The **Excel Copy-Paste** logic and database sync.
- `teachers/page.tsx`: **Faculty Directory** with schedule detail modals.
- `units/page.tsx`: **Academic Catalog** with unit-specific schedules.
- `conflicts/page.tsx`: **Conflict Monitor** detecting unassigned classes and overlaps.
- `print/page.tsx`: **Printable Weekly Grid** (generates JPG/PDF).
- `export/page.tsx`: **Excel Reporting** and multi-filter exporting.

### 2. Database Layer (`src/firebase/`)
- `index.ts`: Central initialization for Auth and Firestore.
- `non-blocking-updates.tsx`: Optimized, non-blocking write operations.
- `firestore/`: Real-time data hooks (`useCollection`, `useDoc`).

### 3. Core Logic (`src/lib/`)
- `types.ts`: The TypeScript interfaces defining Trainers, Units, and Sessions.
- `mock-data.ts`: Initial configuration for campuses and days.

## Data Architecture

The application uses **Cloud Firestore** (NoSQL) for all data storage:

### Core Collections
1.  **`/teachers`**: Stores faculty profiles (name, email, campuses).
2.  **`/academicUnits`**: Stores subject/course definitions (theory/practical, duration).
3.  **`/rooms`**: Stores physical and virtual location definitions.
4.  **`/timetables/{id}/classSessions`**: Individual scheduled instances linking everything together.

## How to Sync Data
Use the **Data Entry** tab to bulk-import your schedule from Excel. The application uses **Firestore Batched Writes** to process hundreds of records simultaneously.
