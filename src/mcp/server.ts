import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createServer } from "node:http";
import { z } from "zod";
import db from "../data/database.js";

function createMcpServer() {
  const server = new McpServer({
    name: "studymate",
    version: "1.0.0",
  });

  // Add a task
  server.registerTool(
    "add_task",
    {
      description: "Add a study task for the user",
      inputSchema: {
        title: z.string(),
        dueDate: z.string().optional(),
      },
    },
    async ({ title, dueDate }) => {
      const stmt = db.prepare(
        "INSERT INTO tasks (title, due_date) VALUES (?, ?)"
      );

      stmt.run(title, dueDate ?? null);

      return {
        content: [
          {
            type: "text",
            text: `Task saved: ${title}${dueDate ? ` (due ${dueDate})` : ""}`,
          },
        ],
      };
    }
  );

  // List all tasks
  server.registerTool(
    "list_tasks",
    {
      description: "List all study tasks",
    },
    async () => {
      const tasks = db
        .prepare("SELECT id, title, due_date FROM tasks ORDER BY id")
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

  // Delete a task
  server.registerTool(
    "delete_task",
    {
      description: "Delete a study task by its ID",
      inputSchema: {
        id: z.number().int().positive(),
      },
    },
    async ({ id }) => {
      const stmt = db.prepare("DELETE FROM tasks WHERE id = ?");
      const result = stmt.run(id);

      if (result.changes === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No task found with ID ${id}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Task ${id} deleted successfully.`,
          },
        ],
      };
    }
  );

  // Add an academic event
  server.registerTool(
    "add_event",
    {
      description:
        "Add an academic event such as a quiz, exam, or assignment",
      inputSchema: {
        title: z.string(),
        subject: z.string(),
        type: z.enum(["quiz", "exam", "assignment"]),
        eventDate: z.string(),
      },
    },
    async ({ title, subject, type, eventDate }) => {
      const stmt = db.prepare(
        "INSERT INTO events (title, subject, type, event_date) VALUES (?, ?, ?, ?)"
      );

      stmt.run(title, subject, type, eventDate);

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

  // List academic events
  server.registerTool(
    "list_events",
    {
      description: "List academic events for a subject",
      inputSchema: {
        subject: z.string().optional(),
      },
    },
    async ({ subject }) => {
      let events;

      if (subject) {
        events = db
          .prepare(
            `SELECT id, title, subject, type, event_date
             FROM events
             WHERE LOWER(subject) = LOWER(?)
             ORDER BY event_date`
          )
          .all(subject);
      } else {
        events = db
          .prepare(
            `SELECT id, title, subject, type, event_date
             FROM events
             ORDER BY event_date`
          )
          .all();
      }

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

  // Delete an academic event
  server.registerTool(
    "delete_event",
    {
      description: "Delete an academic event by its ID",
      inputSchema: {
        id: z.number().int().positive(),
      },
    },
    async ({ id }) => {
      const stmt = db.prepare("DELETE FROM events WHERE id = ?");
      const result = stmt.run(id);

      if (result.changes === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No event found with ID ${id}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Event ${id} deleted successfully.`,
          },
        ],
      };
    }
  );

  // Find the next quiz for a subject
  server.registerTool(
    "next_quiz",
    {
      description: "Find the next upcoming quiz for a subject",
      inputSchema: {
        subject: z.string(),
      },
    },
    async ({ subject }) => {
      const quiz = db
        .prepare(
          `SELECT id, title, subject, type, event_date
           FROM events
           WHERE LOWER(subject) = LOWER(?)
             AND type = 'quiz'
             AND event_date >= date('now')
           ORDER BY event_date
           LIMIT 1`
        )
        .get(subject);

      if (!quiz) {
        return {
          content: [
            {
              type: "text",
              text: `No upcoming quiz found for ${subject}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(quiz),
          },
        ],
      };
    }
  );

  // Add a note
  server.registerTool(
    "add_note",
    {
      description: "Save a study note for a subject",
      inputSchema: {
        title: z.string(),
        subject: z.string(),
        content: z.string(),
      },
    },
    async ({ title, subject, content }) => {
      const stmt = db.prepare(
        "INSERT INTO notes (title, subject, content) VALUES (?, ?, ?)"
      );

      stmt.run(title, subject, content);

      return {
        content: [
          {
            type: "text",
            text: `Note saved: ${title} (${subject})`,
          },
        ],
      };
    }
  );

  // List notes
  server.registerTool(
    "list_notes",
    {
      description: "List study notes, optionally filtered by subject",
      inputSchema: {
        subject: z.string().optional(),
      },
    },
    async ({ subject }) => {
      let notes;

      if (subject) {
        notes = db
          .prepare(
            `SELECT id, title, subject, content
             FROM notes
             WHERE LOWER(subject) = LOWER(?)
             ORDER BY id`
          )
          .all(subject);
      } else {
        notes = db
          .prepare(
            `SELECT id, title, subject, content
             FROM notes
             ORDER BY id`
          )
          .all();
      }

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

  // Delete a note
  server.registerTool(
    "delete_note",
    {
      description: "Delete a study note by its ID",
      inputSchema: {
        id: z.number().int().positive(),
      },
    },
    async ({ id }) => {
      const stmt = db.prepare("DELETE FROM notes WHERE id = ?");
      const result = stmt.run(id);

      if (result.changes === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No note found with ID ${id}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Note ${id} deleted successfully.`,
          },
        ],
      };
    }
  );

  // Create a study plan
  server.registerTool(
    "create_study_plan",
    {
      description:
        "Create study sessions for a subject based on its next academic deadline, saved notes, and available study times",
      inputSchema: {
        subject: z.string(),
      },
    },
    async ({ subject }) => {
      const assessment = db
        .prepare(
          `SELECT id, title, subject, type, event_date
           FROM events
           WHERE LOWER(subject) = LOWER(?)
             AND type IN ('quiz', 'exam', 'assignment')
             AND event_date >= date('now')
           ORDER BY event_date
           LIMIT 1`
        )
        .get(subject) as
        | {
            id: number;
            title: string;
            subject: string;
            type: string;
            event_date: string;
          }
        | undefined;

      if (!assessment) {
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

      if (assessment.type !== "assignment" && notes.length === 0) {
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

      const assessmentDate = new Date(
        `${assessment.event_date}T00:00:00`
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const availableDates: {
        date: string;
        day: string;
        startTime: string;
        endTime: string;
      }[] = [];

      for (
        let date = new Date(today);
        date < assessmentDate;
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

      // Assignments need one work session.
      if (assessment.type === "assignment") {
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

        const insertSession = db.prepare(
          `INSERT OR IGNORE INTO study_sessions
           (subject, topic, session_date, start_time, end_time)
           VALUES (?, ?, ?, ?, ?)`
        );

        insertSession.run(
          subject,
          assessment.title,
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
                nextAssessment: assessment,
                sessions: [
                  {
                    topic: assessment.title,
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

      // Quizzes and exams get one session per note.
      const selectedDates = availableDates.slice(0, notes.length);

      if (selectedDates.length < notes.length) {
        return {
          content: [
            {
              type: "text",
              text: `Not enough available study slots before the ${assessment.type}. You need ${notes.length} available session(s), but only found ${selectedDates.length}.`,
            },
          ],
        };
      }

      const insertSession = db.prepare(
        `INSERT OR IGNORE INTO study_sessions
         (subject, topic, session_date, start_time, end_time)
         VALUES (?, ?, ?, ?, ?)`
      );

      const sessions = notes.map((note, index) => {
        const slot = selectedDates[index]!;

        insertSession.run(
          subject,
          note.title,
          slot.date,
          slot.startTime,
          slot.endTime
        );

        return {
          topic: note.title,
          date: slot.date,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              subject,
              nextAssessment: assessment,
              sessions,
            }),
          },
        ],
      };
    }
  );

  // Add a study session manually
  server.registerTool(
    "add_study_session",
    {
      description: "Add a study session to the schedule",
      inputSchema: {
        subject: z.string(),
        topic: z.string(),
        sessionDate: z.string(),
        startTime: z.string(),
        endTime: z.string(),
      },
    },
    async ({
      subject,
      topic,
      sessionDate,
      startTime,
      endTime,
    }) => {
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO study_sessions
         (subject, topic, session_date, start_time, end_time)
         VALUES (?, ?, ?, ?, ?)`
      );

      const result = stmt.run(
        subject,
        topic,
        sessionDate,
        startTime,
        endTime
      );

      if (result.changes === 0) {
        return {
          content: [
            {
              type: "text",
              text: `A study session for ${subject} - ${topic} on ${sessionDate} already exists.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Study session added: ${subject} - ${topic} on ${sessionDate} ${startTime}-${endTime}`,
          },
        ],
      };
    }
  );

  // List study sessions
  server.registerTool(
    "list_study_sessions",
    {
      description:
        "List scheduled study sessions, optionally filtered by subject",
      inputSchema: {
        subject: z.string().optional(),
      },
    },
    async ({ subject }) => {
      let sessions;

      if (subject) {
        sessions = db
          .prepare(
            `SELECT id, subject, topic, session_date, start_time, end_time
             FROM study_sessions
             WHERE LOWER(subject) = LOWER(?)
             ORDER BY session_date, start_time`
          )
          .all(subject);
      } else {
        sessions = db
          .prepare(
            `SELECT id, subject, topic, session_date, start_time, end_time
             FROM study_sessions
             ORDER BY session_date, start_time`
          )
          .all();
      }

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

  // Delete a study session
  server.registerTool(
    "delete_study_session",
    {
      description: "Delete a scheduled study session by its ID",
      inputSchema: {
        id: z.number().int().positive(),
      },
    },
    async ({ id }) => {
      const stmt = db.prepare(
        "DELETE FROM study_sessions WHERE id = ?"
      );

      const result = stmt.run(id);

      if (result.changes === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No study session found with ID ${id}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Study session ${id} deleted successfully.`,
          },
        ],
      };
    }
  );

  // Add available study time
  server.registerTool(
    "add_availability",
    {
      description:
        "Save a study availability slot. Multiple slots can be added for the same day.",
      inputSchema: {
        day: z.enum([
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ]),
        startTime: z.string(),
        endTime: z.string(),
      },
    },
    async ({ day, startTime, endTime }) => {
      const stmt = db.prepare(
        `INSERT INTO availability (day, start_time, end_time)
         VALUES (?, ?, ?)`
      );

      stmt.run(day, startTime, endTime);

      return {
        content: [
          {
            type: "text",
            text: `Availability saved: ${day} ${startTime}-${endTime}`,
          },
        ],
      };
    }
  );

  // List available study time
  server.registerTool(
    "list_availability",
    {
      description: "List all of the user's available study times",
    },
    async () => {
      const availability = db
        .prepare(
          `SELECT id, day, start_time, end_time
           FROM availability
           ORDER BY
             CASE LOWER(day)
               WHEN 'monday' THEN 1
               WHEN 'tuesday' THEN 2
               WHEN 'wednesday' THEN 3
               WHEN 'thursday' THEN 4
               WHEN 'friday' THEN 5
               WHEN 'saturday' THEN 6
               WHEN 'sunday' THEN 7
             END,
             start_time`
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

  // Delete an availability slot
  server.registerTool(
    "delete_availability",
    {
      description: "Delete a study availability slot by its ID",
      inputSchema: {
        id: z.number().int().positive(),
      },
    },
    async ({ id }) => {
      const stmt = db.prepare(
        "DELETE FROM availability WHERE id = ?"
      );

      const result = stmt.run(id);

      if (result.changes === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No availability slot found with ID ${id}.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Availability slot ${id} deleted successfully.`,
          },
        ],
      };
    }
  );

  // Reset the entire StudyMate database
  server.registerTool(
    "reset_database",
    {
      description:
        "Delete all tasks, events, notes, study sessions, and availability. Requires explicit RESET confirmation.",
      inputSchema: {
        confirmation: z.string(),
      },
    },
    async ({ confirmation }) => {
      if (confirmation !== "RESET") {
        return {
          content: [
            {
              type: "text",
              text: "Database reset cancelled. Exact confirmation required: RESET",
            },
          ],
        };
      }

      const resetDatabase = db.transaction(() => {
        db.prepare("DELETE FROM tasks").run();
        db.prepare("DELETE FROM events").run();
        db.prepare("DELETE FROM notes").run();
        db.prepare("DELETE FROM study_sessions").run();
        db.prepare("DELETE FROM availability").run();
      });

      resetDatabase();

      return {
        content: [
          {
            type: "text",
            text: "StudyMate database reset successfully. All tasks, events, notes, study sessions, and availability were deleted.",
          },
        ],
      };
    }
  );

  return server;
}

const httpServer = createServer(async (req, res) => {
  if (req.url === "/mcp") {
    const mcpServer = createMcpServer();

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);

    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

httpServer.listen(3000, () => {
  console.log(
    "StudyMate MCP server running on http://localhost:3000/mcp"
  );
});