defmodule Sagals.Events.Event do
  use Ecto.Schema
  import Ecto.Changeset

  @statuses ~w(draft active closed)

  schema "events" do
    field :name, :string
    field :date, :date
    field :slug, :string
    field :status, :string, default: "draft"
    field :access_token, :string
    field :column_mapping, :map, default: %{}
    field :transport_mapping, :map, default: %{}

    has_many :buses, Sagals.Events.Bus
    has_many :participants, Sagals.Events.Participant

    timestamps()
  end

  def changeset(event, attrs) do
    event
    |> cast(attrs, [:name, :date, :slug, :status, :column_mapping, :transport_mapping])
    |> validate_required([:name, :date, :slug])
    |> validate_inclusion(:status, @statuses)
    |> unique_constraint(:slug)
  end

  def activate_changeset(event) do
    event
    |> change(status: "active", access_token: generate_token())
  end

  def deactivate_changeset(event) do
    event
    |> change(status: "draft", access_token: nil)
  end

  defp generate_token do
    :crypto.strong_rand_bytes(32) |> Base.url_encode64(padding: false)
  end
end
