defmodule SagalsWeb.AttendanceChannelTest do
  use SagalsWeb.ChannelCase, async: true

  alias Sagals.{Auth, Events}

  setup do
    {:ok, event} =
      Events.create_event(%{
        name: "Channel Test",
        date: ~D[2025-01-01],
        slug: "channel-test-#{System.unique_integer()}"
      })

    {:ok, activated} = Events.activate_event(event)
    {:ok, bus} = Events.create_bus(activated, %{label: "Bus Vic", direction: "anada", order: 1})
    {:ok, p} = Events.create_participant(activated, %{first_name: "Anna", last_name: "Vila"})

    {:ok, updated} =
      Events.replace_participant_trips(p, [%{"bus_id" => bus.id, "direction" => "anada"}])

    trip = hd(updated.participant_trips)

    token = Auth.generate_list_token(activated.id)
    {:ok, socket} = connect(SagalsWeb.UserSocket, %{"token" => token})
    {:ok, _, socket} = subscribe_and_join(socket, "attendance:#{bus.id}:anada")

    {:ok, bus: bus, trip: trip, socket: socket}
  end

  describe "join" do
    test "joins attendance channel with valid list token" do
      {:ok, event} =
        Events.create_event(%{
          name: "Join Test",
          date: ~D[2025-01-01],
          slug: "join-test-#{System.unique_integer()}"
        })

      {:ok, activated} = Events.activate_event(event)
      token = Auth.generate_list_token(activated.id)
      {:ok, _socket} = connect(SagalsWeb.UserSocket, %{"token" => token})
    end

    test "rejects connection without valid token" do
      assert :error = connect(SagalsWeb.UserSocket, %{"token" => "invalid"})
    end

    test "connects with admin token" do
      alias Sagals.Accounts

      {:ok, user} =
        Accounts.create_user(%{
          email: "admin_chan#{System.unique_integer()}@test.cat",
          password: "password123"
        })

      token = Auth.generate_admin_token(user.id)
      assert {:ok, _socket} = connect(SagalsWeb.UserSocket, %{"admin_token" => token})
    end

    test "rejects connection with unknown params" do
      assert :error = connect(SagalsWeb.UserSocket, %{})
    end
  end

  describe "handle_in mark" do
    test "marks attendance and broadcasts update", %{trip: trip, socket: socket} do
      trip_id = trip.id

      ref =
        push(socket, "mark", %{
          "trip_id" => trip.id,
          "status" => "present",
          "marked_by" => "checker1"
        })

      assert_reply ref, :ok, %{
        trip_id: ^trip_id,
        status: "present",
        marked_by: "checker1"
      }

      assert_broadcast "update", %{
        trip_id: ^trip_id,
        status: "present",
        marked_by: "checker1"
      }
    end

    test "updates existing attendance", %{trip: trip, socket: socket} do
      push(socket, "mark", %{
        "trip_id" => trip.id,
        "status" => "present",
        "marked_by" => "checker1"
      })

      assert_broadcast "update", _

      ref =
        push(socket, "mark", %{
          "trip_id" => trip.id,
          "status" => "absent",
          "marked_by" => "checker2"
        })

      assert_reply ref, :ok, %{status: "absent", marked_by: "checker2"}
    end

    test "returns error for invalid status", %{trip: trip, socket: socket} do
      ref =
        push(socket, "mark", %{
          "trip_id" => trip.id,
          "status" => "invalid_status",
          "marked_by" => "checker1"
        })

      assert_reply ref, :error, %{errors: errors}
      assert errors != nil
    end
  end
end
