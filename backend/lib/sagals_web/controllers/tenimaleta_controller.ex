defmodule SagalsWeb.TenimaletaController do
  use SagalsWeb, :controller

  alias Sagals.Tenimaleta

  def forms(conn, _params) do
    case Tenimaleta.get_forms() do
      {:ok, forms} ->
        json(conn, %{data: forms})

      {:error, _reason} ->
        conn |> put_status(:bad_gateway) |> json(%{error: "Cannot fetch forms"})
    end
  end

  def form_responses(conn, %{"form_id" => form_id}) do
    case Tenimaleta.get_form_responses(form_id) do
      {:ok, responses} ->
        json(conn, %{data: responses})

      {:error, _reason} ->
        conn |> put_status(:bad_gateway) |> json(%{error: "Cannot fetch form responses"})
    end
  end

  def calendar(conn, _params) do
    case Tenimaleta.get_calendar() do
      {:ok, calendar} ->
        json(conn, %{data: calendar})

      {:error, _reason} ->
        conn |> put_status(:bad_gateway) |> json(%{error: "Cannot fetch calendar"})
    end
  end

  def castellers(conn, _params) do
    case Tenimaleta.get_castellers() do
      {:ok, castellers} ->
        json(conn, %{data: castellers})

      {:error, _reason} ->
        conn |> put_status(:bad_gateway) |> json(%{error: "Cannot fetch castellers"})
    end
  end
end
