defmodule Sagals.Events.Participant do
  use Ecto.Schema
  import Ecto.Changeset

  schema "participants" do
    field :first_name, :string, default: ""
    field :last_name, :string, default: ""
    field :last_name2, :string, default: ""
    field :nickname, :string, default: ""
    field :transport_raw, :string, default: ""
    field :observations, :string, default: ""
    field :companions, :string, default: ""
    field :reviewed, :boolean, default: false

    belongs_to :event, Sagals.Events.Event
    has_many :participant_trips, Sagals.Events.ParticipantTrip

    timestamps()
  end

  def changeset(participant, attrs) do
    participant
    |> cast(attrs, [
      :first_name,
      :last_name,
      :last_name2,
      :nickname,
      :transport_raw,
      :observations,
      :companions,
      :reviewed,
      :event_id
    ])
    |> validate_required([:event_id])
  end
end
