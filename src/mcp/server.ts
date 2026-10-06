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