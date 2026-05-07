defmodule Sagals.Repo.Migrations.CreateEvents do
  use Ecto.Migration

  def change do
    create table(:events) do
      add :name, :string, null: false
      add :date, :date, null: false
      add :slug, :string, null: false
      add :status, :string, null: false, default: "draft"
      add :access_token, :string
      add :column_mapping, :map, default: "{}"
      add :transport_mapping, :map, default: "{}"

      timestamps()
    end

    create unique_index(:events, [:slug])
    create index(:events, [:access_token])
  end
end
