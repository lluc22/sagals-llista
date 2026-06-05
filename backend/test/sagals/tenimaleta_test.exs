defmodule Sagals.TenimaletaTest do
  use Sagals.DataCase, async: true

  alias Sagals.Tenimaleta

  describe "get_forms/0" do
    test "returns ok with forms data when API responds 200" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Req.Test.json(conn, %{
          "1001" => %{
            "title" => "Form 1",
            "hidden" => false,
            "elements" => [],
            "order" => [],
            "required" => false,
            "new" => false,
            "closingDate" => nil,
            "openingDate" => nil,
            "description" => nil
          }
        })
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:ok, forms} = Tenimaleta.get_forms()
      assert is_map(forms)
    end

    test "returns error when API responds with non-200 status" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:error, _} = Tenimaleta.get_forms()
    end
  end

  describe "get_form_responses/1" do
    test "returns responses map when API responds 200 with responses key" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Req.Test.json(conn, %{
          "responses" => %{
            "1" => %{"mote" => "Test", "q1" => "answer1"}
          }
        })
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:ok, responses} = Tenimaleta.get_form_responses("1001")
      assert is_map(responses)
    end

    test "returns responses map when API responds 200 with direct map body" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Req.Test.json(conn, %{
          "1" => %{"mote" => "Test", "q1" => "answer1"}
        })
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:ok, responses} = Tenimaleta.get_form_responses("1001")
      assert is_map(responses)
    end
  end

  describe "get_castellers/0" do
    test "returns castellers map when API responds 200" do
      Req.Test.stub(:tenimaleta, fn conn ->
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
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:ok, castellers} = Tenimaleta.get_castellers()
      assert is_map(castellers)
    end

    test "returns error when API responds with non-200 status" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:error, _} = Tenimaleta.get_castellers()
    end
  end

  describe "get_form_responses/1 error paths" do
    test "returns error when API responds with non-200 status" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 404, "Not Found")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:error, _} = Tenimaleta.get_form_responses("999")
    end
  end

  describe "get_calendar/0" do
    test "returns ok with calendar data when API responds 200 with calendar_events array" do
      Req.Test.stub(:tenimaleta, fn conn ->
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
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:ok, calendar} = Tenimaleta.get_calendar()
      assert %{"1000951" => %{"title" => "Actuació a Santpedor"}} = calendar
    end

    test "returns ok with calendar data when API responds 200 with map body" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Req.Test.json(conn, %{
          "1000951" => %{
            "id" => "1000951",
            "title" => "Actuació a Santpedor",
            "start" => "2025-06-14T10:00:00",
            "end" => "2025-06-14T14:00:00"
          }
        })
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:ok, calendar} = Tenimaleta.get_calendar()
      assert is_map(calendar)
    end

    test "returns error when API responds with non-200 status" do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      assert {:error, _} = Tenimaleta.get_calendar()
    end
  end
end
