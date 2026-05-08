defmodule SagalsWeb.UserController do
  use SagalsWeb, :controller

  alias Sagals.{Accounts, Repo}
  import Ecto.Changeset, only: [cast: 3, validate_required: 2, unique_constraint: 2]

  def index(conn, _params) do
    users = Accounts.list_users()
    json(conn, %{data: Enum.map(users, fn u -> %{id: u.id, email: u.email} end)})
  end

  def create(conn, %{"email" => email, "password" => password}) do
    case Accounts.create_user(%{email: email, password: password}) do
      {:ok, user} ->
        conn |> put_status(:created) |> json(%{data: %{id: user.id, email: user.email}})

      {:error, cs} ->
        errors = format_errors(cs)
        conn |> put_status(:unprocessable_entity) |> json(%{errors: errors})
    end
  end

  def update(conn, %{"id" => id} = params) do
    user = Accounts.get_user!(id)

    result =
      if blank?(params["password"]) do
        user
        |> cast(%{email: params["email"]}, [:email])
        |> validate_required([:email])
        |> unique_constraint(:email)
        |> Repo.update()
      else
        Accounts.update_user(user, %{email: params["email"], password: params["password"]})
      end

    case result do
      {:ok, user} ->
        json(conn, %{data: %{id: user.id, email: user.email}})

      {:error, cs} ->
        errors = format_errors(cs)
        conn |> put_status(:unprocessable_entity) |> json(%{errors: errors})
    end
  end

  def delete(conn, %{"id" => id}) do
    user = Accounts.get_user!(id)
    current_user = conn.assigns.current_user

    if user.id == current_user.id do
      conn
      |> put_status(:unprocessable_entity)
      |> json(%{errors: ["No pots eliminar-te a tu mateix"]})
    else
      {:ok, _} = Accounts.delete_user(user)
      send_resp(conn, :no_content, "")
    end
  end

  defp blank?(nil), do: true
  defp blank?(s), do: String.trim(s) == ""

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {k, v} -> "#{k} #{List.first(v)}" end)
  end
end
