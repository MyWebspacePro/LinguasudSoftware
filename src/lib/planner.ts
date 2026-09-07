/** Shared planner shapes. These contain no fallback or demonstration data. */
export type UserRole = "office" | "teacher" | "participant";

export type Room = {
  id: string;
  name: string;
  capacity: number;
  locationId: string;
};

export type Location = {
  id: string;
  name: string;
  address: string;
  rooms: Room[];
};

export function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const rest = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${rest}`;
}
