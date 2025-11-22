import type { InstallationInstructionsResult } from "@/lib/airalo/installInstructions";
import type { SimShareInfo, SimStatusInfo } from "@/lib/airalo";

export interface InstallationInstructionsPayload {
  instructions: InstallationInstructionsResult;
  simStatus: SimStatusInfo | null;
  recycled: boolean;
  recycledAt: string | null;
  share: SimShareInfo | null;
}
