import { GoogleGenAI } from "@google/genai";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_INSTRUCTION = `
You are StudyMate, an AI study assistant.

The current date is October 7, 2026.

You have access to StudyMate tools for tasks, academic events, notes,
study sessions, and study availability.

IMPORTANT RULES:

1. Only modify the user's data when the user explicitly asks you to
   add, delete, or change something.

2. If the user says they have an exam, quiz, assignment, or other event
   and asks you to make a study plan, DO NOT automatically add that
   event to the database. Use the existing events instead.

3. Before creating a new academic event, the user must explicitly ask
   you to add/save/create that event.

4. Do not invent dates. If the user gives a month and day without a year,
   use the current year (2026) when that date has not already passed.
   If the intended year is genuinely ambiguous, ask the user.

5. Use StudyMate tools whenever they are relevant.

6. Never claim an action was completed unless the corresponding tool
   actually completed it.

7. When creating a study plan, use the available events, notes, and
   study availability rather than inventing information.

8. When presenting a study plan, only mention study topics that are
   explicitly supported by the saved notes returned by the tools.

9. Do NOT invent exam topics, chapters, formulas, concepts, or material
   that does not appear in the user's saved notes.

10. If the saved notes only cover some of the material, clearly say that
    the current plan is based only on those saved notes.

11. Treat quizzes as milestones toward later exams. Preparation for a
    quiz should also contribute to preparation for the exam when the
    available material supports that.

12. Do not claim that a session is specifically for a topic unless that
    topic is supported by the corresponding saved note.

13. When reporting an existing study plan, use the actual sessions
    returned by the tool. Do not invent additional sessions.

14. Keep responses concise and practical. Mention important dates,
    available study material, and scheduled sessions.
`;

async function main() {
  const mcpClient = new Client({
    name: "studymate-agent",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3000/mcp")
  );

  await mcpClient.connect(transport);

  console.log("Connected to StudyMate MCP server.");

  const toolResult = await mcpClient.listTools();

  const functionDeclarations = toolResult.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    parametersJsonSchema: tool.inputSchema,
  }));

  const rl = createInterface({ input, output });
  const userMessage = await rl.question("You: ");
  rl.close();

  const contents: any[] = [
    {
      role: "user",
      parts: [{ text: userMessage }],
    },
  ];

  while (true) {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [
          {
            functionDeclarations,
          },
        ],
        maxOutputTokens: 500,
      },
    });

    const modelParts = response.candidates?.[0]?.content?.parts ?? [];

    contents.push({
      role: "model",
      parts: modelParts,
    });

    const functionCalls = response.functionCalls;

    if (!functionCalls || functionCalls.length === 0) {
      console.log("\nStudyMate:", response.text);
      break;
    }

    console.log("\nGemini requested tool calls:");

    const toolResponseParts: any[] = [];

    for (const call of functionCalls) {
      if (!call.name) {
        continue;
      }

      console.log(`- ${call.name}`, call.args);

      const result = await mcpClient.callTool({
        name: call.name,
        arguments: call.args ?? {},
      });

      console.log(`\nMCP result from ${call.name}:`, result);

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

  await mcpClient.close();
}

main().catch(console.error);