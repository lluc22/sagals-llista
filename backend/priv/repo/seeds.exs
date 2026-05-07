alias Sagals.Accounts
alias Sagals.Accounts.User
alias Sagals.Repo

case Repo.get_by(User, email: "admin@sagals.cat") do
  nil ->
    {:ok, _user} = Accounts.create_user(%{email: "admin@sagals.cat", password: "sagals123"})
    IO.puts("Created admin user: admin@sagals.cat / sagals123")
  _user ->
    IO.puts("Admin user already exists")
end
