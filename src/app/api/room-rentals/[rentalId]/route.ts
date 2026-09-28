import { requireRole } from "@/lib/auth";
import { jsonRoute } from "@/server/http";
import { deleteRental } from "@/server/services/room-rentals";

export async function DELETE(_request: Request, context: { params: Promise<{ rentalId: string }> }) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const { rentalId } = await context.params;
    await deleteRental(actor, rentalId);
    return { status: 200, body: { ok: true } };
  });
}
