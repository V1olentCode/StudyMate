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

  // Create a study plan
  server.registerTool(
    "create_study_plan",
    {
      description:
        "Create study sessions for a subject based on its next quiz and saved notes",
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
        .get(subject) as
        | {
            id: number;
            title: string;
            subject: string;
            type: string;
            event_date: string;
          }
        | undefined;

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

      const sessions = notes.map((note, index) => {
        const taskTitle = `Study ${subject}: ${note.title}`;

        const stmt = db.prepare(
          "INSERT INTO tasks (title, due_date) VALUES (?, ?)"
        );

        stmt.run(taskTitle, quiz.event_date);

        return taskTitle;
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              subject,
              nextQuiz: quiz,
              sessions,
            }),
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