import { jsonResponse } from "../../../lib/echoai-api";
import { privateServiceState } from "../../../lib/echoai-private-services";
import { webTicketSummary } from "../../../lib/echoai-ticket-coverage";

export function GET() {
  return jsonResponse({
    ticketSummary: webTicketSummary,
    services: privateServiceState,
  });
}

