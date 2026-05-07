defmodule Sagals.Repo.Migrations.AddObservationsCompanionsToParticipants do
  use Ecto.Migration

  def change do
    alter table(:participants) do
      add :observations, :string, default: ""
      add :companions, :string, default: ""
    end
  end
end
