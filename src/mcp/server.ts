import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { z } from "zod";
import { createServer } from "node:http";
import db from "../data/database.js";

function createMcpServer() {
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
      description: "Add a study task.",
      inputSchema: z.object({
        title: z.string(),
        dueDate: z.string().optional(),
      }),
    },
    async ({ title, dueDate }) => {
      const result = db
        .prepare(
          "INSERT INTO tasks (title, due_date) VALUES (?, ?)"
        )
        .run(title, dueDate ?? null);

      return {
        content: [
          {
            type: "text",
            text: `Task added with id ${result.lastInsertRowid}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_tasks",
    {
      description: "List all study tasks.",
      inputSchema: z.object({}),
    },
    async () => {
      const tasks = db
        .prepare("SELECT * FROM tasks ORDER BY id")
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
      description: "Delete a study task by id.",
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
            text:
              result.changes > 0
                ? `Task ${id} deleted successfully.`
                : `Task ${id} was not found.`,
          },
        ],
      };
    }
  );

  // ==================================================
  // ACADEMIC EVENTS
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
        eventDate: z.string(),
      }),
    },
    async ({ title, subject, type, eventDate }) => {
      db.prepare(
        `INSERT INTO events
         (title, subject, type, event_date)
         VALUES (?, ?, ?, ?)`
      ).run(title, subject, type, eventDate);

      return {
        content: [
          {
            type: "text",
            text: `Event saved: ${title} (${subject}, ${type}, ${eventDate})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_events",
    {
      description: "List academic events, optionally filtered by subject.",
      inputSchema: z.object({
        subject: z.string().optional(),
      }),
    },
    async ({ subject }) => {
      const events = subject
        ? db
            .prepare(
              `SELECT *
               FROM events
               WHERE LOWER(subject) = LOWER(?)
               ORDER BY event_date`
            )
            .all(subject)
        : db
            .prepare(
              `SELECT *
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
      description: "Delete an academic event by id.",
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
            text:
              result.changes > 0
                ? `Event ${id} deleted successfully.`
                : `Event ${id} was not found.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "next_quiz",
    {
      description: "Find the next upcoming quiz for a subject.",
      inputSchema: z.object({
        subject: z.string(),
      }),
    },
    async ({ subject }) => {
      const quiz = db
        .prepare(
          `SELECT *
           FROM events
           WHERE LOWER(subject) = LOWER(?)
             AND LOWER(type) = 'quiz'
             AND event_date >= date('now')
           ORDER BY event_date
           LIMIT 1`
        )
        .get(subject);

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
            text: `Note saved with id ${result.lastInsertRowid}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_notes",
    {
      description: "List saved notes, optionally filtered by subject.",
      inputSchema: z.object({
        subject: z.string().optional(),
      }),
    },
    async ({ subject }) => {
      const notes = subject
        ? db
            .prepare(
              `SELECT *
               FROM notes
               WHERE LOWER(subject) = LOWER(?)
               ORDER BY id`
            )
            .all(subject)
        : db
            .prepare(
              `SELECT *
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
      description: "Delete a saved note by id.",
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
            text:
              result.changes > 0
                ? `Note ${id} deleted successfully.`
                : `Note ${id} was not found.`,
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
        "Create a study plan using upcoming assessments, saved notes, and available study times. Earlier quizzes are treated as milestones toward later exams.",
      inputSchema: z.object({
        subject: z.string(),
      }),
    },
    async ({ subject }) => {
      const assessments = db
        .prepare(
          `SELECT id, title, subject, type, event_date
           FROM events
           WHERE LOWER(subject) = LOWER(?)
             AND LOWER(type) IN ('quiz', 'exam', 'assignment')
             AND event_date >= date('now')
           ORDER BY event_date`
        )
        .all(subject) as {
        id: number;
        title: string;
        subject: string;
        type: string;
        event_date: string;
      }[];

      if (assessments.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No upcoming quiz, exam, or assignment found for ${subject}.`,
            },
          ],
        };
      }

      const notes = db
        .prepare(
          `SELECT id, title, subject
           FROM notes
           WHERE LOWER(subject) = LOWER(?)
           ORDER BY id`
        )
        .all(subject) as {
        id: number;
        title: string;
        subject: string;
      }[];

      if (notes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No notes found for ${subject}. Add some notes before creating a study plan.`,
            },
          ],
        };
      }

      const availability = db
        .prepare(
          `SELECT id, day, start_time, end_time
           FROM availability
           ORDER BY id`
        )
        .all() as {
        id: number;
        day: string;
        start_time: string;
        end_time: string;
      }[];

      if (availability.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No study availability found. Add your available study times before creating a study plan.`,
            },
          ],
        };
      }

      const existingSessions = db
        .prepare(
          `SELECT session_date, start_time, end_time
           FROM study_sessions`
        )
        .all() as {
        session_date: string;
        start_time: string;
        end_time: string;
      }[];

      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];

      const finalAssessment = assessments[assessments.length - 1]!;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const finalAssessmentDate = new Date(
        `${finalAssessment.event_date}T00:00:00`
      );

      const availableDates: {
        date: string;
        day: string;
        startTime: string;
        endTime: string;
      }[] = [];

      for (
        let date = new Date(today);
        date < finalAssessmentDate;
        date.setDate(date.getDate() + 1)
      ) {
        const dateString =
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

        const dayName = dayNames[date.getDay()]!;

        const matchingAvailability = availability.filter(
          (slot) => slot.day.toLowerCase() === dayName
        );

        for (const slot of matchingAvailability) {
          const isOccupied = existingSessions.some(
            (session) =>
              session.session_date === dateString &&
              session.start_time === slot.start_time &&
              session.end_time === slot.end_time
          );

          if (!isOccupied) {
            availableDates.push({
              date: dateString,
              day: dayName,
              startTime: slot.start_time,
              endTime: slot.end_time,
            });
          }
        }
      }

      availableDates.sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date);

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return a.startTime.localeCompare(b.startTime);
      });

      // Assignments need one focused work session.
      if (finalAssessment.type === "assignment") {
        if (availableDates.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No available study slots before the assignment.`,
              },
            ],
          };
        }

        const slot = availableDates[0]!;

        db.prepare(
          `INSERT OR IGNORE INTO study_sessions
           (subject, topic, session_date, start_time, end_time)
           VALUES (?, ?, ?, ?, ?)`
        ).run(
          subject,
          finalAssessment.title,
          slot.date,
          slot.startTime,
          slot.endTime
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                subject,
                milestones: assessments,
                finalAssessment,
                sessions: [
                  {
                    topic: finalAssessment.title,
                    purpose: "assignment",
                    date: slot.date,
                    day: slot.day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                  },
                ],
              }),
            },
          ],
        };
      }

      /*
       * Quizzes and exams are treated as milestones
       * in one continuous study plan.
       */
      const firstQuiz = assessments.find(
        (assessment) => assessment.type === "quiz"
      );

      const sessions: {
        topic: string;
        purpose: string;
        date: string;
        day: string;
        startTime: string;
        endTime: string;
      }[] = [];

      const sessionCount = Math.min(
        availableDates.length,
        Math.max(notes.length, 1)
      );

      const insertSession = db.prepare(
        `INSERT OR IGNORE INTO study_sessions
         (subject, topic, session_date, start_time, end_time)
         VALUES (?, ?, ?, ?, ?)`
      );

      for (let i = 0; i < sessionCount; i++) {
        const slot = availableDates[i]!;
        const note = notes[i % notes.length]!;

        const isBeforeQuiz =
          firstQuiz !== undefined &&
          slot.date < firstQuiz.event_date;

        const purpose = isBeforeQuiz
          ? `Prepare for ${firstQuiz.title}`
          : `Prepare for ${finalAssessment.title}`;

        insertSession.run(
          subject,
          note.title,
          slot.date,
          slot.startTime,
          slot.endTime
        );

        sessions.push({
          topic: note.title,
          purpose,
          date: slot.date,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              subject,
              milestones: assessments,
              finalAssessment,
              sessions,
              planningSummary: {
                totalAvailableSlots: availableDates.length,
                sessionsCreated: sessions.length,
                firstQuiz: firstQuiz ?? null,
              },
            }),
          },
        ],
      };
    }
  );

  // ==================================================
  // STUDY SESSIONS
  // ==================================================

  server.registerTool(
    "add_study_session",
    {
      description: "Add a study session manually.",
      inputSchema: z.object({
        subject: z.string(),
        topic: z.string(),
        sessionDate: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      }),
    },
    async ({
      subject,
      topic,
      sessionDate,
      startTime,
      endTime,
    }) => {
      const result = db
        .prepare(
          `INSERT OR IGNORE INTO study_sessions
           (subject, topic, session_date, start_time, end_time)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(
          subject,
          topic,
          sessionDate,
          startTime,
          endTime
        );

      return {
        content: [
          {
            type: "text",
            text:
              result.changes > 0
                ? `Study session created for ${subject}: ${topic} on ${sessionDate} from ${startTime} to ${endTime}.`
                : `That study session already exists.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_study_sessions",
    {
      description:
        "List study sessions, optionally filtered by subject.",
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
      description: "Delete a study session by id.",
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
            text:
              result.changes > 0
                ? `Study session ${id} deleted successfully.`
                : `Study session ${id} was not found.`,
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
        "Add a study availability slot for a day of the week.",
      inputSchema: z.object({
        day: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      }),
    },
    async ({ day, startTime, endTime }) => {
      const result = db
        .prepare(
          `INSERT INTO availability
           (day, start_time, end_time)
           VALUES (?, ?, ?)`
        )
        .run(
          day.toLowerCase(),
          startTime,
          endTime
        );

      return {
        content: [
          {
            type: "text",
            text: `Availability added with id ${result.lastInsertRowid}.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    "list_availability",
    {
      description: "List all saved study availability slots.",
      inputSchema: z.object({}),
    },
    async () => {
      const availability = db
        .prepare(
          `SELECT *
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
      description: "Delete a study availability slot by id.",
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
            text:
              result.changes > 0
                ? `Availability ${id} deleted successfully.`
                : `Availability ${id} was not found.`,
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
        "Delete all StudyMate data. Requires the exact confirmation string RESET.",
      inputSchema: z.object({
        confirmation: z.string(),
      }),
    },
    async ({ confirmation }) => {
      if (confirmation !== "RESET") {
        return {
          content: [
            {
              type: "text",
              text:
                "Database was not reset. Exact confirmation 'RESET' is required.",
            },
          ],
        };
      }

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
            text: "StudyMate database reset successfully.",
          },
        ],
      };
    }
  );

  return server;
}

// ==================================================
// HTTP MCP SERVER
// ==================================================

const httpServer = createServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  // Each MCP connection gets its own server + transport.
  const server = createMcpServer();

  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", async () => {
    await transport.close();
    await server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP request error:", error);

    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }
});

httpServer.listen(3000, () => {
  console.log(
    "StudyMate MCP server running at http://localhost:3000/mcp"
  );
});