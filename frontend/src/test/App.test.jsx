
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import App from "../App";

function mockLoginSuccess() {
  return {
    access_token: "test-token",
    token_type: "bearer",
    user: {
      id: 1,
      name: "Test User",
      email: "test@example.com",
    },
  };
}

function mockResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("JobTrack authentication UI", () => {
  it("redirects unauthenticated visitors to login", async () => {
    window.history.pushState({}, "", "/dashboard");

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /welcome back/i,
      })
    ).toBeInTheDocument();
  });

  it("renders the login form", () => {
    window.history.pushState({}, "", "/login");

    render(<App />);

    expect(
      screen.getByLabelText(/email address/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/^password$/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /log in/i })
    ).toBeInTheDocument();
  });

  it("shows an error when login credentials are rejected", async () => {
    window.history.pushState({}, "", "/login");

    fetch.mockResolvedValueOnce(
      mockResponse(
        { detail: "Incorrect email or password." },
        401
      )
    );

    const user = userEvent.setup();

    render(<App />);

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com"
    );

    await user.type(
      screen.getByLabelText(/^password$/i),
      "WrongPass123!"
    );

    await user.click(
      screen.getByRole("button", { name: /log in/i })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Incorrect email or password.");
  });

  it("renders the signup form", () => {
    window.history.pushState({}, "", "/signup");

    render(<App />);

    expect(
      screen.getByLabelText(/full name/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/email address/i)
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/^password$/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("signs up and stores the session after successful signup", async () => {
    window.history.pushState({}, "", "/signup");

    const session = mockLoginSuccess();

    // 1. Signup returns the token and user.
    fetch.mockImplementation(async (url) => {
      const endpoint = String(url);

      if (endpoint.endsWith("/auth/signup")) {
        return mockResponse(session, 201);
      }

      // 2. Session verification returns the user object,
      // not an array.
      if (endpoint.endsWith("/auth/me")) {
        return mockResponse(session.user);
      }

      // 3. The dashboard expects an array of jobs.
      if (endpoint.endsWith("/jobs")) {
        return mockResponse([]);
      }

      return mockResponse(
        { detail: "Unexpected API endpoint in test" },
        404
      );
    });

    const user = userEvent.setup();

    render(<App />);

    await user.type(
      screen.getByLabelText(/full name/i),
      "Test User"
    );

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com"
    );

    await user.type(
      screen.getByLabelText(/^password$/i),
      "TestPass123!"
    );

    await user.click(
      screen.getByRole("button", { name: /create account/i })
    );

    expect(
  await screen.findByRole("heading", { name: "Dashboard" })
).toBeInTheDocument();

expect(
  screen.getByText(
    /track your applications and take the next step in your career/i
  )
).toBeInTheDocument();

    await waitFor(() => {
      expect(
        sessionStorage.getItem("jobtrack_token")
      ).toBe(session.access_token);

      expect(
        JSON.parse(sessionStorage.getItem("jobtrack_user"))
      ).toEqual(session.user);
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/signup"),
      expect.objectContaining({
        method: "POST",
      })
    );

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${session.access_token}`,
        }),
      })
    );
  });

  it("shows a helpful message when the backend is unreachable", async () => {
    window.history.pushState({}, "", "/login");

    fetch.mockRejectedValueOnce(
      new TypeError("Failed to fetch")
    );

    const user = userEvent.setup();

    render(<App />);

    await user.type(
      screen.getByLabelText(/email address/i),
      "test@example.com"
    );

    await user.type(
      screen.getByLabelText(/^password$/i),
      "TestPass123!"
    );

    await user.click(
      screen.getByRole("button", { name: /log in/i })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/cannot connect to the backend/i);
  });
});
