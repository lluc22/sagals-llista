defmodule Sagals.Repo.Migrations.AddReviewedToParticipants do
  use Ecto.Migration

  def change do
    alter table(:participants) do
      add :reviewed, :boolean, default: false, null: false
    end
  end
end
