import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";

async function main() {
  const client = new Client({
    name: "studymate-agent",
    version: "1.0.0",
  });

  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:3000/mcp")
  );

  await client.connect(transport);

  console.log("Connected to StudyMate MCP server.");

  const result = await client.listTools();

  console.log("Available tools:");

  for (const tool of result.tools) {
    console.log(`- ${tool.name}`);
  }

  await client.close();
}

main().catch(console.error);