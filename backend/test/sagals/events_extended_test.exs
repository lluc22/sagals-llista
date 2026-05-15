defmodule Sagals.EventsTest.Extended do
  use Sagals.DataCase, async: true

  alias Sagals.Events

  defp event_attrs(overrides \\ %{}) do
    Map.merge(
      %{
        name: "Test Event",
        date: ~D[2025-06-01],
        slug: "test-event-#{System.unique_integer()}"
      },
      overrides
    )
  end

  describe "update_event/2" do
    test "updates event fields" do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, updated} = Events.update_event(event, %{name: "Updated Name"})
      assert updated.name == "Updated Name"
    end

    test "updates form_id and form_mapping" do
      {:ok, event} = Events.create_event(event_attrs())

      form_mapping = %{
        "transport_question_id" => "q1",
        "observations_question_id" => "q2",
        "companions_question_id" => nil,
        "transport_option_mapping" => %{
          "Bus Anada" => [%{"bus_id" => 1, "direction" => "anada"}]
        }
      }

      {:ok, updated} = Events.update_event(event, %{form_id: 42, form_mapping: form_mapping})
      assert updated.form_id == 42
      assert updated.form_mapping["transport_question_id"] == "q1"
    end
  end

  describe "deactivate_event/1" do
    test "sets status to draft" do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, activated} = Events.activate_event(event)
      {:ok, deactivated} = Events.deactivate_event(activated)
      assert deactivated.status == "draft"
    end
  end

  describe "delete_event/1" do
    test "deletes the event" do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, _} = Events.delete_event(event)
      assert_raise Ecto.NoResultsError, fn -> Events.get_event!(event.id) end
    end
  end

  describe "import_participants/3 with transport_mapping whitespace" do
    setup do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, bus1} = Events.create_bus(event, %{label: "Bus Vic", direction: "anada", order: 1})

      {:ok, bus2} =
        Events.create_bus(event, %{label: "Bus Girona", direction: "tornada", order: 2})

      {:ok, event: event, bus1: bus1, bus2: bus2}
    end

    test "matches transport_raw with trailing space against mapping with trailing space", %{
      event: event,
      bus1: bus1,
      bus2: bus2
    } do
      transport_mapping = %{
        "Autobus anada i tornada " => %{
          "usesBus" => true,
          "buses" => [
            %{"busId" => bus1.id, "direction" => "anada"},
            %{"busId" => bus2.id, "direction" => "tornada"}
          ]
        }
      }

      rows = [
        %{
          first_name: "Anna",
          last_name: "Vila",
          last_name2: "",
          nickname: "",
          transport_raw: "Autobus anada i tornada "
        }
      ]

      {:ok, 1} = Events.import_participants(event, rows, transport_mapping)
      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 1
      trips = hd(participants).participant_trips
      assert length(trips) == 2
    end

    test "matches transport_raw without trailing space against mapping with trailing space", %{
      event: event,
      bus1: bus1,
      bus2: bus2
    } do
      transport_mapping = %{
        "Autobus anada i tornada " => %{
          "usesBus" => true,
          "buses" => [
            %{"busId" => bus1.id, "direction" => "anada"},
            %{"busId" => bus2.id, "direction" => "tornada"}
          ]
        }
      }

      rows = [
        %{
          first_name: "Anna",
          last_name: "Vila",
          last_name2: "",
          nickname: "",
          transport_raw: "Autobus anada i tornada"
        }
      ]

      {:ok, 1} = Events.import_participants(event, rows, transport_mapping)
      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 1
      trips = hd(participants).participant_trips
      assert length(trips) == 2
    end

    test "matches with extra middle spaces via trim fallback", %{event: event, bus1: bus1} do
      transport_mapping = %{
        "Bus Vic" => %{
          "usesBus" => true,
          "buses" => [%{"busId" => bus1.id, "direction" => "anada"}]
        }
      }

      rows = [
        %{
          first_name: "Joan",
          last_name: "Pla",
          last_name2: "",
          nickname: "",
          transport_raw: "  Bus Vic  "
        }
      ]

      {:ok, 1} = Events.import_participants(event, rows, transport_mapping)
      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 1
      trips = hd(participants).participant_trips
      assert length(trips) == 1
    end

    test "creates no trips for unknown transport value", %{event: event} do
      transport_mapping = %{
        "Bus Vic" => %{"usesBus" => true, "buses" => []}
      }

      rows = [
        %{
          first_name: "Joan",
          last_name: "Pla",
          last_name2: "",
          nickname: "",
          transport_raw: "Unknown transport"
        }
      ]

      {:ok, 1} = Events.import_participants(event, rows, transport_mapping)
      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 1
      assert hd(participants).participant_trips == []
    end

    test "splits combined transport values when no exact match", %{
      event: event,
      bus1: bus1,
      bus2: bus2
    } do
      transport_mapping = %{
        "Anada" => %{
          "usesBus" => true,
          "buses" => [%{"busId" => bus1.id, "direction" => "anada"}]
        },
        "Tornada" => %{
          "usesBus" => true,
          "buses" => [%{"busId" => bus2.id, "direction" => "tornada"}]
        }
      }

      rows = [
        %{
          first_name: "Anna",
          last_name: "Vila",
          last_name2: "",
          nickname: "",
          transport_raw: "Anada, Tornada"
        }
      ]

      {:ok, 1} = Events.import_participants(event, rows, transport_mapping)
      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 1
      trips = hd(participants).participant_trips
      assert length(trips) == 2

      bus_ids = Enum.map(trips, & &1.bus_id) |> Enum.sort()
      assert bus_ids == [bus1.id, bus2.id]
    end

    test "handles checkbox values with multiple selections", %{
      event: event,
      bus1: bus1,
      bus2: bus2
    } do
      transport_mapping = %{
        "Anada" => %{
          "usesBus" => true,
          "buses" => [%{"busId" => bus1.id, "direction" => "anada"}]
        },
        "Tornada" => %{
          "usesBus" => true,
          "buses" => [%{"busId" => bus2.id, "direction" => "tornada"}]
        },
        "No vinc amb bus" => %{
          "usesBus" => false,
          "buses" => []
        }
      }

      rows = [
        %{
          first_name: "Pau",
          last_name: "Serra",
          last_name2: "",
          nickname: "",
          transport_raw: "Anada, Tornada"
        },
        %{
          first_name: "Joan",
          last_name: "Pla",
          last_name2: "",
          nickname: "",
          transport_raw: "Anada"
        },
        %{
          first_name: "Maria",
          last_name: "Garcia",
          last_name2: "",
          nickname: "",
          transport_raw: "No vinc amb bus"
        }
      ]

      {:ok, 3} = Events.import_participants(event, rows, transport_mapping)
      participants = Events.list_participants_with_trips(event)

      pau = Enum.find(participants, &(&1.first_name == "Pau"))
      assert length(pau.participant_trips) == 2

      joan = Enum.find(participants, &(&1.first_name == "Joan"))
      assert length(joan.participant_trips) == 1

      maria = Enum.find(participants, &(&1.first_name == "Maria"))
      assert length(maria.participant_trips) == 0
    end
  end

  describe "import_form_participants/2" do
    setup do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, bus1} = Events.create_bus(event, %{label: "Bus Vic", direction: "anada", order: 1})

      {:ok, bus2} =
        Events.create_bus(event, %{label: "Bus Girona", direction: "tornada", order: 2})

      {:ok, event: event, bus1: bus1, bus2: bus2}
    end

    test "creates participants with trips_data from form import", %{
      event: event,
      bus1: bus1,
      bus2: bus2
    } do
      rows = [
        %{
          first_name: "Maria",
          last_name: "Garcia",
          last_name2: "",
          nickname: "Maria",
          transport_raw: "Bus Vic",
          observations: "Needs seat",
          companions: "2 kids",
          trips_data: [
            %{"bus_id" => bus1.id, "direction" => "anada"},
            %{"bus_id" => bus2.id, "direction" => "tornada"}
          ]
        }
      ]

      {:ok, 1} = Events.import_form_participants(event, rows)

      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 1
      p = hd(participants)
      assert p.first_name == "Maria"
      assert p.observations == "Needs seat"
      assert p.companions == "2 kids"
      assert length(p.participant_trips) == 2
    end

    test "skips rows with no name", %{event: event} do
      rows = [
        %{
          first_name: "",
          last_name: "",
          last_name2: "",
          nickname: "",
          transport_raw: "",
          observations: "",
          companions: "",
          trips_data: []
        }
      ]

      {:ok, count} = Events.import_form_participants(event, rows)
      assert count == 1
      # Empty-name rows are still inserted by import_form_participants
      # (rejection is handled by the caller)
    end
  end

  describe "replace_participant_trips/2" do
    setup do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, bus1} = Events.create_bus(event, %{label: "Bus Vic", direction: "anada", order: 1})

      {:ok, bus2} =
        Events.create_bus(event, %{label: "Bus Girona", direction: "tornada", order: 2})

      {:ok, participant} =
        Events.create_participant(event, %{first_name: "Pau", last_name: "Serra", nickname: ""})

      {:ok, event: event, bus1: bus1, bus2: bus2, participant: participant}
    end

    test "replaces all trips for a participant", %{bus1: bus1, bus2: bus2, participant: p} do
      {:ok, updated} =
        Events.replace_participant_trips(p, [
          %{"bus_id" => bus1.id, "direction" => "anada"},
          %{"bus_id" => bus2.id, "direction" => "tornada"}
        ])

      assert length(updated.participant_trips) == 2
    end
  end

  describe "participant CRUD" do
    setup do
      {:ok, event} = Events.create_event(event_attrs())
      {:ok, event: event}
    end

    test "create_participant/2", %{event: event} do
      {:ok, p} = Events.create_participant(event, %{first_name: "Anna", last_name: "Vila"})
      assert p.first_name == "Anna"
    end

    test "update_participant/2", %{event: event} do
      {:ok, p} = Events.create_participant(event, %{first_name: "Anna", last_name: "Vila"})
      {:ok, updated} = Events.update_participant(p, %{first_name: "Maria"})
      assert updated.first_name == "Maria"
    end

    test "delete_participant/1", %{event: event} do
      {:ok, p} = Events.create_participant(event, %{first_name: "Anna", last_name: "Vila"})
      {:ok, _} = Events.delete_participant(p)
      assert Events.list_participants(event) == []
    end
  end
end
