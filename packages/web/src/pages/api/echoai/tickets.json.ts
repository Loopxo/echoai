import { jsonResponse } from "../../../lib/echoai-api";
import { webTicketCoverage, webTicketSummary } from "../../../lib/echoai-ticket-coverage";

export function GET() {
  return jsonResponse({
    summary: webTicketSummary,
    tickets: webTicketCoverage,
  });
}

