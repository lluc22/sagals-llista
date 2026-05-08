defmodule SagalsWeb.ChannelCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      @endpoint SagalsWeb.Endpoint

      import Phoenix.ChannelTest
      import SagalsWeb.ChannelCase
    end
  end

  setup tags do
    Sagals.DataCase.setup_sandbox(tags)
    :ok
  end
end
