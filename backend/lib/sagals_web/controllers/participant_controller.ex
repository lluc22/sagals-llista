defmodule SagalsWeb.ParticipantController do
  use SagalsWeb, :controller

  alias Sagals.{Events, Tenimaleta}

  def index(conn, %{"event_id" => event_id}) do
    event = Events.get_event!(event_id)
    participants = Events.list_participants_with_trips(event)
    json(conn, %{data: Enum.map(participants, &serialize/1)})
  end

  def import(conn, %{
        "event_id" => event_id,
        "rows" => rows,
        "column_mapping" => col_map,
        "transport_mapping" => mapping
      }) do
    event = Events.get_event!(event_id)

    rows_parsed =
      rows
      |> Enum.map(fn r ->
        if is_map(r) and not is_struct(r) and Map.has_key?(r, "first_name") do
          %{
            first_name: Map.get(r, "first_name", "") |> to_string() |> String.trim(),
            last_name: Map.get(r, "last_name", "") |> to_string() |> String.trim(),
            last_name2: Map.get(r, "last_name2", "") |> to_string() |> String.trim(),
            nickname: Map.get(r, "nickname", "") |> to_string() |> String.trim(),
            transport_raw: Map.get(r, "transport_raw", "") |> to_string() |> String.trim(),
            observations: Map.get(r, "observations", "") |> to_string() |> String.trim(),
            companions: Map.get(r, "companions", "") |> to_string() |> String.trim()
          }
        else
          %{
            first_name: col(r, col_map["firstName"]),
            last_name: col(r, col_map["lastName"]),
            last_name2: col(r, col_map["last_name2"]),
            nickname: col(r, col_map["nickname"]),
            transport_raw: col(r, col_map["transport"]),
            observations: col(r, col_map["observations"]),
            companions: col(r, col_map["companions"])
          }
        end
      end)
      |> Enum.reject(fn row -> row.first_name == "" and row.last_name == "" end)

    case Events.import_participants(event, rows_parsed, mapping) do
      {:ok, count} ->
        conn |> put_status(:created) |> json(%{imported: count})

      {:error, reason} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
    end
  end

  def import_form(
        conn,
        %{
          "event_id" => event_id,
          "form_id" => form_id,
          "transport_question_id" => transport_q_id,
          "transport_option_mapping" => option_mapping,
          "buses" => buses_params
        } = params
      ) do
    event = Events.get_event!(event_id)

    with {:ok, responses} <- Tenimaleta.get_form_responses(to_string(form_id)),
         {:ok, castellers_map} <- Tenimaleta.get_castellers() do
      observations_q_id = params["observations_question_id"]
      companions_q_id = params["companions_question_id"]

      buses =
        buses_params
        |> Enum.with_index()
        |> Enum.map(fn {_b, i} ->
          {:ok, bus} = Events.create_bus(event, Map.put(Enum.at(buses_params, i), "order", i))
          bus
        end)

      bus_id_map =
        buses_params
        |> Enum.with_index()
        |> Enum.map(fn {_b, i} -> {i, Enum.at(buses, i).id} end)
        |> Map.new()

      resolved_mapping = resolve_option_mapping(option_mapping, bus_id_map)

      rows =
        responses
        |> Enum.map(fn {casteller_id_str, resp} ->
          casteller = Map.get(castellers_map, casteller_id_str, %{})

          nickname = Map.get(resp, "mote", "") || ""
          first_name = Map.get(casteller, "nom", nickname)
          last_name = Map.get(casteller, "cognom", "")
          last_name2 = Map.get(casteller, "segon_cognom", "") || ""

          transport_value = get_question_value(resp, transport_q_id)

          observations_value =
            if observations_q_id, do: get_question_value(resp, observations_q_id), else: ""

          companions_value =
            if companions_q_id, do: get_question_value(resp, companions_q_id), else: ""

          trips_data = resolve_trips(transport_value, resolved_mapping)

          %{
            first_name: first_name,
            last_name: last_name,
            last_name2: last_name2,
            nickname: nickname,
            transport_raw: transport_value,
            observations: observations_value,
            companions: companions_value,
            trips_data: trips_data
          }
        end)
        |> Enum.reject(fn row -> row.first_name == "" and row.last_name == "" end)

      case Events.import_form_participants(event, rows) do
        {:ok, count} ->
          Events.update_event(event, %{
            "form_id" => form_id,
            "form_mapping" => %{
              "transport_question_id" => transport_q_id,
              "observations_question_id" => observations_q_id,
              "companions_question_id" => companions_q_id,
              "transport_option_mapping" => option_mapping
            }
          })

          conn
          |> put_status(:created)
          |> json(%{imported: count, buses: Enum.map(buses, &serialize_bus/1)})

        {:error, reason} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: inspect(reason)})
      end
    else
      {:error, reason} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{error: "Cannot fetch form data: #{inspect(reason)}"})
    end
  end

  def create(conn, %{"event_id" => event_id} = params) do
    event = Events.get_event!(event_id)

    attrs =
      Map.take(params, [
        "first_name",
        "last_name",
        "last_name2",
        "nickname",
        "transport_raw",
        "observations",
        "companions"
      ])

    case Events.create_participant(event, attrs) do
      {:ok, p} ->
        p = Sagals.Repo.preload(p, :participant_trips)
        conn |> put_status(:created) |> json(%{data: serialize(p)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def update(conn, %{"id" => id} = params) do
    participant = Events.get_participant!(id)

    case Events.update_participant(participant, Map.drop(params, ["id", "trips"])) do
      {:ok, p} ->
        if Map.has_key?(params, "trips") do
          {:ok, _} = Events.replace_participant_trips(p, params["trips"])
        end

        p = Sagals.Repo.preload(p, [participant_trips: :bus], force: true)
        json(conn, %{data: serialize(p)})

      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  def delete(conn, %{"id" => id}) do
    participant = Events.get_participant!(id)
    {:ok, _} = Events.delete_participant(participant)
    send_resp(conn, :no_content, "")
  end

  defp col(row, idx) when is_integer(idx) and idx >= 0 do
    row |> Enum.at(idx, "") |> to_string() |> String.trim()
  end

  defp col(_row, _), do: ""

  defp get_question_value(resp, q_id) do
    case Map.get(resp, q_id) do
      nil -> ""
      val when is_binary(val) -> val
      val when is_number(val) -> to_string(val)
      val when is_list(val) -> val |> Enum.map(&to_string/1) |> Enum.join(", ")
      _ -> ""
    end
  end

  defp resolve_option_mapping(option_mapping, bus_id_map) do
    Map.new(option_mapping, fn {k, v} ->
      resolved =
        Enum.map(v, fn entry ->
          %{
            "bus_id" => Map.get(bus_id_map, entry["bus_index"], entry["bus_id"]),
            "direction" => entry["direction"]
          }
        end)

      {k, resolved}
    end)
  end

  defp resolve_trips(transport_value, resolved_mapping) do
    case Map.get(resolved_mapping, to_string(transport_value)) do
      nil -> []
      trips -> trips
    end
  end

  defp serialize_bus(b) do
    %{
      id: b.id,
      event_id: b.event_id,
      label: b.label,
      departure_time: b.departure_time,
      direction: b.direction,
      order: b.order
    }
  end

  defp serialize(p) do
    trips =
      if Ecto.assoc_loaded?(p.participant_trips) do
        p.participant_trips
        |> Enum.sort_by(& &1.bus.departure_time)
        |> Enum.map(fn t ->
          %{id: t.id, bus_id: t.bus_id, direction: t.direction}
        end)
      else
        []
      end

    %{
      id: p.id,
      event_id: p.event_id,
      first_name: p.first_name,
      last_name: p.last_name,
      last_name2: p.last_name2,
      nickname: p.nickname,
      transport_raw: p.transport_raw,
      observations: p.observations,
      companions: p.companions,
      reviewed: p.reviewed,
      trips: trips
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
