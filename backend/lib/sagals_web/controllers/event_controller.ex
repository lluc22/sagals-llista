defmodule SagalsWeb.EventController do
  use SagalsWeb, :controller

  alias Sagals.Events

  def index(conn, _params) do
    events = Events.list_events()
    json(conn, %{data: Enum.map(events, &serialize/1)})
  end

  def show(conn, %{"id" => id}) do
    event = Events.get_event!(id)
    json(conn, %{data: serialize(event)})
  end

  def create(conn, params) do
    case Events.create_event(params) do
      {:ok, event} ->
        conn |> put_status(:created) |> json(%{data: serialize(event)})

      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    event = Events.get_event!(id)

    case Events.update_event(event, Map.drop(params, ["id"])) do
      {:ok, event} -> json(conn, %{data: serialize(event)})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def activate(conn, %{"event_id" => id}) do
    event = Events.get_event!(id)

    case Events.activate_event(event) do
      {:ok, event} -> json(conn, %{data: serialize(event)})
      {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  defp serialize(e) do
    %{
      id: e.id,
      name: e.name,
      date: e.date,
      slug: e.slug,
      status: e.status,
      access_token: e.access_token,
      column_mapping: e.column_mapping,
      transport_mapping: e.transport_mapping,
      inserted_at: e.inserted_at
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
