defmodule Sagals.Tenimaleta do
  @base_url "https://sagals-api.tenimaleta.com/api"

  defp api_key, do: Application.get_env(:sagals, :tenimaleta_api_key, "")

  defp req_options, do: Application.get_env(:sagals, :req_options, [])

  def get_forms do
    case Req.get("#{@base_url}/get_all_forms", req_options_with_auth()) do
      {:ok, %{status: 200, body: body}} when is_map(body) ->
        {:ok, body}

      {:ok, %{status: status}} ->
        {:error, "API returned status #{status}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def get_form_responses(form_id) do
    case Req.get("#{@base_url}/form_responses/#{form_id}", req_options_with_auth()) do
      {:ok, %{status: 200, body: %{"responses" => responses}}} ->
        {:ok, responses}

      {:ok, %{status: 200, body: body}} when is_map(body) ->
        {:ok, body}

      {:ok, %{status: status}} ->
        {:error, "API returned status #{status}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def get_calendar do
    case Req.get("#{@base_url}/calendar", req_options_with_auth()) do
      {:ok, %{status: 200, body: %{"calendar_events" => %{"events" => events}}}}
      when is_list(events) ->
        {:ok, map_calendar_events(events)}

      {:ok, %{status: 200, body: body}} when is_map(body) ->
        {:ok, body}

      {:ok, %{status: status}} ->
        {:error, "API returned status #{status}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def get_castellers do
    case Req.get("#{@base_url}/castellersInfo", req_options_with_auth()) do
      {:ok, %{status: 200, body: body}} when is_map(body) ->
        {:ok, body}

      {:ok, %{status: status}} ->
        {:error, "API returned status #{status}"}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp req_options_with_auth do
    [headers: [{"x-api-key", api_key()}]] ++ req_options()
  end

  defp map_calendar_events(events) do
    events
    |> Enum.filter(&(&1["id"] != nil))
    |> Enum.into(%{}, fn event ->
      id = to_string(event["id"])

      {id,
       %{
         "id" => id,
         "title" => event["title"] || "",
         "start" => event["data-esperada-inici"] || event["start"] || "",
         "end" => event["data-esperada-fi"] || event["end"] || ""
       }}
    end)
  end
end
