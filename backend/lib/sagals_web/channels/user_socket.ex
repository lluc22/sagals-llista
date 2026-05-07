defmodule SagalsWeb.UserSocket do
  use Phoenix.Socket

  channel "attendance:*", SagalsWeb.AttendanceChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Sagals.Auth.verify_list_token(token) do
      {:ok, event_id} -> {:ok, assign(socket, :event_id, event_id)}
      _ -> :error
    end
  end

  def connect(%{"admin_token" => token}, socket, _connect_info) do
    case Sagals.Auth.verify_admin_token(token) do
      {:ok, user_id} -> {:ok, assign(socket, :user_id, user_id)}
      _ -> :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  @impl true
  def id(_socket), do: nil
end
