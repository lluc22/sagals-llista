defmodule Sagals.EventsTest do
  use Sagals.DataCase, async: true

  alias Sagals.Events

  defp event_attrs(overrides \\ %{}) do
    Map.merge(%{name: "Festa Major", date: ~D[2025-06-01], slug: "festa-major-#{System.unique_integer()}"}, overrides)
  end

  describe "create_event/1" do
    test "creates an event with valid data" do
      assert {:ok, event} = Events.create_event(event_attrs())
      assert event.name == "Festa Major"
      assert event.status == "draft"
      assert event.access_token == nil
    end

    test "rejects duplicate slug" do
      {:ok, _} = Events.create_event(event_attrs(%{slug: "unique-slug"}))
      assert {:error, changeset} = Events.create_event(event_attrs(%{slug: "unique-slug"}))
      assert %{slug: [_]} = errors_on(changeset)
    end

    test "rejects missing required fields" do
      assert {:error, changeset} = Events.create_event(%{})
      assert %{name: [_], date: [_], slug: [_]} = errors_on(changeset)
    end
  end

  describe "activate_event/1" do
    test "sets status to active and generates access_token" do
      {:ok, event} = Events.create_event(event_attrs())
      assert {:ok, activated} = Events.activate_event(event)
      assert activated.status == "active"
      assert activated.access_token != nil
      assert String.length(activated.access_token) > 20
    end

    test "regenerates token on re-activation" do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, first} = Events.activate_event(event)
      {:ok, second} = Events.activate_event(first)
      assert first.access_token != second.access_token
    end
  end

  describe "get_event_by_access_token/1" do
    test "returns event for valid token" do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, activated} = Events.activate_event(event)
      assert {:ok, found} = Events.get_event_by_access_token(activated.access_token)
      assert found.id == event.id
    end

    test "returns error for invalid token" do
      assert {:error, :not_found} = Events.get_event_by_access_token("invalid-token")
    end
  end

  describe "buses" do
    setup do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, event: event}
    end

    test "create_bus/2 creates a bus for an event", %{event: event} do
      assert {:ok, bus} = Events.create_bus(event, %{label: "Bus Vic", direction: "anada", order: 1})
      assert bus.label == "Bus Vic"
      assert bus.event_id == event.id
    end

    test "list_buses/1 returns buses for the event", %{event: event} do
      {:ok, _} = Events.create_bus(event, %{label: "Bus A", direction: "anada", order: 1})
      {:ok, _} = Events.create_bus(event, %{label: "Bus B", direction: "tornada", order: 2})
      buses = Events.list_buses(event)
      assert length(buses) == 2
    end

    test "update_bus/2 updates bus fields", %{event: event} do
      {:ok, bus} = Events.create_bus(event, %{label: "Old Label", direction: "anada", order: 1})
      assert {:ok, updated} = Events.update_bus(bus, %{label: "New Label"})
      assert updated.label == "New Label"
    end

    test "delete_bus/1 removes the bus", %{event: event} do
      {:ok, bus} = Events.create_bus(event, %{label: "To Delete", direction: "anada", order: 1})
      assert {:ok, _} = Events.delete_bus(bus)
      assert Events.list_buses(event) == []
    end
  end

  describe "import_participants/3" do
    setup do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, bus1} = Events.create_bus(event, %{label: "Bus Vic", direction: "anada", order: 1})
      {:ok, bus2} = Events.create_bus(event, %{label: "Bus Manlleu", direction: "anada", order: 2})
      {:ok, event: event, bus1: bus1, bus2: bus2}
    end

    test "creates participants and trips from import data", %{event: event, bus1: bus1} do
      transport_mapping = %{
        "Bus Vic" => %{"usesBus" => true, "buses" => [%{"busId" => to_string(bus1.id), "direction" => "anada"}]}
      }

      rows = [
        %{first_name: "Anna", last_name: "Vila", last_name2: "", nickname: "", transport_raw: "Bus Vic"},
        %{first_name: "Pau", last_name: "Serra", last_name2: "", nickname: "", transport_raw: "Bus Vic"}
      ]

      assert {:ok, count} = Events.import_participants(event, rows, transport_mapping)
      assert count == 2

      participants = Events.list_participants(event)
      assert length(participants) == 2

      trips = Events.list_trips_for_bus(bus1.id, "anada")
      assert length(trips) == 2
    end

    test "anada direction creates one trip per participant", %{event: event, bus1: bus1} do
      transport_mapping = %{
        "Bus" => %{"usesBus" => true, "buses" => [%{"busId" => to_string(bus1.id), "direction" => "anada"}]}
      }

      rows = [%{first_name: "Anna", last_name: "Vila", last_name2: "", nickname: "", transport_raw: "Bus"}]

      {:ok, _} = Events.import_participants(event, rows, transport_mapping)

      anada_trips = Events.list_trips_for_bus(bus1.id, "anada")
      tornada_trips = Events.list_trips_for_bus(bus1.id, "tornada")
      assert length(anada_trips) == 1
      assert length(tornada_trips) == 0
    end

    test "participant with no bus gets no trips", %{event: event} do
      transport_mapping = %{
        "Propi" => %{"usesBus" => false, "buses" => []}
      }

      rows = [%{first_name: "Joan", last_name: "Pla", last_name2: "", nickname: "", transport_raw: "Propi"}]

      {:ok, _} = Events.import_participants(event, rows, transport_mapping)
      participants = Events.list_participants(event)
      assert length(participants) == 1

      trips = Events.list_participants_with_trips(event)
      assert trips |> hd() |> Map.get(:participant_trips) == []
    end
  end
end
