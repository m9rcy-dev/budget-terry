import { render, screen } from "@testing-library/react-native";
import HomeScreen from "./index";

const mockReplace = jest.fn();
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    useRouter: () => ({ replace: mockReplace }),
    Link: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

const mockLogout = jest.fn();
const mockUseAuth = jest.fn();
jest.mock("../lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("shows the logged-in user once authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "person@example.com", displayName: "Person" },
      isLoading: false,
      logout: mockLogout,
    });

    render(<HomeScreen />);

    expect(screen.getByText("Budget Terry")).toBeTruthy();
    expect(screen.getByText("Logged in as Person (person@example.com)")).toBeTruthy();
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, logout: mockLogout });

    render(<HomeScreen />);

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });
});
