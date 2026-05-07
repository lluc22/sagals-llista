defmodule Sagals.Repo.Migrations.CreateBuses do
  use Ecto.Migration

  def change do
    create table(:buses) do
      add :event_id, references(:events, on_delete: :delete_all), null: false
      add :label, :string, null: false
      add :departure_time, :string
      add :direction, :string, null: false, default: "anada"
      add :order, :integer, null: false, default: 0

      timestamps()
    end

    create index(:buses, [:event_id])
  end
end
