defmodule Sagals.Repo do
  use Ecto.Repo,
    otp_app: :sagals,
    adapter: Ecto.Adapters.Postgres
end
