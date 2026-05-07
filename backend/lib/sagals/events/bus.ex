defmodule Sagals.Events.Bus do
  use Ecto.Schema
  import Ecto.Changeset

  @directions ~w(anada tornada)

  schema "buses" do
    field :label, :string
    field :departure_time, :string
    field :direction, :string, default: "anada"
    field :order, :integer, default: 0

    belongs_to :event, Sagals.Events.Event
    has_many :participant_trips, Sagals.Events.ParticipantTrip

    timestamps()
  end

  def changeset(bus, attrs) do
    bus
    |> cast(attrs, [:label, :departure_time, :direction, :order, :event_id])
    |> validate_required([:label, :event_id])
    |> validate_inclusion(:direction, @directions)
  end
end
