defmodule Sagals.Release do
  @app :sagals

  def migrate do
    Application.load(@app)
    for repo <- Application.fetch_env!(@app, :ecto_repos) do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def create_user(email, password) do
    with_repo(fn ->
      case Sagals.Accounts.create_user(%{email: email, password: password}) do
        {:ok, user} -> IO.puts("Created: #{user.email}")
        {:error, changeset} -> IO.puts("Error: #{inspect(changeset.errors)}")
      end
    end)
  end

  def list_users do
    with_repo(fn ->
      users = Sagals.Accounts.list_users()

      if users == [] do
        IO.puts("No users.")
      else
        Enum.each(users, fn u -> IO.puts("  [#{u.id}] #{u.email}") end)
      end
    end)
  end

  def update_password(email, new_password) do
    with_repo(fn ->
      case Sagals.Accounts.get_user_by_email(email) do
        nil ->
          IO.puts("User not found: #{email}")

        user ->
          case Sagals.Accounts.update_password(user, new_password) do
            {:ok, _} -> IO.puts("Password updated for #{email}")
            {:error, changeset} -> IO.puts("Error: #{inspect(changeset.errors)}")
          end
      end
    end)
  end

  def delete_user(email) do
    with_repo(fn ->
      case Sagals.Accounts.get_user_by_email(email) do
        nil ->
          IO.puts("User not found: #{email}")

        user ->
          {:ok, _} = Sagals.Accounts.delete_user(user)
          IO.puts("Deleted: #{email}")
      end
    end)
  end

  defp with_repo(fun) do
    Application.load(@app)
    repo = hd(Application.fetch_env!(@app, :ecto_repos))
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, fn _repo -> fun.() end)
  end
end
