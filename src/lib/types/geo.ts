export type Location = {
  id: string;
  name: string;
  address: string;
  sortOrder: number;
  active: boolean;
};

export type Room = {
  id: string;
  locationId: string;
  locationName: string;
  name: string;
  floor: string | null;
  capacity: number;
  active: boolean;
};
