import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearAdminToken } from "../lib/api";
import type { Event } from "../types";
import { CalendarDays, Plus, LogOut, Users } from "lucide-react";

export default function EventList() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  function handleLogout() {
    clearAdminToken();
    navigate("/login");
  }

  useEffect(() => {
    api
      .get<{ data: Event[] }>("/api/events")
      .then((res) => setEvents(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1 bg-sagals" />
      <div className="p-4">
        <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-sagals">Sagals Llista</h1>
          <div className="flex items-center gap-2">
            <Link
              to="/events/new"
              className="flex items-center gap-2 bg-sagals text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              <Plus size={16} /> Nova actuació
            </Link>
            <Link
              to="/users"
              className="flex items-center justify-center w-9 h-9 text-gray-400 hover:text-gray-600 rounded-lg"
              title="Usuaris"
            >
              <Users size={18} />
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-9 h-9 text-gray-400 hover:text-gray-600 rounded-lg"
              title="Tancar sessió"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {loading && (
          <p className="text-gray-500 text-center py-8">Carregant...</p>
        )}

        {!loading && events.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <CalendarDays size={48} className="mx-auto mb-3 opacity-40" />
            <p>Encara no hi ha actuacions</p>
          </div>
        )}

        <div className="space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}/admin`}
              className="block bg-white rounded-xl p-4 shadow-sm border border-sagals/10 hover:border-sagals/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{event.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(event.date).toLocaleDateString("ca-ES", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    event.status === "active"
                      ? "bg-green-100 text-green-700"
                      : event.status === "closed"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {event.status === "active"
                    ? "Actiu"
                    : event.status === "closed"
                      ? "Tancat"
                      : "Esborrany"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
