import request from "supertest";
import { startIntegrationApp, type IntegrationApp } from "./integration-app";

describe("calendar", () => {
  let integrationApp: IntegrationApp;

  beforeAll(async () => {
    integrationApp = await startIntegrationApp();
  });

  afterAll(async () => {
    await integrationApp.stop();
  });

  function http() {
    return request(integrationApp.app.getHttpServer());
  }

  function isoDate(daysFromToday: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + daysFromToday);
    return date.toISOString().slice(0, 10);
  }

  async function registerUserWithAccount(
    email: string,
  ): Promise<{ accessToken: string; accountId: string }> {
    const registerResponse = await http()
      .post("/auth/register")
      .send({ email, password: "a-very-long-password", displayName: "Test" })
      .expect(201);
    const accessToken = registerResponse.body.accessToken as string;

    const account = await http()
      .post("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Everyday", type: "EVERYDAY", currency: "NZD" })
      .expect(201);

    return { accessToken, accountId: account.body.id };
  }

  it("returns bill occurrences and income transactions within range, sorted by date", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("alice-calendar@example.com");
    const today = isoDate(0);

    await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Internet",
        amountMinorUnits: 8500,
        recurrence: "ONE_OFF",
        firstDueDate: isoDate(5),
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        type: "INCOME",
        amountMinorUnits: 410000,
        transactionDate: today,
        merchant: "Salary",
      })
      .expect(201);

    const entries = await http()
      .get(`/calendar/entries?from=${today}&to=${isoDate(10)}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(entries.body).toHaveLength(2);
    expect(entries.body[0]).toMatchObject({ type: "INCOME", date: today, merchant: "Salary" });
    expect(entries.body[1]).toMatchObject({ type: "BILL", date: isoDate(5), name: "Internet" });
  });

  it("excludes entries outside the requested range", async () => {
    const { accessToken, accountId } = await registerUserWithAccount("bob-calendar@example.com");
    const today = isoDate(0);

    await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Rates",
        amountMinorUnits: 30000,
        recurrence: "ONE_OFF",
        firstDueDate: isoDate(60),
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        accountId,
        type: "INCOME",
        amountMinorUnits: 5000,
        transactionDate: isoDate(-30),
        merchant: "Old",
      })
      .expect(201);

    const entries = await http()
      .get(`/calendar/entries?from=${today}&to=${isoDate(10)}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(entries.body).toHaveLength(0);
  });

  it("includes occurrences from an archived bill — the calendar is a factual record, not a management list", async () => {
    const { accessToken } = await registerUserWithAccount("carol-calendar@example.com");
    const today = isoDate(0);

    const bill = await http()
      .post("/bills")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Netflix",
        amountMinorUnits: 2500,
        recurrence: "ONE_OFF",
        firstDueDate: isoDate(3),
      })
      .expect(201);
    await http()
      .post(`/bills/${bill.body.id}/archive`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(201);

    const entries = await http()
      .get(`/calendar/entries?from=${today}&to=${isoDate(10)}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(entries.body).toHaveLength(1);
    expect(entries.body[0]).toMatchObject({ type: "BILL", name: "Netflix" });
  });

  it("rejects a request missing the required from/to query parameters", async () => {
    const { accessToken } = await registerUserWithAccount("dave-calendar@example.com");

    await http().get("/calendar/entries").set("Authorization", `Bearer ${accessToken}`).expect(400);
  });

  it("CRITICAL: a user's calendar never includes another user's bills or income", async () => {
    const userA = await registerUserWithAccount("erin-calendar@example.com");
    const userB = await registerUserWithAccount("frank-calendar@example.com");
    const today = isoDate(0);

    await http()
      .post("/bills")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        name: "Mortgage",
        amountMinorUnits: 250000,
        recurrence: "ONE_OFF",
        firstDueDate: isoDate(2),
      })
      .expect(201);
    await http()
      .post("/transactions")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({
        accountId: userA.accountId,
        type: "INCOME",
        amountMinorUnits: 400000,
        transactionDate: today,
        merchant: "Salary",
      })
      .expect(201);

    const entriesForB = await http()
      .get(`/calendar/entries?from=${today}&to=${isoDate(10)}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .expect(200);

    expect(entriesForB.body).toHaveLength(0);
  });
});
