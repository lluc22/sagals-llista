defmodule Sagals.Auth do
  @admin_salt "admin_token"
  @list_salt "list_access_token"

  def generate_admin_token(user_id) do
    Phoenix.Token.sign(SagalsWeb.Endpoint, @admin_salt, user_id)
  end

  def verify_admin_token(token) do
    Phoenix.Token.verify(SagalsWeb.Endpoint, @admin_salt, token, max_age: :infinity)
  end

  def generate_list_token(event_id) do
    Phoenix.Token.sign(SagalsWeb.Endpoint, @list_salt, event_id)
  end

  def verify_list_token(token) do
    Phoenix.Token.verify(SagalsWeb.Endpoint, @list_salt, token, max_age: :infinity)
  end
end
