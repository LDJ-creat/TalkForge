import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CefrLevelGuide } from "@/components/cefr-level-guide";
import { cefrLevelGuideCopy } from "@/lib/cefr-level-guide";

describe("CefrLevelGuide", () => {
  it("renders CEFR level explanations on the home layout", () => {
    render(<CefrLevelGuide variant="compact" />);

    expect(screen.getByTestId("cefr-level-guide")).toBeInTheDocument();
    expect(screen.getByText(cefrLevelGuideCopy.title)).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText("基础")).toBeInTheDocument();
  });

  it("shows create-page hint when requested", () => {
    render(<CefrLevelGuide variant="full" showCreateHint />);

    expect(screen.getByText(cefrLevelGuideCopy.createHint)).toBeInTheDocument();
  });
});
