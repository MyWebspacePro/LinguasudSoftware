"use client";

import { useEffect, useMemo, useState } from "react";

type Location = { id: string; name: string; address: string; sort_order: number };
type Room = { id: string; name: string; capacity: number; active?: boolean; location_id: string; location_name: string; location_address?: string; courses?: Array<{ id: string; code: string; language: string; level: string; status: string }> };

function errorMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

export function RoomsWorkspace({ onOpenCourse }: { onOpenCourse?: (courseId: string) => void } = {}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [locationsResponse, roomsResponse] = await Promise.all([
        fetch("/api/locations", { credentials: "same-origin" }),
        // The administration needs inactive rooms as well so they can be
        // reactivated. The dashboard planner keeps using the active-only
        // default endpoint.
        fetch("/api/rooms?includeInactive=true", { credentials: "same-origin" }),
      ]);
      const [locationsPayload, roomsPayload] = await Promise.all([locationsResponse.json(), roomsResponse.json()]);
      if (!locationsResponse.ok) throw new Error(errorMessage(locationsPayload, "Standorte konnten nicht geladen werden."));
      if (!roomsResponse.ok) throw new Error(errorMessage(roomsPayload, "Räume konnten nicht geladen werden."));
      setLocations((locationsPayload as { locations: Location[] }).locations);
      setRooms((roomsPayload as { rooms: Room[] }).rooms);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Räume konnten nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => void load()); }, []);

  const roomsByLocation = useMemo(() => {
    const grouped = new Map<string, Room[]>();
    rooms.forEach((room) => grouped.set(room.location_id, [...(grouped.get(room.location_id) ?? []), room]));
    return grouped;
  }, [rooms]);

  async function createLocation(formData: FormData) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/locations", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), address: formData.get("address"), sortOrder: Number(formData.get("sortOrder")) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Standort konnte nicht angelegt werden."));
      setIsLocationDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Standort konnte nicht angelegt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function createRoom(formData: FormData) {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/rooms", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: formData.get("locationId"), name: formData.get("name"), capacity: Number(formData.get("capacity")) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Raum konnte nicht angelegt werden."));
      setIsRoomDialogOpen(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Raum konnte nicht angelegt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateLocation(formData: FormData) {
    if (!editingLocation) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/locations/${editingLocation.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.get("name"), address: formData.get("address"), sortOrder: Number(formData.get("sortOrder")) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Standort konnte nicht geändert werden."));
      setEditingLocation(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Standort konnte nicht geändert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateRoom(formData: FormData) {
    if (!editingRoom) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/rooms/${editingRoom.id}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: formData.get("locationId"), name: formData.get("name"), capacity: Number(formData.get("capacity")), active: formData.get("active") === "on" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(errorMessage(payload, "Raum konnte nicht geändert werden."));
      setEditingRoom(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Raum konnte nicht geändert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return <section className="management-preview" aria-labelledby="rooms-title">
    <div className="preview-intro"><p className="eyebrow">Raumverwaltung</p><h2 id="rooms-title">Standorte & Räume <span>{rooms.length}</span></h2><p>Das Büro pflegt Standorte, Räume und Kapazitäten. Sie stehen danach direkt für die Kurs- und Lektionsplanung bereit.</p><div className="workspace-actions"><button className="primary-button" onClick={() => setIsRoomDialogOpen(true)} type="button">+ Raum anlegen</button><button className="quiet-button" onClick={() => setIsLocationDialogOpen(true)} type="button">+ Standort anlegen</button></div></div>
    {error ? <p className="planner-state" role="alert">{error}</p> : null}
    {isLoading ? <p className="planner-state">Räume werden geladen …</p> : <div className="preview-grid">{locations.length === 0 ? <p className="planner-state">Noch keine Standorte angelegt.</p> : locations.map((location) => <article key={location.id}><span>Standort {location.sort_order}</span><h3>{location.name}</h3><p>{location.address}</p><p className="course-schedule-summary">{(roomsByLocation.get(location.id) ?? []).map((room) => `${room.name} · ${room.capacity} Plätze`).join(" · ") || "Noch keine Räume angelegt."}</p><button className="quiet-button" onClick={() => setEditingLocation(location)} type="button">Standort bearbeiten</button></article>)}</div>}
    {isLocationDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createLocation} className="attendance-dialog" aria-labelledby="create-location-title"><button aria-label="Standortformular schliessen" className="dialog-close" onClick={() => setIsLocationDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-location-title">Neuer Standort</h2><div className="form-grid"><label>Name<input name="name" required /></label><label>Adresse<input name="address" required /></label><label>Reihenfolge<input defaultValue={locations.length + 1} min="1" name="sortOrder" required type="number" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setIsLocationDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "Wird gespeichert …" : "Standort speichern"}</button></div></form></div> : null}
    {editingLocation ? <div className="dialog-backdrop" role="presentation"><form action={updateLocation} className="attendance-dialog" aria-labelledby="edit-location-title"><button aria-label="Standortbearbeitung schliessen" className="dialog-close" onClick={() => setEditingLocation(null)} type="button">×</button><p className="eyebrow">Standortverwaltung</p><h2 id="edit-location-title">{editingLocation.name} bearbeiten</h2><div className="form-grid"><label>Name<input defaultValue={editingLocation.name} name="name" required /></label><label>Adresse<input defaultValue={editingLocation.address} name="address" required /></label><label>Reihenfolge<input defaultValue={editingLocation.sort_order} min="1" name="sortOrder" required type="number" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setEditingLocation(null)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "Wird gespeichert …" : "Standort speichern"}</button></div></form></div> : null}
    {isRoomDialogOpen ? <div className="dialog-backdrop" role="presentation"><form action={createRoom} className="attendance-dialog" aria-labelledby="create-room-title"><button aria-label="Raumformular schliessen" className="dialog-close" onClick={() => setIsRoomDialogOpen(false)} type="button">×</button><p className="eyebrow">Büro</p><h2 id="create-room-title">Neuer Raum</h2><div className="form-grid"><label>Standort<select defaultValue="" name="locationId" required><option disabled value="">Bitte wählen</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label>Raumname<input name="name" required /></label><label>Kapazität<input defaultValue="12" min="1" name="capacity" required type="number" /></label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setIsRoomDialogOpen(false)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving || locations.length === 0} type="submit">{isSaving ? "Wird gespeichert …" : "Raum speichern"}</button></div></form></div> : null}
    {rooms.length > 0 ? <section className="room-catalog" aria-label="Räume bearbeiten"><div className="room-catalog__heading"><strong>Räume</strong><span>{rooms.length}</span></div>{rooms.map((room) => <div className="room-catalog__row" key={room.id}><div><strong>{room.location_name} · {room.name}</strong><span>{room.capacity} Plätze{room.active === false ? " · deaktiviert" : ""}</span>{room.courses?.length ? <span className="room-course-links">Kurse: {room.courses.map((course) => <button className="course-link" key={course.id} onClick={() => onOpenCourse?.(course.id)} type="button">{course.code}</button>)}</span> : null}</div><button className="quiet-button" onClick={() => setEditingRoom(room)} type="button">Raum bearbeiten</button></div>)}</section> : null}
    {editingRoom ? <div className="dialog-backdrop" role="presentation"><form action={updateRoom} className="attendance-dialog" aria-labelledby="edit-room-title"><button aria-label="Raumbearbeitung schliessen" className="dialog-close" onClick={() => setEditingRoom(null)} type="button">×</button><p className="eyebrow">Raumverwaltung</p><h2 id="edit-room-title">{editingRoom.name} bearbeiten</h2><div className="form-grid"><label>Standort<select defaultValue={editingRoom.location_id} name="locationId" required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label>Raumname<input defaultValue={editingRoom.name} name="name" required /></label><label>Kapazität<input defaultValue={editingRoom.capacity} min="1" name="capacity" required type="number" /></label><label className="checkbox-field"><input defaultChecked={editingRoom.active !== false} name="active" type="checkbox" />Aktiver Raum</label></div><div className="dialog-actions"><button className="quiet-button" onClick={() => setEditingRoom(null)} type="button">Abbrechen</button><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "Wird gespeichert …" : "Raum speichern"}</button></div></form></div> : null}
  </section>;
}
