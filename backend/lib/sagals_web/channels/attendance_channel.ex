defmodule SagalsWeb.AttendanceChannel do
  use Phoenix.Channel

  # topic: "attendance:{bus_id}:{direction}"
  def join("attendance:" <> _rest, _params, socket) do
    {:ok, socket}
  end

  def handle_in("mark", %{"trip_id" => trip_id, "status" => status} = params, socket) do
    marked_by = params["marked_by"]

    case Sagals.Attendance.mark_attendance(trip_id, status, marked_by) do
      {:ok, att} ->
        payload = %{
          trip_id: att.participant_trip_id,
          status: att.status,
          marked_at: att.marked_at,
          marked_by: att.marked_by
        }

        broadcast!(socket, "update", payload)
        {:reply, {:ok, payload}, socket}

      {:error, changeset} ->
        {:reply, {:error, %{errors: format_errors(changeset)}}, socket}
    end
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
