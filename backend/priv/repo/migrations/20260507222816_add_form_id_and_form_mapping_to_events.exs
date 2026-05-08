defmodule Sagals.Repo.Migrations.AddFormIdAndFormMappingToEvents do
  use Ecto.Migration

  def change do
    alter table(:events) do
      add :form_id, :integer
      add :form_mapping, :map, default: %{}
    end
  end
end
