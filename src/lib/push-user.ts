import "server-only";
import { sendToUsers, type PushPayload } from "@/lib/push";

export function notifyUser(userId: string, payload: PushPayload) {
  return sendToUsers([userId], payload);
}
