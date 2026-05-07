defmodule SagalsWeb.AuthControllerTest do
  use SagalsWeb.ConnCase, async: true

  alias Sagals.{Accounts, Events}

  setup do
    {:ok, user} = Accounts.create_user(%{email: "admin@test.cat", password: "password123"})
    {:ok, user: user}
  end

  describe "POST /api/auth/login" do
    test "returns token with valid credentials", %{conn: conn, user: user} do
      resp = conn
        |> post("/api/auth/login", %{email: user.email, password: "password123"})
        |> json_response(200)

      assert resp["token"] != nil
      assert resp["user"]["email"] == user.email
    end

    test "returns 401 with wrong password", %{conn: conn, user: user} do
      conn
      |> post("/api/auth/login", %{email: user.email, password: "wrong"})
      |> json_response(401)
    end

    test "returns 401 with unknown email", %{conn: conn} do
      conn
      |> post("/api/auth/login", %{email: "nobody@test.cat", password: "any"})
      |> json_response(401)
    end
  end

  describe "POST /api/auth/exchange" do
    test "returns list JWT for valid access token", %{conn: conn} do
      {:ok, event} = Events.create_event(%{name: "Fest", date: ~D[2025-01-01], slug: "fest-#{System.unique_integer()}"})
      {:ok, activated} = Events.activate_event(event)

      resp = conn
        |> post("/api/auth/exchange", %{access_token: activated.access_token})
        |> json_response(200)

      assert resp["token"] != nil
      assert resp["event"]["id"] == event.id
    end

    test "returns 401 for invalid token", %{conn: conn} do
      conn
      |> post("/api/auth/exchange", %{access_token: "invalid"})
      |> json_response(401)
    end
  end
end
