import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@budget-terry/api-client";
import LoginPage from "./page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const loginMock = vi.fn();
const requestLoginCodeMock = vi.fn();
const loginWithCodeMock = vi.fn();
vi.mock("../../lib/auth-context", () => ({
  useAuth: () => ({
    login: loginMock,
    register: vi.fn(),
    requestLoginCode: requestLoginCodeMock,
    loginWithCode: loginWithCodeMock,
    logout: vi.fn(),
    user: null,
    isLoading: false,
  }),
}));

describe("LoginPage", () => {
  it("defaults to the email-code request form", () => {
    render(<LoginPage />);

    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });

  it("requests a code, then verifies it and redirects to the dashboard", async () => {
    requestLoginCodeMock.mockResolvedValue(undefined);
    loginWithCodeMock.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));

    await waitFor(() => expect(requestLoginCodeMock).toHaveBeenCalledWith("person@example.com"));
    expect(await screen.findByLabelText("Code")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "042817" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() =>
      expect(loginWithCodeMock).toHaveBeenCalledWith("person@example.com", "042817", false),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("checking 'Remember this device' passes rememberDevice: true", async () => {
    requestLoginCodeMock.mockResolvedValue(undefined);
    loginWithCodeMock.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByLabelText("Code"), { target: { value: "042817" } });
    fireEvent.click(screen.getByText("Remember this device — skip this step next time"));
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    await waitFor(() =>
      expect(loginWithCodeMock).toHaveBeenCalledWith("person@example.com", "042817", true),
    );
  });

  it("shows an invalid-code message when the API rejects the code", async () => {
    requestLoginCodeMock.mockResolvedValue(undefined);
    loginWithCodeMock.mockRejectedValue(new ApiError(401, "INVALID_CODE", "bad code"));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
    fireEvent.change(await screen.findByLabelText("Code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify code" }));

    expect(await screen.findByText("That code is invalid or has expired.")).toBeInTheDocument();
  });

  it("switches to password login and back via the mode links", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Log in with password instead" }));
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Log in with a code instead" }));
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  });

  it("password mode: submits the form and redirects to the dashboard on success", async () => {
    loginMock.mockResolvedValue(undefined);
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Log in with password instead" }));

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

  it("password mode: shows an invalid-credentials message when the API rejects the login", async () => {
    loginMock.mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "bad credentials"));
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Log in with password instead" }));

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("password mode: shows a server-unreachable message when the request never reaches the API", async () => {
    loginMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Log in with password instead" }));

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(
      await screen.findByText(
        "The server may be waking up after being idle — please try again in a few seconds.",
      ),
    ).toBeInTheDocument();
  });
});
