defmodule SagalsWeb.ParticipantController do
  use SagalsWeb, :controller

  alias Sagals.Events

  def index(conn, %{"event_id" => event_id}) do
    event = Events.get_event!(event_id)
    participants = Events.list_participants_with_trips(event)
    json(conn, %{data: Enum.map(participants, &serialize/1)})
  end

  def import(conn, %{"event_id" => event_id, "rows" => rows, "column_mapping" => col_map, "transport_mapping" => mapping}) do
    event = Events.get_event!(event_id)

    rows_parsed =
      rows
      |> Enum.map(fn r ->
        %{
          first_name:    col(r, col_map["firstName"]),
          last_name:     col(r, col_map["lastName"]),
          last_name2:    col(r, col_map["lastName2"]),
          nickname:      col(r, col_map["nickname"]),
          transport_raw: col(r, col_map["transport"]),
          observations:  col(r, col_map["observations"]),
          companions:    col(r, col_map["companions"])
        }
      end)
      |> Enum.reject(fn row -> row.first_name == "" and row.last_name == "" end)

    case Events.import_participants(event, rows_parsed, mapping) do
      {:ok, count} ->
        conn |> put_status(:created) |> json(%{imported: count})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  defp col(row, idx) when is_integer(idx) and idx >= 0 do
    row |> Enum.at(idx, "") |> to_string() |> String.trim()
  end
  defp col(_row, _), do: ""

  def create(conn, %{"event_id" => event_id} = params) do
    event = Events.get_event!(event_id)
    attrs = Map.take(params, ["first_name", "last_name", "last_name2", "nickname", "transport_raw", "observations", "companions"])
    case Events.create_participant(event, attrs) do
      {:ok, p} ->
        p = Sagals.Repo.preload(p, :participant_trips)
        conn |> put_status(:created) |> json(%{data: serialize(p)})
      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    participant = Events.get_participant!(id)

    case Events.update_participant(participant, Map.drop(params, ["id", "trips"])) do
      {:ok, p} ->
        if Map.has_key?(params, "trips") do
          {:ok, _} = Events.replace_participant_trips(p, params["trips"])
        end
        p = Sagals.Repo.preload(p, [participant_trips: :bus], force: true)
        json(conn, %{data: serialize(p)})
      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def delete(conn, %{"id" => id}) do
    participant = Events.get_participant!(id)
    {:ok, _} = Events.delete_participant(participant)
    send_resp(conn, :no_content, "")
  end

  defp serialize(p) do
    trips = if Ecto.assoc_loaded?(p.participant_trips) do
      p.participant_trips
      |> Enum.sort_by(& &1.bus.departure_time)
      |> Enum.map(fn t ->
        %{id: t.id, bus_id: t.bus_id, direction: t.direction}
      end)
    else
      []
    end

    %{
      id: p.id,
      event_id: p.event_id,
      first_name: p.first_name,
      last_name: p.last_name,
      last_name2: p.last_name2,
      nickname: p.nickname,
      transport_raw: p.transport_raw,
      observations: p.observations,
      companions: p.companions,
      reviewed: p.reviewed,
      trips: trips
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
