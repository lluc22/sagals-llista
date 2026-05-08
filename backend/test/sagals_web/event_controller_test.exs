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

  describe "GET /api/events/:id" do
    test "shows event", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Show Test",
          date: ~D[2025-01-01],
          slug: "show-test-#{System.unique_integer()}"
        })

      resp = conn |> authed_conn() |> get("/api/events/#{event.id}") |> json_response(200)
      assert resp["data"]["name"] == "Show Test"
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

    test "GET /api/events/:id/buses lists buses", %{conn: conn, event: event} do
      {:ok, _bus} = Events.create_bus(event, %{label: "Bus Vic", direction: "anada", order: 1})

      resp = conn |> get("/api/events/#{event.id}/buses") |> json_response(200)

      assert length(resp["data"]) == 1
      assert hd(resp["data"])["label"] == "Bus Vic"
      assert hd(resp["data"])["direction"] == "anada"
    end

    test "POST /api/events/:id/buses creates bus", %{conn: conn, event: event} do
      resp =
        conn
        |> post("/api/events/#{event.id}/buses", %{label: "Bus Vic", direction: "anada", order: 1})
        |> json_response(201)

      assert resp["data"]["label"] == "Bus Vic"
    end

    test "POST /api/events/:id/buses returns 422 for invalid bus", %{conn: conn, event: event} do
      conn
      |> post("/api/events/#{event.id}/buses", %{})
      |> json_response(422)
    end

    test "PATCH /api/buses/:id updates bus", %{conn: conn, event: event} do
      {:ok, bus} = Events.create_bus(event, %{label: "Old", direction: "anada", order: 1})
      resp = conn |> patch("/api/buses/#{bus.id}", %{label: "New"}) |> json_response(200)
      assert resp["data"]["label"] == "New"
    end

    test "PATCH /api/buses/:id returns 422 for invalid update", %{conn: conn, event: event} do
      {:ok, bus} = Events.create_bus(event, %{label: "Bus", direction: "anada", order: 1})
      conn |> patch("/api/buses/#{bus.id}", %{direction: "invalid"}) |> json_response(422)
    end

    test "DELETE /api/buses/:id deletes bus", %{conn: conn, event: event} do
      {:ok, bus} = Events.create_bus(event, %{label: "To delete", direction: "anada", order: 1})
      conn |> delete("/api/buses/#{bus.id}") |> response(204)
      assert Events.list_buses(event) == []
    end
  end

  describe "PATCH /api/events/:id (update)" do
    setup %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Update Test",
          date: ~D[2025-01-01],
          slug: "update-test-#{System.unique_integer()}"
        })

      {:ok, conn: authed_conn(conn), event: event}
    end

    test "updates event name", %{conn: conn, event: event} do
      resp = conn |> patch("/api/events/#{event.id}", %{name: "New Name"}) |> json_response(200)
      assert resp["data"]["name"] == "New Name"
    end

    test "updates form_id and form_mapping", %{conn: conn, event: event} do
      form_mapping = %{
        "transport_question_id" => "q1",
        "observations_question_id" => "q2",
        "companions_question_id" => nil,
        "transport_option_mapping" => %{
          "Bus Anada" => [%{"bus_id" => 1, "direction" => "anada"}]
        }
      }

      resp =
        conn
        |> patch("/api/events/#{event.id}", %{form_id: 42, form_mapping: form_mapping})
        |> json_response(200)

      assert resp["data"]["form_id"] == 42
      assert resp["data"]["form_mapping"]["transport_question_id"] == "q1"
    end

    test "returns 422 for invalid update", %{conn: conn, event: event} do
      conn
      |> patch("/api/events/#{event.id}", %{name: ""})
      |> json_response(422)
    end
  end

  describe "POST /api/events/:id/deactivate" do
    test "sets status to draft", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Deact",
          date: ~D[2025-01-01],
          slug: "deact-#{System.unique_integer()}"
        })

      {:ok, activated} = Events.activate_event(event)

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{activated.id}/deactivate")
        |> json_response(200)

      assert resp["data"]["status"] == "draft"
    end
  end

  describe "DELETE /api/events/:id" do
    test "deletes event", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Delete Me",
          date: ~D[2025-01-01],
          slug: "del-#{System.unique_integer()}"
        })

      conn |> authed_conn() |> delete("/api/events/#{event.id}") |> response(204)
    end
  end
end
