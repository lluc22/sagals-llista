defmodule SagalsWeb.ListController do
  use SagalsWeb, :controller

  alias Sagals.{Attendance, Events}
  alias Sagals.Events.ParticipantTrip
  alias Sagals.Repo

  def buses(conn, _params) do
    event = conn.assigns.current_event
    buses = Events.list_buses(event)
    json(conn, %{data: Enum.map(buses, fn b ->
      %{id: b.id, label: b.label, departure_time: b.departure_time, direction: b.direction, order: b.order}
    end)})
  end

  def participants(conn, %{"bus_id" => bus_id, "direction" => direction}) do
    results = Attendance.list_for_bus(String.to_integer(bus_id), direction)

    json(conn, %{data: Enum.map(results, fn %{trip: trip, participant: p, attendance: att} ->
      %{
        trip_id: trip.id,
        participant: %{
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          last_name2: p.last_name2,
          nickname: p.nickname
        },
        attendance: %{
          id: att.id,
          status: att.status,
          marked_at: att.marked_at,
          marked_by: att.marked_by
        }
      }
    end)})
  end

  def mark(conn, %{"trip_id" => trip_id, "status" => status} = params) do
    marked_by = params["marked_by"]
    trip = Repo.get!(ParticipantTrip, trip_id)

    case Attendance.mark_attendance(trip_id, status, marked_by) do
      {:ok, att} ->
        payload = %{
          trip_id: att.participant_trip_id,
          status: att.status,
          marked_at: att.marked_at,
          marked_by: att.marked_by
        }

        SagalsWeb.Endpoint.broadcast("attendance:#{trip.bus_id}:#{trip.direction}", "update", payload)
        json(conn, %{data: payload})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def castellers(conn, _params) do
    api_key = Application.get_env(:sagals, :tenimaleta_api_key, "")

    case Req.get("https://sagals-api.tenimaleta.com/api/castellersInfo",
           [headers: [{"x-api-key", api_key}]] ++ req_options()) do
      {:ok, %{status: 200, body: body}} ->
        result =
          body
          |> Map.values()
          |> Enum.reject(&(&1["hidden"] == 1))
          |> Enum.map(&%{id: &1["id"], mote: &1["mote"]})

        json(conn, %{data: result})

      _ ->
        conn |> put_status(:bad_gateway) |> json(%{error: "Cannot fetch castellers"})
    end
  end

  def profile_pic(conn, %{"id" => id}) do
    case Req.get("https://sagals-api.tenimaleta.com/api/profile_pic/#{id}", req_options()) do
      {:ok, %{status: 200, body: %{"base64" => data_uri}}} ->
        json(conn, %{base64: data_uri})

      _ ->
        conn |> put_status(:not_found) |> json(%{error: "Photo not found"})
    end
  end

  defp req_options, do: Application.get_env(:sagals, :req_options, [])

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
