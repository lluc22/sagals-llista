defmodule Sagals.Attendance.Attendance do
  use Ecto.Schema
  import Ecto.Changeset

  @statuses ~w(pendent present absent)

  schema "attendance" do
    field :status, :string, default: "pendent"
    field :marked_at, :utc_datetime
    field :marked_by, :string

    belongs_to :participant_trip, Sagals.Events.ParticipantTrip

    timestamps()
  end

  def changeset(attendance, attrs) do
    attendance
    |> cast(attrs, [:participant_trip_id, :status, :marked_at, :marked_by])
    |> validate_required([:participant_trip_id])
    |> validate_inclusion(:status, @statuses)
    |> unique_constraint(:participant_trip_id)
  end
end
