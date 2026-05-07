defmodule Sagals.Repo.Migrations.CreateParticipants do
  use Ecto.Migration

  def change do
    create table(:participants) do
      add :event_id, references(:events, on_delete: :delete_all), null: false
      add :first_name, :string, null: false, default: ""
      add :last_name, :string, null: false, default: ""
      add :last_name2, :string, default: ""
      add :nickname, :string, default: ""
      add :transport_raw, :string, default: ""

      timestamps()
    end

    create index(:participants, [:event_id])
  end
end
