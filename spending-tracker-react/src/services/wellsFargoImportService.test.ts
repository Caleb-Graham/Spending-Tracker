import { describe, expect, it } from "vitest";
import {
  classifyWellsFargoRow,
  createWellsFargoExcludedCsv,
  createWellsFargoImportPreview,
  parseWellsFargoCsv,
  type WellsFargoCsvRow,
} from "./wellsFargoImportService";

const row = (
  description: string,
  sourceCategory: string,
  amount: number,
): WellsFargoCsvRow => ({
  lineNumber: 2,
  date: "2025-01-15",
  account: "Checking",
  description,
  sourceCategory,
  tags: "",
  amount,
});

describe("Wells Fargo import classification", () => {
  it("treats Walmart as groceries", () => {
    const result = classifyWellsFargoRow(row("Walmart", "General Merchandise", -25));

    expect(result.status).toBe("import");
    expect(result.parentCategory).toBe("Food");
    expect(result.categoryName).toBe("Groceries");
  });

  it("separates known snack and convenience merchants from groceries", () => {
    const result = classifyWellsFargoRow(
      row("365 Retail Markets", "Groceries", -4.25),
    );

    expect(result.categoryName).toBe("Snacks & Convenience");
  });

  it("uses the gas-station estimate without treating vending as fuel", () => {
    const likelyFuel = classifyWellsFargoRow(row("Maverik #5303", "", -25));
    const likelySnack = classifyWellsFargoRow(row("Maverik #5303", "", -8));
    const vending = classifyWellsFargoRow(row("365 Market", "", -25));

    expect(likelyFuel.categoryName).toBe("Fuel");
    expect(likelyFuel.parentCategory).toBe("Transportation");
    expect(likelySnack.categoryName).toBe("Snacks & Convenience");
    expect(vending.categoryName).toBe("Snacks & Convenience");
  });

  it("maps the reviewed merchants", () => {
    expect(
      classifyWellsFargoRow(row("The Leagues Sports", "Entertainment", -14.41))
        .categoryName,
    ).toBe("Sporting Goods and Leagues");
    expect(
      classifyWellsFargoRow(row("Play It Again Sports", "General Merchandise", -20))
        .categoryName,
    ).toBe("Sporting Goods and Leagues");
    expect(
      classifyWellsFargoRow(row("GDF - Glenstone Purchase", "Other Expenses", -29.28))
        .categoryName,
    ).toBe("Weed, Vape, Drugs");
    expect(
      classifyWellsFargoRow(row("GallowayCreek", "Restaurants", -767.95))
        .categoryName,
    ).toBe("Rent");
  });

  it("excludes cash advances and identifiable bank transfers", () => {
    const advance = classifyWellsFargoRow(
      row("Instant Pmt From Cleo AI", "Other Income", 100),
    );
    const transfer = classifyWellsFargoRow(row("Online Transfer", "Transfers", 500));

    expect(advance.status).toBe("skip");
    expect(transfer.status).toBe("skip");
  });

  it("categorizes Venmo movements and mobile deposits", () => {
    const venmo = classifyWellsFargoRow(
      row("Instant Pmt From Venmo", "Transfers", 49.13),
    );
    const mobileDeposit = classifyWellsFargoRow(
      row("Mobile Deposit : Ref Number 1234", "Deposits", 500),
    );
    const outgoingVenmo = classifyWellsFargoRow(
      row("Instant Pmt To Venmo", "Transfers", -49.13),
    );

    expect(venmo.status).toBe("import");
    expect(venmo.categoryName).toBe("Other Income");
    expect(venmo.parentCategory).toBe("Income");
    expect(mobileDeposit.status).toBe("import");
    expect(mobileDeposit.categoryName).toBe("Mobile Deposits");
    expect(outgoingVenmo.status).toBe("import");
    expect(outgoingVenmo.categoryName).toBe("Venmo");
    expect(outgoingVenmo.parentCategory).toBe("Other");
  });

  it("excludes advance principal while retaining explicit fees", () => {
    const repayment = classifyWellsFargoRow(
      row("Instacash Repayment", "Online Services", -217.98),
    );
    const fee = classifyWellsFargoRow(
      row("Credit Convey Fee", "Service Charges/Fees", -4.99),
    );

    expect(repayment.status).toBe("skip");
    expect(fee.status).toBe("import");
    expect(fee.categoryName).toBe("Cash Advance Fees");
  });

  it("parses quoted Wells Fargo CSV fields", () => {
    const parsed = parseWellsFargoCsv(
      'DATE,DESCRIPTION,AMOUNT,CHECK #,STATUS\n01/15/2025,"Ml Plus, Llc","$1,000.00",,Posted',
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0].description).toBe("Ml Plus, Llc");
    expect(parsed[0].amount).toBe(1000);
  });

  it("parses a direct checking-account CSV", () => {
    const parsed = parseWellsFargoCsv(
      "DATE,DESCRIPTION,AMOUNT,CHECK #,STATUS\n08/06/2026,MAVERIK #5303,-17.60,,Posted",
    );

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      date: "2026-08-06",
      account: "Checking",
      description: "MAVERIK #5303",
      sourceCategory: "",
      tags: "Posted",
      amount: -17.6,
    });
  });

  it("maps direct-bank merchants without a Wells Fargo category", () => {
    expect(classifyWellsFargoRow(row("MAVERIK #5303", "", -17.6)).categoryName)
      .toBe("Snacks & Convenience");
    expect(classifyWellsFargoRow(row("The Abbey Rent", "", -978.95)).categoryName)
      .toBe("Rent");
    expect(classifyWellsFargoRow(row("L E COX MEDICAL PAYROLL", "", 1100)).categoryName)
      .toBe("Paycheck");
  });

  it("separates dispensary cashless ATMs from real cash withdrawals", () => {
    const dispensaryRows = [
      "NON-WF ATM WITHDRAWAL AUTHORIZED ON 07/31 3903 S CAMPBELL AVE SPRINGFIELD MO 356212756709245 ATM ID A780471 CARD 5377",
      "NON-WF ATM WITHDRAWAL AUTHORIZED ON 07/16 2868 SOUTH GLENSTONE AV SPRINGFIELD MO 386197844349070 ATM ID NW62663 CARD 5377",
      "NON-WF ATM WITHDRAWAL AUTHORIZED ON 06/04 2500 BROADWAY BLUFFS DR COLUMBIA MO 586155803849569 ATM ID NW60354 CARD 5377",
      "NON-WF ATM WITHDRAWAL AUTHORIZED ON 11/25 202 WEST STREET STE 1 NIXA MO 465330004953175 ATM ID P714804 CARD 4518",
      "NON-WF ATM WITHDRAWAL AUTHORIZED ON 05/26 3837 S CAMPBELL AVE SPRINGFIELD MO 305146559288033 ATM ID UP503209 CARD 4518",
    ];

    for (const description of dispensaryRows) {
      expect(classifyWellsFargoRow(row(description, "", -49.25)).categoryName)
        .toBe("Weed, Vape, Drugs");
    }

    const creditUnionAtm = classifyWellsFargoRow(
      row(
        "NON-WF ATM WITHDRAWAL AUTHORIZED ON 04/10 3868 SOUTH AVE SPRINGFIELD MO 306100760341829 ATM ID ATT0094 CARD 4518",
        "",
        -102,
      ),
    );
    const gasStationAtm = classifyWellsFargoRow(
      row(
        "NON-WF ATM WITHDRAWAL AUTHORIZED ON 06/19 3109 W SUNSHINE ST SPRINGFIELD MO 305170794123697 ATM ID UP501490 CARD 4518",
        "",
        -33.5,
      ),
    );

    expect(creditUnionAtm.categoryName).toBe("Cash Withdrawals");
    expect(gasStationAtm.categoryName).toBe("Cash Withdrawals");
  });

  it("treats Wells Fargo Uber descriptions as food delivery", () => {
    const uberTechnologies = classifyWellsFargoRow(
      row("Uber Technologies, Inc Wilmington DE", "", -34.25),
    );
    const uberOne = classifyWellsFargoRow(
      row("UBER *ONE HELP.UBER.COM CA", "", -9.99),
    );

    expect(uberTechnologies.parentCategory).toBe("Food");
    expect(uberTechnologies.categoryName).toBe("Food Delivery");
    expect(uberOne.categoryName).toBe("Food Delivery");
  });

  it("marks an already-imported row as a duplicate", () => {
    const csv =
      "DATE,DESCRIPTION,AMOUNT,CHECK #,STATUS\n01/15/2025,Walmart,-25.00,,Posted";
    const preview = createWellsFargoImportPreview(csv, [
      {
        transactionId: 1,
        date: "2025-01-15T00:00:00Z",
        note: "Walmart",
        amount: -25,
        categoryId: 1,
        category: null,
        isIncome: false,
        accountId: 1,
      },
    ]);

    expect(preview.duplicates).toHaveLength(1);
    expect(preview.importable).toHaveLength(0);
  });

  it("exports excluded rows with their reasons", () => {
    const excluded = classifyWellsFargoRow(
      row('Online Transfer "From Savings"', "Transfers", 500),
    );

    const csv = createWellsFargoExcludedCsv([excluded]);

    expect(csv).toContain('"Online Transfer ""From Savings"""');
    expect(csv).toContain('"Transfer or cash advance deposit"');
  });

});
