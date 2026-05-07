defmodule Sagals.Repo.Migrations.CreateAttendance do
  use Ecto.Migration

  def change do
    create table(:attendance) do
      add :participant_trip_id, references(:participant_trips, on_delete: :delete_all), null: false
      add :status, :string, null: false, default: "pendent"
      add :marked_at, :utc_datetime
      add :marked_by, :string

      timestamps()
    end

    create unique_index(:attendance, [:participant_trip_id])
    create index(:attendance, [:status])
  end
end
