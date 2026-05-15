import { projects } from "../../../lib/echoai-app-data";
import { echoaiWebApiVersion, jsonResponse } from "../../../lib/echoai-api";

export function GET() {
  return jsonResponse({
    version: echoaiWebApiVersion,
    projects,
  });
}

