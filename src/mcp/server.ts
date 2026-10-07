import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { z } from "zod";
import * as httpServer from "node:http";
import db from "../data/database.js";

// ==================================================
// CREATE MCP SERVER
// ==================================================

function createServer() {
  const server = new McpServer({
    name: "StudyMate",
    version: "1.0.0",
  });

  // ==================================================
  // TASKS
  // ==================================================

  server.registerTool(
    "add_task",
    {
      description: "Add a task with an optional due date.",
      inputSchema: z.object({
        title: z.string(),
        due_date: z.string().optional(),
      }),
    },
    async ({ title, due_date }) => {
      const result = db
        .prepare(
          `INSERT INTO tasks (title, due_date)
           VALUES (?, ?)`
        )
        .run(title, due_date ?? null);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: result.lastInsertRowid,
              title,
              due_date: due_date ?? null,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List all saved tasks.",
      inputSchema: z.object({}),
    },
    async () => {
      const tasks = db
        .prepare(
          `SELECT id, title, due_date
           FROM tasks
           ORDER BY due_date`
        )
        .all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tasks),
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_task",
    {
      description: "Delete a task by ID.",
      inputSchema: z.object({
        id: z.number(),
      }),
    },
    async ({ id }) => {
      const result = db
        .prepare("DELETE FROM tasks WHERE id = ?")
        .run(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              deleted: result.changes > 0,
              id,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // EVENTS
  // ==================================================

  server.registerTool(
    "add_event",
    {
      description:
        "Add an academic event such as a quiz, exam, or assignment.",
      inputSchema: z.object({
        title: z.string(),
        subject: z.string(),
        type: z.string(),
        event_date: z.string(),
      }),
    },
    async ({ title, subject, type, event_date }) => {
      const result = db
        .prepare(
          `INSERT INTO events
           (title, subject, type, event_date)
           VALUES (?, ?, ?, ?)`
        )
        .run(title, subject, type, event_date);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: result.lastInsertRowid,
              title,
              subject,
              type,
              event_date,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_events",
    {
      description: "List all academic events.",
      inputSchema: z.object({}),
    },
    async () => {
      const events = db
        .prepare(
          `SELECT
             id,
             title,
             subject,
             type,
             event_date
           FROM events
           ORDER BY event_date`
        )
        .all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(events),
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_event",
    {
      description: "Delete an academic event by ID.",
      inputSchema: z.object({
        id: z.number(),
      }),
    },
    async ({ id }) => {
      const result = db
        .prepare("DELETE FROM events WHERE id = ?")
        .run(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              deleted: result.changes > 0,
              id,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // NEXT QUIZ
  // ==================================================

  server.registerTool(
    "next_quiz",
    {
      description: "Find the next upcoming quiz for a subject.",
      inputSchema: z.object({
        subject: z.string(),
      }),
    },
    async ({ subject }) => {
      const today = new Date();

      const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const quiz = db
        .prepare(
          `SELECT
             id,
             title,
             subject,
             type,
             event_date
           FROM events
           WHERE LOWER(subject) = LOWER(?)
             AND LOWER(type) = 'quiz'
             AND event_date >= ?
           ORDER BY event_date
           LIMIT 1`
        )
        .get(subject, todayString);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(quiz ?? null),
          },
        ],
      };
    }
  );

  // ==================================================
  // NOTES
  // ==================================================

  server.registerTool(
    "add_note",
    {
      description: "Save a study note for a subject.",
      inputSchema: z.object({
        title: z.string(),
        subject: z.string(),
        content: z.string(),
      }),
    },
    async ({ title, subject, content }) => {
      const result = db
        .prepare(
          `INSERT INTO notes
           (title, subject, content)
           VALUES (?, ?, ?)`
        )
        .run(title, subject, content);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: result.lastInsertRowid,
              title,
              subject,
              content,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_notes",
    {
      description:
        "List saved study notes, optionally filtered by subject.",
      inputSchema: z.object({
        subject: z.string().optional(),
      }),
    },
    async ({ subject }) => {
      const notes = subject
        ? db
            .prepare(
              `SELECT
                 id,
                 title,
                 subject,
                 content
               FROM notes
               WHERE LOWER(subject) = LOWER(?)
               ORDER BY id`
            )
            .all(subject)
        : db
            .prepare(
              `SELECT
                 id,
                 title,
                 subject,
                 content
               FROM notes
               ORDER BY id`
            )
            .all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(notes),
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_note",
    {
      description: "Delete a saved note by ID.",
      inputSchema: z.object({
        id: z.number(),
      }),
    },
    async ({ id }) => {
      const result = db
        .prepare("DELETE FROM notes WHERE id = ?")
        .run(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              deleted: result.changes > 0,
              id,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // TODAY'S STUDY
  // ==================================================

  server.registerTool(
    "today_study",
    {
      description:
        "Show today's scheduled study sessions and the saved notes relevant to them.",
      inputSchema: z.object({}),
    },
    async () => {
      const today = new Date();

      const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const sessions = db
        .prepare(
          `SELECT
             id,
             subject,
             topic,
             purpose,
             session_date,
             start_time,
             end_time
           FROM study_sessions
           WHERE session_date = ?
           ORDER BY start_time`
        )
        .all(todayString) as {
        id: number;
        subject: string;
        topic: string;
        purpose: string;
        session_date: string;
        start_time: string;
        end_time: string;
      }[];

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                date: todayString,
                sessions: [],
                message:
                  "No study sessions are scheduled for today.",
              }),
            },
          ],
        };
      }

      const sessionsWithNotes = sessions.map((session) => {
        const notes = db
          .prepare(
            `SELECT
               id,
               title,
               subject,
               content
             FROM notes
             WHERE LOWER(subject) = LOWER(?)
             ORDER BY id`
          )
          .all(session.subject);

        return {
          ...session,
          notes,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              date: todayString,
              sessions: sessionsWithNotes,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // UPCOMING
  // ==================================================

  server.registerTool(
    "upcoming",
    {
      description:
        "Show upcoming academic events, tasks, and study sessions.",
      inputSchema: z.object({}),
    },
    async () => {
      const today = new Date();

      const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const events = db
        .prepare(
          `SELECT
             id,
             title,
             subject,
             type,
             event_date
           FROM events
           WHERE event_date >= ?
           ORDER BY event_date`
        )
        .all(todayString);

      const tasks = db
        .prepare(
          `SELECT
             id,
             title,
             due_date
           FROM tasks
           WHERE due_date IS NOT NULL
             AND due_date >= ?
           ORDER BY due_date`
        )
        .all(todayString);

      const studySessions = db
        .prepare(
          `SELECT
             id,
             subject,
             topic,
             purpose,
             session_date,
             start_time,
             end_time
           FROM study_sessions
           WHERE session_date >= ?
           ORDER BY session_date, start_time`
        )
        .all(todayString);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              from: todayString,
              events,
              tasks,
              studySessions,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // STUDY PLAN
  // ==================================================

  server.registerTool(
    "create_study_plan",
    {
      description:
        "Create a workload-aware study plan using academic events, notes, and available study time.",
      inputSchema: z.object({
        subject: z.string(),
      }),
    },
    async ({ subject }) => {
      const today = new Date();

      const todayString = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      // ==================================================
      // GET EVENTS
      // ==================================================

      const events = db
        .prepare(
          `SELECT
             id,
             title,
             subject,
             type,
             event_date
           FROM events
           WHERE LOWER(subject) = LOWER(?)
             AND event_date >= ?
           ORDER BY event_date`
        )
        .all(subject, todayString) as {
        id: number;
        title: string;
        subject: string;
        type: string;
        event_date: string;
      }[];

      // ==================================================
      // GET NOTES
      // ==================================================

      const notes = db
        .prepare(
          `SELECT
             id,
             title,
             subject,
             content
           FROM notes
           WHERE LOWER(subject) = LOWER(?)
           ORDER BY id`
        )
        .all(subject) as {
        id: number;
        title: string;
        subject: string;
        content: string;
      }[];

      // ==================================================
      // GET AVAILABILITY
      // ==================================================

      const availability = db
        .prepare(
          `SELECT
             id,
             day,
             start_time,
             end_time
           FROM availability
           ORDER BY id`
        )
        .all() as {
        id: number;
        day: string;
        start_time: string;
        end_time: string;
      }[];

      if (events.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                subject,
                sessionsCreated: 0,
                message:
                  "No upcoming academic events were found for this subject.",
              }),
            },
          ],
        };
      }

      if (notes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                subject,
                sessionsCreated: 0,
                message:
                  "No saved notes were found for this subject.",
              }),
            },
          ],
        };
      }

      if (availability.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                subject,
                sessionsCreated: 0,
                message:
                  "No study availability has been saved.",
              }),
            },
          ],
        };
      }

      // ==================================================
      // FIND ASSESSMENTS
      // ==================================================

      const assessments = events.filter(
        (event) =>
          event.type.toLowerCase() === "quiz" ||
          event.type.toLowerCase() === "exam"
      );

      const firstQuiz = events.find(
        (event) => event.type.toLowerCase() === "quiz"
      );

      const finalAssessment =
        assessments.length > 0
          ? assessments[assessments.length - 1]
          : events[events.length - 1];

      if (!finalAssessment) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                subject,
                sessionsCreated: 0,
                message: "No final assessment was found.",
              }),
            },
          ],
        };
      }

      const assessmentDates = new Set(
        assessments.map(
          (assessment) => assessment.event_date
        )
      );

      // ==================================================
      // EXISTING SESSIONS
      // ==================================================

      const existingSessions = db
        .prepare(
          `SELECT
             id,
             subject,
             topic,
             purpose,
             session_date,
             start_time,
             end_time
           FROM study_sessions
           WHERE LOWER(subject) = LOWER(?)
           ORDER BY session_date, start_time`
        )
        .all(subject) as {
        id: number;
        subject: string;
        topic: string;
        purpose: string;
        session_date: string;
        start_time: string;
        end_time: string;
      }[];

      // ==================================================
      // BACKFILL PURPOSES
      // ==================================================

      for (const session of existingSessions) {
        if (session.purpose !== "Study") {
          continue;
        }

        let purpose = "Study";

        if (
          firstQuiz &&
          session.session_date < firstQuiz.event_date
        ) {
          purpose = `Prepare for ${firstQuiz.title}`;
        } else {
          purpose = `Prepare for ${finalAssessment.title}`;
        }

        if (purpose !== "Study") {
          db.prepare(
            `UPDATE study_sessions
             SET purpose = ?
             WHERE id = ?`
          ).run(purpose, session.id);
        }
      }

      const updatedExistingSessions = db
        .prepare(
          `SELECT
             id,
             subject,
             topic,
             purpose,
             session_date,
             start_time,
             end_time
           FROM study_sessions
           WHERE LOWER(subject) = LOWER(?)
           ORDER BY session_date, start_time`
        )
        .all(subject) as {
        id: number;
        subject: string;
        topic: string;
        purpose: string;
        session_date: string;
        start_time: string;
        end_time: string;
      }[];

      const existingSessionDates = new Set(
        updatedExistingSessions.map(
          (session) => session.session_date
        )
      );

      // ==================================================
      // WORKLOAD CALCULATION
      // ==================================================

      // Each saved note gets up to two study sessions.
      // This prevents the planner from filling every
      // available day unnecessarily.

      const targetSessionCount = Math.max(
        notes.length * 2,
        1
      );

      const existingSessionCount =
        updatedExistingSessions.length;

      const remainingSessions = Math.max(
        targetSessionCount - existingSessionCount,
        0
      );

      // ==================================================
      // FIND AVAILABLE DATES
      // ==================================================

      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      const newSlots: {
        date: string;
        start_time: string;
        end_time: string;
      }[] = [];

      const current = new Date(today);
      current.setHours(0, 0, 0, 0);

      const finalDate = new Date(
        `${finalAssessment.event_date}T00:00:00`
      );

      while (
        current < finalDate &&
        newSlots.length < remainingSessions
      ) {
        const matchingSlots = availability
          .filter(
            (slot) =>
              dayMap[slot.day.toLowerCase()] ===
              current.getDay()
          )
          .sort((a, b) =>
            a.start_time.localeCompare(b.start_time)
          );

        const dateString = `${current.getFullYear()}-${String(
          current.getMonth() + 1
        ).padStart(2, "0")}-${String(
          current.getDate()
        ).padStart(2, "0")}`;

        // Never schedule on an assessment date.
        // Never create more than one StudyMate session per day.

        if (
          !existingSessionDates.has(dateString) &&
          !assessmentDates.has(dateString) &&
          matchingSlots.length > 0
        ) {
          const slot = matchingSlots[0];

          if (slot) {
            newSlots.push({
              date: dateString,
              start_time: slot.start_time,
              end_time: slot.end_time,
            });
          }
        }

        current.setDate(current.getDate() + 1);
      }

      // ==================================================
      // CREATE SESSIONS
      // ==================================================

      let sessionsCreated = 0;

      for (let i = 0; i < newSlots.length; i++) {
        const slot = newSlots[i];

        if (!slot) {
          continue;
        }

        const note = notes[i % notes.length];

        if (!note) {
          continue;
        }

        let purpose = "Study";

        if (
          firstQuiz &&
          slot.date < firstQuiz.event_date
        ) {
          purpose = `Prepare for ${firstQuiz.title}`;
        } else {
          purpose = `Prepare for ${finalAssessment.title}`;
        }

        const result = db
          .prepare(
            `INSERT OR IGNORE INTO study_sessions
             (subject, topic, purpose, session_date, start_time, end_time)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            subject,
            note.title,
            purpose,
            slot.date,
            slot.start_time,
            slot.end_time
          );

        if (result.changes > 0) {
          sessionsCreated++;
        }
      }

      // ==================================================
      // RETURN COMPLETE PLAN
      // ==================================================

      const finalSessions = db
        .prepare(
          `SELECT
             id,
             subject,
             topic,
             purpose,
             session_date,
             start_time,
             end_time
           FROM study_sessions
           WHERE LOWER(subject) = LOWER(?)
           ORDER BY session_date, start_time`
        )
        .all(subject);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              subject,
              workload: {
                notesCount: notes.length,
                targetSessionCount,
                existingSessionCount,
                remainingSessions,
              },
              notes,
              events,
              availability,
              sessionsCreated,
              existingSessions: finalSessions,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // STUDY SESSION MANAGEMENT
  // ==================================================

  server.registerTool(
    "add_study_session",
    {
      description: "Add a study session manually.",
      inputSchema: z.object({
        subject: z.string(),
        topic: z.string(),
        session_date: z.string(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        purpose: z.string().optional(),
      }),
    },
    async ({
      subject,
      topic,
      session_date,
      start_time,
      end_time,
      purpose,
    }) => {
      const result = db
        .prepare(
          `INSERT INTO study_sessions
           (subject, topic, purpose, session_date, start_time, end_time)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(
          subject,
          topic,
          purpose ?? "Study",
          session_date,
          start_time ?? "00:00",
          end_time ?? "00:00"
        );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: result.lastInsertRowid,
              subject,
              topic,
              purpose: purpose ?? "Study",
              session_date,
              start_time: start_time ?? "00:00",
              end_time: end_time ?? "00:00",
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // UPDATE STUDY SESSION
  // ==================================================

  server.registerTool(
    "update_study_session",
    {
      description:
        "Update the date, time, topic, or purpose of an existing study session. Study sessions cannot be moved onto quiz or exam dates.",
      inputSchema: z.object({
        id: z.number(),
        topic: z.string().optional(),
        session_date: z.string().optional(),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        purpose: z.string().optional(),
      }),
    },
    async ({
      id,
      topic,
      session_date,
      start_time,
      end_time,
      purpose,
    }) => {
      const existing = db
        .prepare(
          `SELECT
             id,
             subject,
             topic,
             purpose,
             session_date,
             start_time,
             end_time
           FROM study_sessions
           WHERE id = ?`
        )
        .get(id) as
        | {
            id: number;
            subject: string;
            topic: string;
            purpose: string;
            session_date: string;
            start_time: string;
            end_time: string;
          }
        | undefined;

      if (!existing) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                updated: false,
                message:
                  `Study session ${id} was not found.`,
              }),
            },
          ],
        };
      }

      const newTopic = topic ?? existing.topic;
      const newDate = session_date ?? existing.session_date;
      const newStartTime =
        start_time ?? existing.start_time;
      const newEndTime = end_time ?? existing.end_time;
      const newPurpose = purpose ?? existing.purpose;

      // Never move a study session onto an academic assessment date.
      const conflictingEvent = db
        .prepare(
          `SELECT
             id,
             title,
             type,
             event_date
           FROM events
           WHERE LOWER(subject) = LOWER(?)
             AND event_date = ?
             AND LOWER(type) IN ('quiz', 'exam')
           LIMIT 1`
        )
        .get(existing.subject, newDate) as
        | {
            id: number;
            title: string;
            type: string;
            event_date: string;
          }
        | undefined;

      if (conflictingEvent) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                updated: false,
                conflict: true,
                message:
                  `Cannot move study session ${id} to ${newDate}. ` +
                  `${conflictingEvent.title} (${conflictingEvent.type}) ` +
                  `is scheduled for that date.`,
                event: conflictingEvent,
              }),
            },
          ],
        };
      }

      const result = db
        .prepare(
          `UPDATE study_sessions
           SET topic = ?,
               purpose = ?,
               session_date = ?,
               start_time = ?,
               end_time = ?
           WHERE id = ?`
        )
        .run(
          newTopic,
          newPurpose,
          newDate,
          newStartTime,
          newEndTime,
          id
        );

      const updated = db
        .prepare(
          `SELECT
             id,
             subject,
             topic,
             purpose,
             session_date,
             start_time,
             end_time
           FROM study_sessions
           WHERE id = ?`
        )
        .get(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              updated: result.changes > 0,
              session: updated,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_study_sessions",
    {
      description: "List saved study sessions.",
      inputSchema: z.object({
        subject: z.string().optional(),
      }),
    },
    async ({ subject }) => {
      const sessions = subject
        ? db
            .prepare(
              `SELECT *
               FROM study_sessions
               WHERE LOWER(subject) = LOWER(?)
               ORDER BY session_date, start_time`
            )
            .all(subject)
        : db
            .prepare(
              `SELECT *
               FROM study_sessions
               ORDER BY session_date, start_time`
            )
            .all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(sessions),
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_study_session",
    {
      description: "Delete a study session by ID.",
      inputSchema: z.object({
        id: z.number(),
      }),
    },
    async ({ id }) => {
      const result = db
        .prepare("DELETE FROM study_sessions WHERE id = ?")
        .run(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              deleted: result.changes > 0,
              id,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // AVAILABILITY
  // ==================================================

  server.registerTool(
    "add_availability",
    {
      description:
        "Add an available study time slot for a day of the week.",
      inputSchema: z.object({
        day: z.string(),
        start_time: z.string(),
        end_time: z.string(),
      }),
    },
    async ({ day, start_time, end_time }) => {
      const result = db
        .prepare(
          `INSERT INTO availability
           (day, start_time, end_time)
           VALUES (?, ?, ?)`
        )
        .run(day, start_time, end_time);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              id: result.lastInsertRowid,
              day,
              start_time,
              end_time,
            }),
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_availability",
    {
      description:
        "List all saved study availability slots.",
      inputSchema: z.object({}),
    },
    async () => {
      const availability = db
        .prepare(
          `SELECT
             id,
             day,
             start_time,
             end_time
           FROM availability
           ORDER BY id`
        )
        .all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(availability),
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_availability",
    {
      description:
        "Delete an availability slot by ID.",
      inputSchema: z.object({
        id: z.number(),
      }),
    },
    async ({ id }) => {
      const result = db
        .prepare("DELETE FROM availability WHERE id = ?")
        .run(id);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              deleted: result.changes > 0,
              id,
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // RESET DATABASE
  // ==================================================

  server.registerTool(
    "reset_database",
    {
      description:
        "Delete all tasks, events, notes, study sessions, and availability.",
      inputSchema: z.object({}),
    },
    async () => {
      db.exec(`
        DELETE FROM tasks;
        DELETE FROM events;
        DELETE FROM notes;
        DELETE FROM study_sessions;
        DELETE FROM availability;
      `);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              reset: true,
            }),
          },
        ],
      };
    }
  );

  return server;
}

// ==================================================
// MCP HTTP SERVER
// ==================================================

const port = 3000;

const listener = httpServer.createServer(
  async (req, res) => {
    if (req.url !== "/mcp") {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    const mcpServer = createServer();

    const transport =
      new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

    await mcpServer.connect(transport);

    await transport.handleRequest(req, res);
  }
);

listener.listen(port, () => {
  console.log(
    `StudyMate MCP server running at http://localhost:${port}/mcp`
  );
});