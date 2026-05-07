defmodule SagalsWeb.Plugs.RequireListAccess do
  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  def init(opts), do: opts

  def call(conn, _opts) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, event_id} <- Sagals.Auth.verify_list_token(token),
         event <- Sagals.Events.get_event!(event_id) do
      assign(conn, :current_event, event)
    else
      _ ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Unauthorized"})
        |> halt()
    end
  end
end
