defmodule SagalsWeb.ListControllerTest do
  use SagalsWeb.ConnCase, async: false

  alias Sagals.{Auth, Events}

  defp list_conn(conn) do
    {:ok, event} =
      Events.create_event(%{
        name: "Test",
        date: ~D[2025-01-01],
        slug: "list-test-#{System.unique_integer()}"
      })

    {:ok, activated} = Events.activate_event(event)
    token = Auth.generate_list_token(activated.id)
    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  defp stub_tenimaleta do
    Req.Test.stub(:tenimaleta, fn conn ->
      cond do
        String.contains?(conn.request_path, "castellersInfo") ->
          Req.Test.json(conn, %{
            "1" => %{"id" => 1, "mote" => "Mates", "hidden" => 0},
            "2" => %{"id" => 2, "mote" => "Coll", "hidden" => 0},
            "3" => %{"id" => 3, "mote" => "Hidden", "hidden" => 1}
          })

        String.contains?(conn.request_path, "profile_pic") ->
          Req.Test.json(conn, %{"base64" => "data:image/jpeg;base64,abc123"})

        true ->
          Plug.Conn.send_resp(conn, 404, "not found")
      end
    end)

    Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
    on_exit(fn -> Application.delete_env(:sagals, :req_options) end)
  end

  describe "GET /api/list/castellers" do
    test "returns 401 without token", %{conn: conn} do
      conn |> get("/api/list/castellers") |> json_response(401)
    end

    test "returns castellers list excluding hidden", %{conn: conn} do
      stub_tenimaleta()

      resp = conn |> list_conn() |> get("/api/list/castellers") |> json_response(200)

      motes = Enum.map(resp["data"], & &1["mote"])
      assert "Mates" in motes
      assert "Coll" in motes
      refute "Hidden" in motes
    end

    test "returns id and mote for each casteller", %{conn: conn} do
      stub_tenimaleta()

      resp = conn |> list_conn() |> get("/api/list/castellers") |> json_response(200)

      assert length(resp["data"]) == 2
      first = Enum.find(resp["data"], &(&1["mote"] == "Mates"))
      assert first["id"] == 1
    end
  end

  describe "GET /api/list/profile_pic/:id" do
    test "returns 401 without token", %{conn: conn} do
      conn |> get("/api/list/profile_pic/306") |> json_response(401)
    end

    test "returns base64 data URI", %{conn: conn} do
      stub_tenimaleta()

      resp = conn |> list_conn() |> get("/api/list/profile_pic/306") |> json_response(200)

      assert resp["base64"] == "data:image/jpeg;base64,abc123"
    end
  end

  describe "GET /api/list/buses" do
    test "returns 401 without token", %{conn: conn} do
      conn |> get("/api/list/buses") |> json_response(401)
    end

    test "returns buses for the event", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Bus Test",
          date: ~D[2025-03-15],
          slug: "bus-test-#{System.unique_integer()}"
        })

      {:ok, activated} = Events.activate_event(event)

      {:ok, bus1} =
        Events.create_bus(activated, %{label: "Bus Vic", direction: "anada", order: 1})

      {:ok, _bus2} =
        Events.create_bus(activated, %{label: "Bus Girona", direction: "tornada", order: 2})

      token = Auth.generate_list_token(activated.id)
      conn = put_req_header(conn, "authorization", "Bearer #{token}")

      resp = conn |> get("/api/list/buses") |> json_response(200)

      assert length(resp["data"]) == 2
      bus_vic = Enum.find(resp["data"], &(&1["label"] == "Bus Vic"))
      assert bus_vic["direction"] == "anada"
      assert bus_vic["id"] == bus1.id
    end
  end

  describe "GET /api/list/buses/:bus_id/:direction" do
    test "returns 401 without token", %{conn: conn} do
      conn |> get("/api/list/buses/1/anada") |> json_response(401)
    end

    test "returns participants for a bus direction", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "List Test",
          date: ~D[2025-03-15],
          slug: "list-test-#{System.unique_integer()}"
        })

      {:ok, activated} = Events.activate_event(event)
      {:ok, bus} = Events.create_bus(activated, %{label: "Bus Vic", direction: "anada", order: 1})

      {:ok, p} =
        Events.create_participant(activated, %{
          first_name: "Anna",
          last_name: "Vila",
          nickname: "An",
          observations: "Necessitaj ajuda",
          companions: "2"
        })

      {:ok, _trip} =
        Events.replace_participant_trips(p, [%{"bus_id" => bus.id, "direction" => "anada"}])

      token = Auth.generate_list_token(activated.id)
      conn = put_req_header(conn, "authorization", "Bearer #{token}")

      resp = conn |> get("/api/list/buses/#{bus.id}/anada") |> json_response(200)

      assert length(resp["data"]) == 1
      entry = hd(resp["data"])
      assert entry["trip_id"]
      assert entry["participant"]["first_name"] == "Anna"
      assert entry["participant"]["last_name"] == "Vila"
      assert entry["participant"]["nickname"] == "An"
      assert entry["participant"]["observations"] == "Necessitaj ajuda"
      assert entry["participant"]["companions"] == "2"
      assert entry["attendance"]["status"] == "pendent"
    end
  end

  describe "POST /api/list/attendance" do
    test "returns 401 without token", %{conn: conn} do
      conn
      |> post("/api/list/attendance", %{"trip_id" => 1, "status" => "present"})
      |> json_response(401)
    end

    test "marks attendance as present", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Att Test",
          date: ~D[2025-03-15],
          slug: "att-test-#{System.unique_integer()}"
        })

      {:ok, activated} = Events.activate_event(event)
      {:ok, bus} = Events.create_bus(activated, %{label: "Bus Vic", direction: "anada", order: 1})
      {:ok, p} = Events.create_participant(activated, %{first_name: "Pau", last_name: "Serra"})

      {:ok, updated} =
        Events.replace_participant_trips(p, [%{"bus_id" => bus.id, "direction" => "anada"}])

      trip = hd(updated.participant_trips)

      token = Auth.generate_list_token(activated.id)
      conn = put_req_header(conn, "authorization", "Bearer #{token}")

      resp =
        conn
        |> post("/api/list/attendance", %{
          "trip_id" => trip.id,
          "status" => "present",
          "marked_by" => "checker1"
        })
        |> json_response(200)

      assert resp["data"]["status"] == "present"
      assert resp["data"]["marked_by"] == "checker1"
      assert resp["data"]["trip_id"] == trip.id
    end

    test "updates existing attendance", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Att Update Test",
          date: ~D[2025-03-15],
          slug: "att-upd-#{System.unique_integer()}"
        })

      {:ok, activated} = Events.activate_event(event)
      {:ok, bus} = Events.create_bus(activated, %{label: "Bus Vic", direction: "anada", order: 1})
      {:ok, p} = Events.create_participant(activated, %{first_name: "Pau", last_name: "Serra"})

      {:ok, updated} =
        Events.replace_participant_trips(p, [%{"bus_id" => bus.id, "direction" => "anada"}])

      trip = hd(updated.participant_trips)

      token = Auth.generate_list_token(activated.id)
      conn = put_req_header(conn, "authorization", "Bearer #{token}")

      conn
      |> post("/api/list/attendance", %{
        "trip_id" => trip.id,
        "status" => "present",
        "marked_by" => "checker1"
      })

      resp =
        conn
        |> post("/api/list/attendance", %{
          "trip_id" => trip.id,
          "status" => "absent",
          "marked_by" => "checker2"
        })
        |> json_response(200)

      assert resp["data"]["status"] == "absent"
      assert resp["data"]["marked_by"] == "checker2"
    end

    test "returns 422 for invalid status", %{conn: conn} do
      {:ok, event} =
        Events.create_event(%{
          name: "Att Invalid Test",
          date: ~D[2025-03-15],
          slug: "att-inv-#{System.unique_integer()}"
        })

      {:ok, activated} = Events.activate_event(event)
      {:ok, bus} = Events.create_bus(activated, %{label: "Bus Vic", direction: "anada", order: 1})
      {:ok, p} = Events.create_participant(activated, %{first_name: "Pau", last_name: "Serra"})

      {:ok, updated} =
        Events.replace_participant_trips(p, [%{"bus_id" => bus.id, "direction" => "anada"}])

      trip = hd(updated.participant_trips)

      token = Auth.generate_list_token(activated.id)
      conn = put_req_header(conn, "authorization", "Bearer #{token}")

      conn
      |> post("/api/list/attendance", %{"trip_id" => trip.id, "status" => "invalid_status"})
      |> json_response(422)
    end
  end
end
