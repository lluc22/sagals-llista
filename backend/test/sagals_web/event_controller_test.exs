defmodule SagalsWeb.EventControllerTest do
  use SagalsWeb.ConnCase, async: true

  alias Sagals.{Accounts, Auth, Events}

  defp authed_conn(conn) do
    {:ok, user} =
      Accounts.create_user(%{
        email: "admin#{System.unique_integer()}@test.cat",
        password: "password123"
      })

    token = Auth.generate_admin_token(user.id)
    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  defp event_attrs(overrides \\ %{}) do
    Map.merge(
      %{"name" => "Festa", "date" => "2025-06-01", "slug" => "festa-#{System.unique_integer()}"},
      overrides
    )
  end

  describe "GET /api/events" do
    test "returns events list when authenticated", %{conn: conn} do
      {:ok, _} =
        Events.create_event(%{
          name: "Test",
          date: ~D[2025-01-01],
          slug: "test-#{System.unique_integer()}"
        })

      resp = conn |> authed_conn() |> get("/api/events") |> json_response(200)
      assert length(resp["data"]) >= 1
    end

    test "returns 401 without token", %{conn: conn} do
      conn |> get("/api/events") |> json_response(401)
    end
  end

  describe "POST /api/events" do
    test "creates event", %{conn: conn} do
      resp = conn |> authed_conn() |> post("/api/events", event_attrs()) |> json_response(201)
      assert resp["data"]["name"] == "Festa"
      assert resp["data"]["status"] == "draft"
    end

    test "returns errors for invalid data", %{conn: conn} do
      resp = conn |> authed_conn() |> post("/api/events", %{}) |> json_response(422)
      assert resp["errors"] != nil
    end
  end

  describe "POST /api/events/:id/activate" do
    test "activates event and returns access_token", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "T",
          date: ~D[2025-01-01],
          slug: "t-#{System.unique_integer()}"
        })

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/activate")
        |> json_response(200)

      assert resp["data"]["status"] == "active"
      assert resp["data"]["access_token"] != nil
    end
  end

  describe "buses" do
    setup %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "T",
          date: ~D[2025-01-01],
          slug: "bus-test-#{System.unique_integer()}"
        })

      {:ok, conn: authed_conn(conn), event: event}
    end

    test "POST /api/events/:id/buses creates bus", %{conn: conn, event: event} do
      resp =
        conn
        |> post("/api/events/#{event.id}/buses", %{label: "Bus Vic", direction: "anada", order: 1})
        |> json_response(201)

      assert resp["data"]["label"] == "Bus Vic"
    end

    test "PATCH /api/buses/:id updates bus", %{conn: conn, event: event} do
      {:ok, bus} = Events.create_bus(event, %{label: "Old", direction: "anada", order: 1})
      resp = conn |> patch("/api/buses/#{bus.id}", %{label: "New"}) |> json_response(200)
      assert resp["data"]["label"] == "New"
    end

    test "DELETE /api/buses/:id deletes bus", %{conn: conn, event: event} do
      {:ok, bus} = Events.create_bus(event, %{label: "To delete", direction: "anada", order: 1})
      conn |> delete("/api/buses/#{bus.id}") |> response(204)
      assert Events.list_buses(event) == []
    end
  end
end
