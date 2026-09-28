import { requireRole } from "@/lib/auth";
import { jsonRoute, readJson } from "@/server/http";
import { createRental, listRentals, listRentalsByDate, rentalCreateSchema } from "@/server/services/room-rentals";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    await requireRole("office", "admin");
    const date = new URL(request.url).searchParams.get("date");
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
