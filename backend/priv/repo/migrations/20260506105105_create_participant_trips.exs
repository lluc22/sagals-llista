defmodule Sagals.Repo.Migrations.CreateParticipantTrips do
  use Ecto.Migration

  def change do
    create table(:participant_trips) do
      add :participant_id, references(:participants, on_delete: :delete_all), null: false
      add :bus_id, references(:buses, on_delete: :delete_all), null: false
      add :direction, :string, null: false

      timestamps()
    end

    create index(:participant_trips, [:participant_id])
    create index(:participant_trips, [:bus_id])
    create unique_index(:participant_trips, [:participant_id, :bus_id, :direction])
  end
end
