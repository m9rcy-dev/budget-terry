import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@budget-terry/api-client";
import LoginPage from "./page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const loginMock = vi.fn();
vi.mock("../../lib/auth-context", () => ({
  useAuth: () => ({
    login: loginMock,
    register: vi.fn(),
    logout: vi.fn(),
    user: null,
    isLoading: false,
  }),
}));

describe("LoginPage", () => {
  it("submits the form and redirects to the dashboard on success", async () => {
    loginMock.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "a-long-enough-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith({
        email: "person@example.com",
        password: "a-long-enough-password",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows an invalid-credentials message when the API rejects the login", async () => {
    loginMock.mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "bad credentials"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("shows a server-unreachable message when the request never reaches the API", async () => {
    loginMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByText("Could not reach the server. Is the API running?"),
    ).toBeInTheDocument();
  });
});
