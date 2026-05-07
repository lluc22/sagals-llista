defmodule Sagals.Events.ParticipantTrip do
  use Ecto.Schema
  import Ecto.Changeset

  @directions ~w(anada tornada)

  schema "participant_trips" do
    field :direction, :string

    belongs_to :participant, Sagals.Events.Participant
    belongs_to :bus, Sagals.Events.Bus
    has_one :attendance, Sagals.Attendance.Attendance

    timestamps()
  end

  def changeset(trip, attrs) do
    trip
    |> cast(attrs, [:participant_id, :bus_id, :direction])
    |> validate_required([:participant_id, :bus_id, :direction])
    |> validate_inclusion(:direction, @directions)
    |> unique_constraint([:participant_id, :bus_id, :direction])
  end
end
