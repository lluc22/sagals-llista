defmodule SagalsWeb.ParticipantControllerTest do
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

  defp create_event_with_bus(_) do
    {:ok, event} =
      Events.create_event(%{
        name: "Test",
        date: ~D[2025-01-01],
        slug: "p-test-#{System.unique_integer()}"
      })

    {:ok, bus1} = Events.create_bus(event, %{label: "Bus Vic", direction: "anada", order: 1})
    {:ok, bus2} = Events.create_bus(event, %{label: "Bus Girona", direction: "tornada", order: 2})
    {:ok, event: event, bus1: bus1, bus2: bus2}
  end

  describe "POST /api/events/:id/participants/import with map-style rows" do
    setup [:create_event_with_bus]

    test "imports participants with map-style rows (form import)", %{
      conn: conn,
      event: event,
      bus1: bus1,
      bus2: bus2
    } do
      transport_mapping = %{
        "Autobus anada i tornada" => %{
          "usesBus" => true,
          "buses" => [
            %{"busId" => bus1.id, "direction" => "anada"},
            %{"busId" => bus2.id, "direction" => "tornada"}
          ]
        },
        "Transport propi" => %{"usesBus" => false, "buses" => []}
      }

      rows = [
        %{
          "first_name" => "Anna",
          "last_name" => "Vila",
          "last_name2" => "",
          "nickname" => "Anna",
          "transport_raw" => "Autobus anada i tornada",
          "observations" => "",
          "companions" => ""
        },
        %{
          "first_name" => "Pau",
          "last_name" => "Serra",
          "last_name2" => "",
          "nickname" => "Pau",
          "transport_raw" => "Transport propi",
          "observations" => "Needs help",
          "companions" => "2"
        }
      ]

      column_mapping = %{
        "firstName" => 0,
        "lastName" => 1,
        "last_name2" => 2,
        "nickname" => 3,
        "transport" => 4,
        "observations" => 5,
        "companions" => 6
      }

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/participants/import", %{
          rows: rows,
          column_mapping: column_mapping,
          transport_mapping: transport_mapping
        })
        |> json_response(201)

      assert resp["imported"] == 2

      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 2

      anna = Enum.find(participants, &(&1.first_name == "Anna"))
      assert anna.transport_raw == "Autobus anada i tornada"
      assert length(anna.participant_trips) == 2

      pau = Enum.find(participants, &(&1.first_name == "Pau"))
      assert pau.transport_raw == "Transport propi"
      assert pau.observations == "Needs help"
      assert pau.companions == "2"
      assert length(pau.participant_trips) == 0
    end

    test "imports participants with list-style rows (excel import)", %{
      conn: conn,
      event: event,
      bus1: bus1
    } do
      transport_mapping = %{
        "Bus Vic" => %{
          "usesBus" => true,
          "buses" => [%{"busId" => bus1.id, "direction" => "anada"}]
        }
      }

      rows = [
        ["Pere", "Gomez", "", "Pere", "Bus Vic", "", ""]
      ]

      column_mapping = %{
        "firstName" => 0,
        "lastName" => 1,
        "last_name2" => 2,
        "nickname" => 3,
        "transport" => 4,
        "observations" => 5,
        "companions" => 6
      }

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/participants/import", %{
          rows: rows,
          column_mapping: column_mapping,
          transport_mapping: transport_mapping
        })
        |> json_response(201)

      assert resp["imported"] == 1
      participants = Events.list_participants_with_trips(event)
      assert length(participants) == 1
      assert hd(participants).first_name == "Pere"
    end
  end

  describe "POST /api/events/:id/participants (create single)" do
    setup [:create_event_with_bus]

    test "creates a single participant", %{conn: conn, event: event} do
      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/participants", %{
          first_name: "Joan",
          last_name: "Martí"
        })
        |> json_response(201)

      assert resp["data"]["first_name"] == "Joan"
    end
  end

  describe "PATCH /api/participants/:id (update)" do
    setup [:create_event_with_bus]

    test "updates participant fields", %{conn: conn, event: event} do
      {:ok, p} = Events.create_participant(event, %{first_name: "Anna", last_name: "Vila"})

      resp =
        conn
        |> authed_conn()
        |> patch("/api/participants/#{p.id}", %{first_name: "Maria"})
        |> json_response(200)

      assert resp["data"]["first_name"] == "Maria"
    end

    test "updates participant trips", %{conn: conn, event: event, bus1: bus1, bus2: bus2} do
      {:ok, p} = Events.create_participant(event, %{first_name: "Anna", last_name: "Vila"})

      resp =
        conn
        |> authed_conn()
        |> patch("/api/participants/#{p.id}", %{
          trips: [
            %{bus_id: bus1.id, direction: "anada"},
            %{bus_id: bus2.id, direction: "tornada"}
          ]
        })
        |> json_response(200)

      assert length(resp["data"]["trips"]) == 2
    end

    test "updates participant notes and companions fields", %{conn: conn, event: event} do
      {:ok, p} = Events.create_participant(event, %{first_name: "Pere", last_name: "Gomez"})

      resp =
        conn
        |> authed_conn()
        |> patch("/api/participants/#{p.id}", %{
          observations: "Needs wheelchair",
          companions: "3"
        })
        |> json_response(200)

      assert resp["data"]["observations"] == "Needs wheelchair"
      assert resp["data"]["companions"] == "3"
    end
  end

  describe "DELETE /api/participants/:id" do
    setup [:create_event_with_bus]

    test "deletes a participant", %{conn: conn, event: event} do
      {:ok, p} = Events.create_participant(event, %{first_name: "Anna", last_name: "Vila"})

      conn
      |> authed_conn()
      |> delete("/api/participants/#{p.id}")
      |> response(204)

      assert Events.list_participants(event) == []
    end
  end

  describe "GET /api/events/:id/participants" do
    setup [:create_event_with_bus]

    test "lists participants", %{conn: conn, event: event} do
      Events.create_participant(event, %{first_name: "Anna", last_name: "Vila"})

      resp =
        conn
        |> authed_conn()
        |> get("/api/events/#{event.id}/participants")
        |> json_response(200)

      assert length(resp["data"]) == 1
      assert hd(resp["data"])["first_name"] == "Anna"
    end
  end

  describe "POST /api/events/:id/import_form" do
    setup [:create_event_with_bus]

    test "imports from form with buses and castellers", %{conn: conn, event: event} do
      Req.Test.stub(:tenimaleta, fn conn ->
        cond do
          String.contains?(conn.request_path, "form_responses") ->
            Req.Test.json(conn, %{
              "responses" => %{
                "306" => %{
                  "mote" => "Garcia",
                  "q_transport" => "Bus Anada",
                  "createdAt" => "2025-01-01"
                }
              }
            })

          String.contains?(conn.request_path, "castellersInfo") ->
            Req.Test.json(conn, %{
              "306" => %{
                "id" => 306,
                "nom" => "Joan",
                "cognom" => "Garcia",
                "segon_cognom" => "Lopez",
                "mote" => "Garcia",
                "hidden" => 0
              }
            })

          true ->
            Plug.Conn.send_resp(conn, 404, "not found")
        end
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/import_form", %{
          form_id: "1001",
          transport_question_id: "q_transport",
          observations_question_id: nil,
          companions_question_id: nil,
          transport_option_mapping: %{
            "Bus Anada" => [%{"bus_index" => 0, "direction" => "anada"}]
          },
          buses: [%{"label" => "Bus Vic", "direction" => "anada"}]
        })
        |> json_response(201)

      assert resp["imported"] == 1
      assert length(resp["buses"]) == 1
    end

    test "returns bad_gateway when form responses fetch fails", %{conn: conn, event: event} do
      Req.Test.stub(:tenimaleta, fn conn ->
        Plug.Conn.send_resp(conn, 500, "error")
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      conn
      |> authed_conn()
      |> post("/api/events/#{event.id}/import_form", %{
        form_id: "1001",
        transport_question_id: "q_transport",
        transport_option_mapping: %{},
        buses: []
      })
      |> json_response(502)
    end

    test "returns bad_gateway when castellers fetch fails", %{conn: conn, event: event} do
      Req.Test.stub(:tenimaleta, fn conn ->
        cond do
          String.contains?(conn.request_path, "form_responses") ->
            Req.Test.json(conn, %{"responses" => %{}})

          true ->
            Plug.Conn.send_resp(conn, 500, "error")
        end
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      conn
      |> authed_conn()
      |> post("/api/events/#{event.id}/import_form", %{
        form_id: "1001",
        transport_question_id: "q_transport",
        transport_option_mapping: %{},
        buses: []
      })
      |> json_response(502)
    end

    test "imports with observations and companions questions", %{conn: conn, event: event} do
      Req.Test.stub(:tenimaleta, fn conn ->
        cond do
          String.contains?(conn.request_path, "form_responses") ->
            Req.Test.json(conn, %{
              "responses" => %{
                "306" => %{
                  "mote" => "Garcia",
                  "q_transport" => "Bus Vic",
                  "q_obs" => "Needs seat",
                  "q_comp" => "2",
                  "createdAt" => "2025-01-01"
                }
              }
            })

          String.contains?(conn.request_path, "castellersInfo") ->
            Req.Test.json(conn, %{
              "306" => %{
                "id" => 306,
                "nom" => "Joan",
                "cognom" => "Garcia",
                "mote" => "Garcia",
                "hidden" => 0
              }
            })

          true ->
            Plug.Conn.send_resp(conn, 404, "not found")
        end
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/import_form", %{
          form_id: "1001",
          transport_question_id: "q_transport",
          observations_question_id: "q_obs",
          companions_question_id: "q_comp",
          transport_option_mapping: %{
            "Bus Vic" => [%{"bus_index" => 0, "direction" => "anada"}]
          },
          buses: [%{"label" => "Bus Vic", "direction" => "anada"}]
        })
        |> json_response(201)

      assert resp["imported"] == 1

      participants = Events.list_participants_with_trips(event)
      p = hd(participants)
      assert p.observations == "Needs seat"
      assert p.companions == "2"
    end

    test "rejects rows with empty name", %{conn: conn, event: event} do
      Req.Test.stub(:tenimaleta, fn conn ->
        cond do
          String.contains?(conn.request_path, "form_responses") ->
            Req.Test.json(conn, %{
              "responses" => %{
                "999" => %{"mote" => "", "q_transport" => "", "createdAt" => "2025-01-01"}
              }
            })

          String.contains?(conn.request_path, "castellersInfo") ->
            Req.Test.json(conn, %{
              "999" => %{"id" => 999, "nom" => "", "cognom" => "", "mote" => "", "hidden" => 0}
            })

          true ->
            Plug.Conn.send_resp(conn, 404, "not found")
        end
      end)

      Application.put_env(:sagals, :req_options, plug: {Req.Test, :tenimaleta})
      on_exit(fn -> Application.delete_env(:sagals, :req_options) end)

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/import_form", %{
          form_id: "1001",
          transport_question_id: "q_transport",
          transport_option_mapping: %{},
          buses: []
        })
        |> json_response(201)

      assert resp["imported"] == 0
    end
  end

  describe "POST /api/events/:id/participants/import with error" do
    setup [:create_event_with_bus]

    test "rejects rows where both first_name and last_name are empty", %{conn: conn, event: event} do
      transport_mapping = %{}

      rows = [
        %{
          "first_name" => "",
          "last_name" => "",
          "nickname" => "",
          "transport_raw" => "",
          "observations" => "",
          "companions" => ""
        }
      ]

      column_mapping = %{
        "firstName" => 0,
        "lastName" => 1,
        "last_name2" => 2,
        "nickname" => 3,
        "transport" => 4,
        "observations" => 5,
        "companions" => 6
      }

      resp =
        conn
        |> authed_conn()
        |> post("/api/events/#{event.id}/participants/import", %{
          rows: rows,
          column_mapping: column_mapping,
          transport_mapping: transport_mapping
        })
        |> json_response(201)

      assert resp["imported"] == 0
    end
  end
end
