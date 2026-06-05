defmodule SagalsWeb.TenimaletaControllerTest do
  use SagalsWeb.ConnCase, async: false

  alias Sagals.{Accounts, Auth}

  defp authed_conn(conn) do
    {:ok, user} =
      Accounts.create_user(%{
        email: "admin#{System.unique_integer()}@test.cat",
        password: "password123"
      })

    token = Auth.generate_admin_token(user.id)
    put_req_header(conn, "authorization", "Bearer #{token}")
  end

  defp stub_tenimaleta do
    Req.Test.stub(:tenimaleta, fn conn ->
      cond do
        String.contains?(conn.request_path, "get_all_forms") ->
          Req.Test.json(conn, %{
            "1001" => %{
              "title" => "Test Form",
              "description" => nil,
              "elements" => [
                %{
                  "id" => "q1",
                  "type" => "multiple-choice",
                  "content" => %{"question" => "Transport?", "options" => ["Bus", "Propi"]},
                  "required" => true,
                  "isComprovant" => false
                }
              ],
              "order" => ["q1"],
              "required" => false,
              "hidden" => false,
              "openingDate" => nil,
              "closingDate" => "2025-12-31",
              "new" => false
            }
          })

        String.contains?(conn.request_path, "castellersInfo") ->
          Req.Test.json(conn, %{
            "1" => %{
              "id" => 1,
              "nom" => "Joan",
              "cognom" => "Garcia",
              "segon_cognom" => nil,
              "mote" => "Garcia",
              "hidden" => 0,
              "canalla" => 0,
              "casteller" => 1,
              "soci" => 1
            }
          })

        String.contains?(conn.request_path, "calendar") ->
          Req.Test.json(conn, %{
            "calendar_events" => %{
              "events" => [
                %{
                  "id" => 1_000_951,
                  "title" => "Actuació a Santpedor",
                  "data-esperada-inici" => "2025-06-14T10:00:00Z",
                  "data-esperada-fi" => "2025-06-14T14:00:00Z"
                }
              ]
            },
            "events_to_be_deleted" => []
          })

        String.contains?(conn.request_path, "form_responses") ->
          Req.Test.json(conn, %{
            "1" => %{"mote" => "Garcia", "q1" => "Bus", "createdAt" => "2025-01-01"}
          })

        true ->
          Plug.Conn.send_resp(conn, 404, "not found")
      end
    end)

    Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
    on_exit(fn -> Application.delete_env(:sagals, :req_options) end)
  end

  describe "GET /api/tenimaleta/forms" do
    test "returns 401 without auth", %{conn: conn} do
      conn |> get("/api/tenimaleta/forms") |> json_response(401)
    end

    test "returns forms when authenticated", %{conn: conn} do
      stub_tenimaleta()

      resp = conn |> authed_conn() |> get("/api/tenimaleta/forms") |> json_response(200)

      assert is_map(resp["data"])
    end
  end

  describe "GET /api/tenimaleta/calendar" do
    test "returns 401 without auth", %{conn: conn} do
      conn |> get("/api/tenimaleta/calendar") |> json_response(401)
    end

    test "returns calendar events when authenticated", %{conn: conn} do
      stub_tenimaleta()

      resp = conn |> authed_conn() |> get("/api/tenimaleta/calendar") |> json_response(200)

      assert is_map(resp["data"])
    end
  end

  describe "GET /api/tenimaleta/forms/:id/responses" do
    test "returns 401 without auth", %{conn: conn} do
      conn |> get("/api/tenimaleta/forms/1001/responses") |> json_response(401)
    end

    test "returns responses when authenticated", %{conn: conn} do
      stub_tenimaleta()

      resp =
        conn |> authed_conn() |> get("/api/tenimaleta/forms/1001/responses") |> json_response(200)

      assert is_map(resp["data"])
    end
  end

  describe "GET /api/tenimaleta/castellers" do
    test "returns 401 without auth", %{conn: conn} do
      conn |> get("/api/tenimaleta/castellers") |> json_response(401)
    end

    test "returns castellers when authenticated", %{conn: conn} do
      stub_tenimaleta()

      resp = conn |> authed_conn() |> get("/api/tenimaleta/castellers") |> json_response(200)

      assert is_map(resp["data"])
    end
  end

  describe "GET /api/tenimaleta/forms (error paths)" do
    test "returns 502 when API fails", %{conn: conn} do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      resp = conn |> authed_conn() |> get("/api/tenimaleta/forms") |> json_response(502)
      assert resp["error"] != nil
    end
  end

  describe "GET /api/tenimaleta/forms/:id/responses (error paths)" do
    test "returns 502 when API fails", %{conn: conn} do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      resp =
        conn |> authed_conn() |> get("/api/tenimaleta/forms/1001/responses") |> json_response(502)

      assert resp["error"] != nil
    end
  end

  describe "GET /api/tenimaleta/castellers (error paths)" do
    test "returns 502 when API fails", %{conn: conn} do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      resp = conn |> authed_conn() |> get("/api/tenimaleta/castellers") |> json_response(502)
      assert resp["error"] != nil
    end
  end

  describe "GET /api/tenimaleta/calendar (error paths)" do
    test "returns 502 when API fails", %{conn: conn} do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      resp = conn |> authed_conn() |> get("/api/tenimaleta/calendar") |> json_response(502)
      assert resp["error"] != nil
    end
  end
end
