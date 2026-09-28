import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createRental, listRentals, listRentalsByDate, listRentalsByDateRange, rentalCreateSchema } from "@/server/services/room-rentals";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin");
    const params = new URL(request.url).searchParams;
    const from = params.get("from");
    const to = params.get("to");
    if (from || to) {
      if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
        return { status: 400, body: { error: "Ungültiger Datumsbereich." } };
      }
      return { body: { rentals: await listRentalsByDateRange(from, to) } };
    }
    const date = params.get("date");
    const rentals = date ? await listRentalsByDate(date) : await listRentals();
    return { body: { rentals } };
  });
}

export async function POST(request: Request) {
  return jsonRoute(async () => {
    const actor = await requireRole("office", "admin");
    const input = rentalCreateSchema.parse(await readJson(request));
    return { status: 201, body: { rental: await createRental(actor, input) } };
  });
}
