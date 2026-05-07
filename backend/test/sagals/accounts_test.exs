defmodule Sagals.AccountsTest do
  use Sagals.DataCase, async: true

  alias Sagals.Accounts

  describe "create_user/1" do
    test "creates a user with valid data" do
      assert {:ok, user} = Accounts.create_user(%{email: "admin@sagals.cat", password: "secret123"})
      assert user.email == "admin@sagals.cat"
      assert user.hashed_password != nil
      assert user.hashed_password != "secret123"
    end

    test "rejects duplicate email" do
      {:ok, _} = Accounts.create_user(%{email: "dup@sagals.cat", password: "secret123"})
      assert {:error, changeset} = Accounts.create_user(%{email: "dup@sagals.cat", password: "other123"})
      assert %{email: ["has already been taken"]} = errors_on(changeset)
    end

    test "rejects short password" do
      assert {:error, changeset} = Accounts.create_user(%{email: "x@x.com", password: "short"})
      assert %{password: [_]} = errors_on(changeset)
    end

    test "rejects blank email" do
      assert {:error, changeset} = Accounts.create_user(%{email: "", password: "secret123"})
      assert %{email: [_]} = errors_on(changeset)
    end
  end

  describe "authenticate_user/2" do
    setup do
      {:ok, user} = Accounts.create_user(%{email: "auth@sagals.cat", password: "mypassword"})
      {:ok, user: user}
    end

    test "returns user with correct credentials", %{user: user} do
      assert {:ok, returned} = Accounts.authenticate_user("auth@sagals.cat", "mypassword")
      assert returned.id == user.id
    end

    test "returns error with wrong password" do
      assert {:error, :invalid_credentials} = Accounts.authenticate_user("auth@sagals.cat", "wrong")
    end

    test "returns error with unknown email" do
      assert {:error, :invalid_credentials} = Accounts.authenticate_user("nobody@sagals.cat", "any")
    end
  end
end
