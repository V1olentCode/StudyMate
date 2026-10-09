import express from "express";
import { GoogleGenAI } from "@google/genai";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

const app = express();
const port = 3001;

app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_INSTRUCTION = `
You are StudyMate, an AI study assistant.

The current date is October 9, 2026.

Help users manage their studies using the available StudyMate MCP tools.

Rules:
1. Use MCP tools whenever relevant.
2. Never claim an action succeeded unless a tool confirms it.
3. Only modify user data when the user explicitly asks.
4. Do not invent academic events, deadlines, notes, or study sessions.
5. For study plans, use saved events, notes, and availability.
6. Only mention study topics supported by saved notes.
7. Treat quizzes as milestones toward later exams.
8. If a requested session date conflicts with a quiz or exam,
   look for an alternative using find_available_study_slot.
9. Keep responses concise and practical.
`;

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "StudyMate web API is running.",
  });
});

app.get("/api/dashboard", async (_req, res) => {
  let mcpClient: Client | undefined;

  try {
    mcpClient = new Client({
      name: "studymate-dashboard",
      version: "1.0.0",
    });

    const transport = new StreamableHTTPClientTransport(
      new URL("http://localhost:3000/mcp")
    );

    await mcpClient.connect(transport);

    const [events, tasks, sessions] = await Promise.all([
      mcpClient.callTool({
        name: "list_events",
        arguments: {},
      }),
      mcpClient.callTool({
        name: "list_tasks",
        arguments: {},
      }),
      mcpClient.callTool({
        name: "list_study_sessions",
        arguments: {},
      }),
    ]);

    res.json({
      events: events.content,
      tasks: tasks.content,
      sessions: sessions.content,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({
      error: "Couldn't load dashboard data from the MCP server.",
    });
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (error) {
        console.error("Error closing dashboard MCP client:", error);
      }
    }
  }
});


app.post("/api/chat", async (req, res) => {
  const userMessage = req.body?.message;

  if (
    typeof userMessage !== "string" ||
    userMessage.trim().length === 0
  ) {
    res.status(400).json({
      error: "Please provide a message.",
    });
    return;
  }

  let mcpClient: Client | undefined;

  try {
    mcpClient = new Client({
      name: "studymate-web-agent",
      version: "1.0.0",
    });

    const transport = new StreamableHTTPClientTransport(
      new URL("http://localhost:3000/mcp")
    );

    await mcpClient.connect(transport);

    const toolResult = await mcpClient.listTools();

    const functionDeclarations = toolResult.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      parametersJsonSchema: tool.inputSchema,
    }));

    const contents: any[] = [
      {
        role: "user",
        parts: [{ text: userMessage.trim() }],
      },
    ];

    let finalReply = "";

    for (let round = 0; round < 8; round++) {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{ functionDeclarations }],
          maxOutputTokens: 700,
        },
      });

      const modelParts =
        response.candidates?.[0]?.content?.parts ?? [];

      contents.push({
        role: "model",
        parts: modelParts,
      });

      const functionCalls = response.functionCalls;

      if (!functionCalls || functionCalls.length === 0) {
        finalReply =
          response.text ?? "I couldn't generate a response.";
        break;
      }

      const toolResponseParts: any[] = [];

      for (const call of functionCalls) {
        if (!call.name) {
          continue;
        }

        const result = await mcpClient.callTool({
          name: call.name,
          arguments: call.args ?? {},
        });

        toolResponseParts.push({
          functionResponse: {
            name: call.name,
            response: result,
          },
        });
      }

      contents.push({
        role: "user",
        parts: toolResponseParts,
      });
    }

    if (!finalReply) {
      finalReply =
        "I reached the tool-call limit. Please try a more specific request.";
    }

    res.json({ reply: finalReply });
  } catch (error) {
    console.error("StudyMate chat error:", error);

    res.status(500).json({
      error:
        "StudyMate couldn't process that request. Check that Gemini and the MCP server are available.",
    });
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (error) {
        console.error("Error closing MCP client:", error);
      }
    }
  }
});

app.listen(port, () => {
  console.log(
    `StudyMate web API running at http://localhost:${port}`
  );
});