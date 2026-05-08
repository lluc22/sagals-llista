defmodule Sagals.AttendanceTest do
  use Sagals.DataCase, async: true

  alias Sagals.{Attendance, Events}

  defp setup_trip(_) do
    {:ok, event} =
      Events.create_event(%{
        name: "Test",
        date: ~D[2025-01-01],
        slug: "test-#{System.unique_integer()}"
      })

    {:ok, bus} = Events.create_bus(event, %{label: "Bus", direction: "anada", order: 1})

    transport_mapping = %{
      "Bus" => %{
        "usesBus" => true,
        "buses" => [%{"busId" => to_string(bus.id), "direction" => "anada"}]
      }
    }

    {:ok, _} =
      Events.import_participants(
        event,
        [
          %{
            first_name: "Anna",
            last_name: "Vila",
            last_name2: "",
            nickname: "",
            transport_raw: "Bus"
          }
        ],
        transport_mapping
      )

    [trip | _] = Events.list_trips_for_bus(bus.id, "anada")
    {:ok, event: event, bus: bus, trip: trip}
  end

  describe "mark_attendance/3" do
    setup :setup_trip

    test "creates attendance record as present", %{trip: trip} do
      assert {:ok, att} = Attendance.mark_attendance(trip.id, "present", "Lluc")
      assert att.status == "present"
      assert att.marked_by == "Lluc"
      assert att.marked_at != nil
    end

    test "updates existing attendance status", %{trip: trip} do
      {:ok, _} = Attendance.mark_attendance(trip.id, "present", "Lluc")
      assert {:ok, updated} = Attendance.mark_attendance(trip.id, "absent", "Lluc")
      assert updated.status == "absent"
    end

    test "rejects invalid status", %{trip: trip} do
      assert {:error, changeset} = Attendance.mark_attendance(trip.id, "invalid", "Lluc")
      assert %{status: [_]} = errors_on(changeset)
    end
  end

  describe "list_for_bus/2" do
    setup :setup_trip

    test "returns trips with attendance for a bus+direction", %{bus: bus, trip: trip} do
      {:ok, _} = Attendance.mark_attendance(trip.id, "present", "Lluc")
      results = Attendance.list_for_bus(bus.id, "anada")
      assert length(results) == 1
      result = hd(results)
      assert result.participant.first_name == "Anna"
      assert result.attendance.status == "present"
    end

    test "returns pendent for trips with no attendance record", %{bus: bus} do
      results = Attendance.list_for_bus(bus.id, "anada")
      assert length(results) == 1
      assert hd(results).attendance.status == "pendent"
    end
  end
end
