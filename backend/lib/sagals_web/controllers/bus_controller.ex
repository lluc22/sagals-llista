defmodule SagalsWeb.BusController do
  use SagalsWeb, :controller

  alias Sagals.Events

  def index(conn, %{"event_id" => event_id}) do
    event = Events.get_event!(event_id)
    buses = Events.list_buses(event)
    json(conn, %{data: Enum.map(buses, &serialize/1)})
  end

  def create(conn, %{"event_id" => event_id} = params) do
    event = Events.get_event!(event_id)

    case Events.create_bus(event, Map.drop(params, ["event_id"])) do
      {:ok, bus} ->
        conn |> put_status(:created) |> json(%{data: serialize(bus)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    bus = Events.get_bus!(id)

    case Events.update_bus(bus, Map.drop(params, ["id"])) do
      {:ok, bus} ->
        json(conn, %{data: serialize(bus)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def delete(conn, %{"id" => id}) do
    bus = Events.get_bus!(id)
    {:ok, _} = Events.delete_bus(bus)
    send_resp(conn, :no_content, "")
  end

  defp serialize(b) do
    %{
      id: b.id,
      event_id: b.event_id,
      label: b.label,
      departure_time: b.departure_time,
      direction: b.direction,
      order: b.order
    }
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
