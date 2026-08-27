import { render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "../app/(app)/index";

const mockReplace = jest.fn();
jest.mock("expo-router", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    useRouter: () => ({ replace: mockReplace }),
    usePathname: () => "/",
    Link: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
  };
});

jest.mock("../lib/api-client", () => ({ apiClient: {} }));

const mockGetDashboardSummary = jest.fn();
jest.mock("@budget-terry/api-client", () => ({
  getDashboardSummary: (...args: unknown[]) => mockGetDashboardSummary(...args),
}));

const mockLogout = jest.fn();
const mockUseAuth = jest.fn();
jest.mock("../lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockGetDashboardSummary.mockReset();
    mockGetDashboardSummary.mockResolvedValue({
      period: { from: "2026-08-01", to: "2026-08-19" },
      incomeMinorUnits: 0,
      expensesMinorUnits: 0,
      netMinorUnits: 0,
      categoryTotals: [],
      recentTransactions: [],
      upcomingBills: [],
    });
  });

  it("shows the logged-in user once authenticated", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "person@example.com", displayName: "Person" },
      isLoading: false,
      logout: mockLogout,
    });

    render(<HomeScreen />);

    expect(screen.getByText("Logged in as Person (person@example.com)")).toBeTruthy();
    await waitFor(() => expect(mockGetDashboardSummary).toHaveBeenCalled());
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, logout: mockLogout });

    render(<HomeScreen />);

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("shows the dashboard summary once loaded", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "user-1", email: "person@example.com", displayName: "Person" },
      isLoading: false,
      logout: mockLogout,
    });
    mockGetDashboardSummary.mockResolvedValue({
      period: { from: "2026-08-01", to: "2026-08-19" },
      incomeMinorUnits: 400000,
      expensesMinorUnits: 150000,
      netMinorUnits: 250000,
      categoryTotals: [],
      recentTransactions: [],
      upcomingBills: [],
    });

    render(<HomeScreen />);

    expect(await screen.findByText("$4000.00")).toBeTruthy();
    expect(screen.getByText("$1500.00")).toBeTruthy();
    expect(screen.getByText("$2500.00")).toBeTruthy();
  });
});
