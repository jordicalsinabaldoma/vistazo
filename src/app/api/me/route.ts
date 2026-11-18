import { currentGuest, currentUser } from "@/lib/auth";
import { handle, ok } from "@/lib/http";

export const GET = handle(async () => {
  const user = await currentUser();
  const guest = await currentGuest();
  return ok({
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    guest: guest ? { name: guest.name, projectId: guest.projectId, reviewId: guest.reviewId ?? null } : null,
  });
});
