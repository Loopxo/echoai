import { createEchoAIAppState, jsonResponse } from "../../../lib/echoai-api";

export function GET() {
  return jsonResponse(createEchoAIAppState());
}

