defmodule SagalsWeb.AuthController do
  use SagalsWeb, :controller

  alias Sagals.{Accounts, Auth, Events}

  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.authenticate_user(email, password) do
      {:ok, user} ->
        token = Auth.generate_admin_token(user.id)
        json(conn, %{token: token, user: %{id: user.id, email: user.email}})

      {:error, :invalid_credentials} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid credentials"})
    end
  end

  def exchange(conn, %{"access_token" => access_token}) do
    case Events.get_event_by_access_token(access_token) do
      {:ok, event} ->
        jwt = Auth.generate_list_token(event.id)
        json(conn, %{token: jwt, event: %{id: event.id, name: event.name, slug: event.slug}})

      {:error, :not_found} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid or expired token"})
    end
  end
end
