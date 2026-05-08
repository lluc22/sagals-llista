defmodule Sagals.Events do
  import Ecto.Query
  alias Sagals.Repo
  alias Sagals.Events.{Event, Bus, Participant, ParticipantTrip}

  # --- Events ---

  def list_events do
    Repo.all(from e in Event, order_by: [desc: e.inserted_at])
  end

  def get_event!(id), do: Repo.get!(Event, id)

  def get_event_by_slug!(slug), do: Repo.get_by!(Event, slug: slug)

  def get_event_by_access_token(token) do
    case Repo.get_by(Event, access_token: token) do
      nil -> {:error, :not_found}
      event -> {:ok, event}
    end
  end

  def create_event(attrs) do
    %Event{}
    |> Event.changeset(attrs)
    |> Repo.insert()
  end

  def update_event(event, attrs) do
    event
    |> Event.changeset(attrs)
    |> Repo.update()
  end

  def activate_event(event) do
    event
    |> Event.activate_changeset()
    |> Repo.update()
  end

  def deactivate_event(event) do
    event
    |> Event.deactivate_changeset()
    |> Repo.update()
  end

  def delete_event(event) do
    Repo.delete(event)
  end

  # --- Buses ---

  def list_buses(event) do
    Repo.all(from b in Bus, where: b.event_id == ^event.id, order_by: b.order)
  end

  def get_bus!(id), do: Repo.get!(Bus, id)

  def create_bus(event, attrs) do
    %Bus{}
    |> Bus.changeset(stringify_merge(attrs, %{event_id: event.id}))
    |> Repo.insert()
  end

  def update_bus(bus, attrs) do
    bus
    |> Bus.changeset(attrs)
    |> Repo.update()
  end

  def delete_bus(bus), do: Repo.delete(bus)

  # --- Participants ---

  def list_participants(event) do
    Repo.all(
      from p in Participant, where: p.event_id == ^event.id, order_by: [p.last_name, p.first_name]
    )
  end

  def list_participants_with_trips(event) do
    Repo.all(
      from p in Participant,
        where: p.event_id == ^event.id,
        preload: [participant_trips: :bus],
        order_by: [p.last_name, p.first_name]
    )
  end

  def get_participant!(id), do: Repo.get!(Participant, id)

  def update_participant(participant, attrs) do
    participant
    |> Participant.changeset(attrs)
    |> Repo.update()
  end

  def create_participant(event, attrs) do
    %Participant{}
    |> Participant.changeset(stringify_merge(attrs, %{event_id: event.id}))
    |> Repo.insert()
  end

  def delete_participant(participant), do: Repo.delete(participant)

  def replace_participant_trips(participant, trips_data) do
    Repo.transaction(fn ->
      Repo.delete_all(from t in ParticipantTrip, where: t.participant_id == ^participant.id)

      Enum.each(trips_data, fn t ->
        %ParticipantTrip{}
        |> ParticipantTrip.changeset(%{
          participant_id: participant.id,
          bus_id: to_int(t["bus_id"]),
          direction: t["direction"]
        })
        |> Repo.insert!()
      end)

      Repo.preload(participant, [participant_trips: :bus], force: true)
    end)
  end

  defp to_int(v) when is_integer(v), do: v
  defp to_int(v), do: String.to_integer(to_string(v))

  def import_participants(event, rows, transport_mapping) do
    Repo.transaction(fn ->
      Enum.each(rows, fn row ->
        {:ok, participant} =
          %Participant{}
          |> Participant.changeset(stringify_merge(row, %{event_id: event.id}))
          |> Repo.insert()

        trips = build_trips(participant.id, row.transport_raw, transport_mapping)
        Enum.each(trips, &Repo.insert!(&1))
      end)

      length(rows)
    end)
  end

  defp build_trips(participant_id, transport_raw, transport_mapping) do
    trimmed = String.trim(transport_raw)

    rule =
      Map.get(transport_mapping, transport_raw) ||
        Map.get(transport_mapping, trimmed) ||
        Enum.find_value(transport_mapping, fn {k, v} ->
          if String.trim(k) == trimmed, do: v
        end)

    if is_nil(rule) || !rule["usesBus"] do
      []
    else
      Enum.flat_map(rule["buses"], fn entry ->
        bus_id =
          if is_integer(entry["busId"]),
            do: entry["busId"],
            else: String.to_integer(entry["busId"])

        directions = expand_direction(entry["direction"])

        Enum.map(directions, fn dir ->
          ParticipantTrip.changeset(%ParticipantTrip{}, %{
            participant_id: participant_id,
            bus_id: bus_id,
            direction: dir
          })
        end)
      end)
    end
  end

  defp expand_direction(dir), do: [dir]

  def import_form_participants(event, rows) do
    Repo.transaction(fn ->
      Enum.each(rows, fn row ->
        {:ok, participant} =
          %Participant{}
          |> Participant.changeset(stringify_merge(row, %{event_id: event.id}))
          |> Repo.insert()

        Enum.each(row.trips_data, fn trip ->
          %ParticipantTrip{}
          |> ParticipantTrip.changeset(%{
            participant_id: participant.id,
            bus_id:
              if(is_integer(trip["bus_id"]),
                do: trip["bus_id"],
                else: String.to_integer(to_string(trip["bus_id"]))
              ),
            direction: trip["direction"]
          })
          |> Repo.insert!()
        end)
      end)

      length(rows)
    end)
  end

  defp stringify_merge(base, extras) do
    stringified = Map.new(base, fn {k, v} -> {to_string(k), v} end)
    Map.merge(stringified, Map.new(extras, fn {k, v} -> {to_string(k), v} end))
  end

  # --- Participant Trips ---

  def list_trips_for_bus(bus_id, direction) do
    Repo.all(
      from pt in ParticipantTrip,
        where: pt.bus_id == ^bus_id and pt.direction == ^direction,
        preload: [:participant, :attendance]
    )
  end
end
