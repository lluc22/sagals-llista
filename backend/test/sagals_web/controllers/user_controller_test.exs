defmodule SagalsWeb.UserControllerTest do
  use SagalsWeb.ConnCase, async: true

  alias Sagals.{Accounts, Auth}

  defp authed_conn(conn) do
    {:ok, user} =
      Accounts.create_user(%{
        email: "admin#{System.unique_integer()}@test.cat",
        password: "password123"
      })

    token = Auth.generate_admin_token(user.id)
    conn = put_req_header(conn, "authorization", "Bearer #{token}")
    {conn, user}
  end

  describe "GET /api/users" do
    test "returns 401 without token", %{conn: conn} do
      conn |> get("/api/users") |> json_response(401)
    end

    test "lists users", %{conn: conn} do
      {conn, _user} = authed_conn(conn)

      resp = conn |> get("/api/users") |> json_response(200)

      assert is_list(resp["data"])
      assert length(resp["data"]) >= 1
      assert %{"id" => _, "email" => _} = hd(resp["data"])
    end
  end

  describe "POST /api/users" do
    test "creates a new user", %{conn: conn} do
      {conn, _admin} = authed_conn(conn)

      resp =
        conn
        |> post("/api/users", %{email: "newuser@test.cat", password: "pass1234"})
        |> json_response(201)

      assert resp["data"]["email"] == "newuser@test.cat"
      assert resp["data"]["id"]
    end

    test "returns 422 for duplicate email", %{conn: conn} do
      {conn, _admin} = authed_conn(conn)

      Accounts.create_user(%{email: "dup@test.cat", password: "password123"})

      conn
      |> post("/api/users", %{email: "dup@test.cat", password: "password123"})
      |> json_response(422)
    end

    test "returns 422 for short password", %{conn: conn} do
      {conn, _admin} = authed_conn(conn)

      conn
      |> post("/api/users", %{email: "short@test.cat", password: "abc"})
      |> json_response(422)
    end
  end

  describe "PUT /api/users/:id" do
    test "updates user email", %{conn: conn} do
      {conn, _admin} = authed_conn(conn)

      {:ok, target} = Accounts.create_user(%{email: "old@test.cat", password: "pass1234"})

      resp =
        conn
        |> put("/api/users/#{target.id}", %{email: "new@test.cat"})
        |> json_response(200)

      assert resp["data"]["email"] == "new@test.cat"
    end

    test "updates user password", %{conn: conn} do
      {conn, _admin} = authed_conn(conn)

      {:ok, target} = Accounts.create_user(%{email: "pwdupd@test.cat", password: "oldpassword"})

      resp =
        conn
        |> put("/api/users/#{target.id}", %{email: "pwdupd@test.cat", password: "newpassword"})
        |> json_response(200)

      assert resp["data"]["email"] == "pwdupd@test.cat"

      assert {:ok, _} = Accounts.authenticate_user("pwdupd@test.cat", "newpassword")
    end
  end

  describe "DELETE /api/users/:id" do
    test "deletes another user", %{conn: conn} do
      {conn, _admin} = authed_conn(conn)

      {:ok, target} = Accounts.create_user(%{email: "todelete@test.cat", password: "pass1234"})

      conn |> delete("/api/users/#{target.id}") |> response(204)

      refute Accounts.get_user_by_email("todelete@test.cat")
    end

    test "cannot delete self", %{conn: conn} do
      {conn, admin} = authed_conn(conn)

      resp =
        conn
        |> delete("/api/users/#{admin.id}")
        |> json_response(422)

      assert resp["errors"] == ["No pots eliminar-te a tu mateix"]
    end
  end
end
