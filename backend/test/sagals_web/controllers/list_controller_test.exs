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
end
