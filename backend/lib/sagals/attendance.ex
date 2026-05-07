defmodule Sagals.Attendance do
  import Ecto.Query
  alias Sagals.Repo
  alias Sagals.Attendance.Attendance
  alias Sagals.Events.ParticipantTrip

  def mark_attendance(participant_trip_id, status, marked_by) do
    existing = Repo.get_by(Attendance, participant_trip_id: participant_trip_id)
    attrs = %{
      participant_trip_id: participant_trip_id,
      status: status,
      marked_by: marked_by,
      marked_at: DateTime.utc_now() |> DateTime.truncate(:second)
    }

    result =
      if existing do
        existing |> Attendance.changeset(attrs) |> Repo.update()
      else
        %Attendance{} |> Attendance.changeset(attrs) |> Repo.insert()
      end

    result
  end

  def list_for_bus(bus_id, direction) do
    trips =
      Repo.all(
        from pt in ParticipantTrip,
          where: pt.bus_id == ^bus_id and pt.direction == ^direction,
          preload: [:participant, :attendance]
      )

    Enum.map(trips, fn trip ->
      attendance = trip.attendance || %Attendance{status: "pendent", participant_trip_id: trip.id}
      %{trip: trip, participant: trip.participant, attendance: attendance}
    end)
  end
end
