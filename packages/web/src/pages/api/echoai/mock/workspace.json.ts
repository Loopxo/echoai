import { jsonResponse } from "../../../../lib/echoai-api";
import { privateServiceState } from "../../../../lib/echoai-private-services";

export function GET() {
  return jsonResponse(privateServiceState.workspace);
}

