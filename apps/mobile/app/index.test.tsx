import { render, screen } from "@testing-library/react-native";
import HomeScreen from "./index";

describe("HomeScreen", () => {
  it("renders the Budget Terry title", () => {
    render(<HomeScreen />);

    expect(screen.getByText("Budget Terry")).toBeTruthy();
  });
});
