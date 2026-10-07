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