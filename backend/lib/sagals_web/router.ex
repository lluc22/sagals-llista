defmodule SagalsWeb.Router do
  use SagalsWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :require_admin do
    plug SagalsWeb.Plugs.RequireAdmin
  end

  pipeline :require_list do
    plug SagalsWeb.Plugs.RequireListAccess
  end

  scope "/api", SagalsWeb do
    pipe_through :api

    post "/auth/login", AuthController, :login
    post "/auth/exchange", AuthController, :exchange
  end

  scope "/api", SagalsWeb do
    pipe_through [:api, :require_admin]

    resources "/events", EventController, only: [:index, :show, :create, :update] do
      post "/activate", EventController, :activate
      resources "/buses", BusController, only: [:index, :create]
      resources "/participants", ParticipantController, only: [:index]
      post "/participants/import", ParticipantController, :import
    end

    resources "/buses", BusController, only: [:update, :delete]
    resources "/participants", ParticipantController, only: [:update, :delete]
  end

  scope "/api/list", SagalsWeb do
    pipe_through [:api, :require_list]

    get "/buses", ListController, :buses
    get "/buses/:bus_id/:direction", ListController, :participants
    post "/attendance", ListController, :mark
    get "/castellers", ListController, :castellers
    get "/profile_pic/:id", ListController, :profile_pic
  end

  if Application.compile_env(:sagals, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]
      live_dashboard "/dashboard", metrics: SagalsWeb.Telemetry
    end
  end
end
