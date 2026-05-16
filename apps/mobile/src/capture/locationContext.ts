export type LocationPrecision = "approximate" | "precise";

export interface LocationContextCommand {
  id: string;
  precision: LocationPrecision;
  prompt: string;
  status: "pending-permission" | "approved" | "denied" | "shared";
}

export function approveLocationContextCommand(command: LocationContextCommand, precision: LocationPrecision): LocationContextCommand {
  return { ...command, precision, status: "approved" };
}
