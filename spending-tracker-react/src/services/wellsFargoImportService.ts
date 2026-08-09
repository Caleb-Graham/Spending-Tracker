import { PostgrestClientFactory } from "./postgrestClientFactory";
import type { Transaction } from "./transactionService";
import { findUserAccountId } from "../utils/accountUtils";

export type WellsFargoImportStatus = "import" | "skip" | "review" | "duplicate";

export interface WellsFargoCsvRow {
  lineNumber: number;
  date: string;
  account: string;
  description: string;
  sourceCategory: string;
  tags: string;
  amount: number;
}

export interface WellsFargoImportRow extends WellsFargoCsvRow {
  status: WellsFargoImportStatus;
  parentCategory?: string;
  categoryName?: string;
  categoryType?: "Income" | "Expense";
  reason?: string;
}

export interface WellsFargoImportPreview {
  rows: WellsFargoImportRow[];
  importable: WellsFargoImportRow[];
  skipped: WellsFargoImportRow[];
  duplicates: WellsFargoImportRow[];
  needsReview: WellsFargoImportRow[];
  categorySummary: Array<{
    parentCategory: string;
    categoryName: string;
    count: number;
    amount: number;
  }>;
}

export interface WellsFargoImportResult {
  accountId: number;
  importedCount: number;
  duplicateCount: number;
}

type CategoryAssignment = {
  parentCategory: string;
  categoryName: string;
  categoryType: "Income" | "Expense";
};

const assign = (
  row: WellsFargoCsvRow,
  assignment: CategoryAssignment,
): WellsFargoImportRow => ({
  ...row,
  status: "import",
  ...assignment,
});

const skip = (row: WellsFargoCsvRow, reason: string): WellsFargoImportRow => ({
  ...row,
  status: "skip",
  reason,
});

const review = (row: WellsFargoCsvRow, reason: string): WellsFargoImportRow => ({
  ...row,
  status: "review",
  reason,
});

const income = (categoryName: string): CategoryAssignment => ({
  parentCategory: "Income",
  categoryName,
  categoryType: "Income",
});

const expense = (
  parentCategory: string,
  categoryName: string,
): CategoryAssignment => ({
  parentCategory,
  categoryName,
  categoryType: "Expense",
});

const venmoIn = (): CategoryAssignment => ({
  parentCategory: "Income",
  categoryName: "Other Income",
  categoryType: "Income",
});

const venmoOut = (): CategoryAssignment => ({
  parentCategory: "Other",
  categoryName: "Venmo",
  categoryType: "Expense",
});

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const matches = (value: string, pattern: RegExp) => pattern.test(value);

const FINANCE_PROVIDER_PATTERN =
  /instacash|moneylion|empower|tilt|albert|float ?me|brigit|klover|earnin|cleo|credit ?genie|true finance|jointrue|dave|ml plus|money app|aid inc|credit convey|grant|flexible fin|flex fin|atm com instant ca/i;

const TRANSFER_CATEGORIES = new Set([
  "transfers",
  "savings",
  "credit card payments",
]);

// Jacob estimates roughly 35% of gas-station spending is fuel. On the 2025
// Wells Fargo statement, treating gas-station purchases of $19.25+ as fuel
// assigns 34.8% of those merchant dollars to Fuel.
const GAS_STATION_FUEL_MINIMUM = 19.25;

// Several dispensaries run debit purchases as cashless ATM withdrawals, so the
// bank description contains only an ATM address and an amount that includes a
// terminal fee. Keep this address-based: amount endings alone would also catch
// legitimate withdrawals from ordinary ATMs.
const CANNABIS_CASHLESS_ATM_PATTERN =
  /atm id up503209|3903 (?:s|south)(?: west)? (?:campbell|cam)|2868 (?:s|south) glenstone|1510 (?:e |east )?sunshine|151 e sunshine|1015 e sunshine|2500 broadway bluffs|202 west (?:st|street)/;

const subscriptionAssignment = (
  description: string,
): CategoryAssignment | null => {
  const normalized = normalize(description);
  const subscriptions: Array<[RegExp, string]> = [
    [/amazon prime/, "Amazon Prime"],
    [/apple com bill/, "Apple"],
    [/atm com membership/, "ATM.com"],
    [/cable news network|\bcnn\b/, "CNN"],
    [/cleo/, "Cleo"],
    [/credit ?genie/, "Credit Genie"],
    [/empower/, "Empower"],
    [/grant/, "Grant"],
    [/rocket money/, "Rocket Money"],
    [/spotify/, "Spotify"],
    [/jointrue|true finance/, "True Finance"],
    [/youtube tv/, "YouTube TV"],
  ];

  const match = subscriptions.find(([pattern]) => pattern.test(normalized));
  return match ? expense("Subscriptions", match[1]) : null;
};

const isExplicitSubscription = (description: string, sourceCategory: string) =>
  /subscript|grant sub|connection|amazon prime|apple\.com\/bill|atm\.com membership|spotify|youtube tv|rocket money|cnn news/i.test(
    description,
  ) ||
  sourceCategory.toLowerCase() === "dues & subscriptions";

export const classifyWellsFargoRow = (row: WellsFargoCsvRow): WellsFargoImportRow => {
  const description = normalize(row.description);
  const sourceCategory = row.sourceCategory.trim().toLowerCase();

  if (!row.date || !row.description || !Number.isFinite(row.amount)) {
    return review(row, "Missing or invalid transaction data");
  }

  if (row.amount === 0) return skip(row, "Zero amount");
  if (row.tags.trim().toLowerCase() === "pending") {
    return skip(row, "Pending bank transaction");
  }

  const financeProvider = FINANCE_PROVIDER_PATTERN.test(description);
  const subscription = subscriptionAssignment(description);

  if (row.amount > 0) {
    if (
      sourceCategory === "paychecks/salary" ||
      matches(description, /l e cox medical payroll|lester e cox med pr payment/)
    ) {
      return assign(row, income("Paycheck"));
    }

    if (matches(description, /mobile deposit/)) {
      return assign(row, income("Mobile Deposits"));
    }

    if (matches(description, /venmo/)) {
      return assign(row, venmoIn());
    }

    if (matches(description, /instant pmt from uber usa/)) {
      return assign(row, income("Other Income"));
    }

    if (
      financeProvider ||
      TRANSFER_CATEGORIES.has(sourceCategory) ||
      matches(
        description,
        /online transfer|wfb opening deposit|newaccdep|from jacob kleinsmith|from kleinsmith jacob/,
      )
    ) {
      return skip(row, "Transfer or cash advance deposit");
    }

    if (matches(description, /draftkings|fanduel/)) {
      return assign(row, income("Gambling Winnings"));
    }

    if (matches(description, /gdf glenstone/)) {
      return assign(row, income("Refunds"));
    }

    if (
      sourceCategory === "refunds & reimbursements" ||
      matches(description, /refund|claim|missouri department of revenue|\birs\b/)
    ) {
      return assign(row, income("Refunds"));
    }

    if (sourceCategory === "other income" || sourceCategory === "deposits") {
      return assign(row, income("Other Income"));
    }

    return assign(row, income("Refunds"));
  }

  if (matches(description, /venmo/)) {
    return assign(row, venmoOut());
  }

  if (
    TRANSFER_CATEGORIES.has(sourceCategory) ||
    matches(description, /online transfer|wfb opening deposit/)
  ) {
    return skip(row, "Transfer or debt principal movement");
  }

  if (matches(description, /zelle to/)) {
    return assign(row, expense("Other", "Zelle"));
  }

  if (matches(description, /non wells fargo atm transaction fee/)) {
    return assign(row, expense("Fees", "ATM Fees"));
  }

  if (matches(description, /non wf atm withdrawal|atm withdrawal/)) {
    if (CANNABIS_CASHLESS_ATM_PATTERN.test(description)) {
      return assign(row, expense("Other", "Weed, Vape, Drugs"));
    }
    return assign(row, expense("Other", "Cash Withdrawals"));
  }

  if (matches(description, /metro cu newaccdep/)) {
    return skip(row, "Account transfer");
  }

  if (matches(description, /albert genius/)) {
    return assign(row, expense("Subscriptions", "Albert"));
  }

  if (matches(description, /klover plus/)) {
    return assign(row, expense("Subscriptions", "Klover"));
  }

  if (matches(description, /float me corp (payments|floatme su)/)) {
    return assign(row, expense("Subscriptions", "FloatMe"));
  }

  if (matches(description, /flexible fin|flex fin/) && Math.abs(row.amount) <= 20) {
    return assign(row, expense("Subscriptions", "Flexible Finance"));
  }

  if (matches(description, /true finance|jointrue/) && Math.abs(row.amount) <= 10) {
    return assign(row, expense("Subscriptions", "True Finance"));
  }

  if (financeProvider) {
    if (isExplicitSubscription(row.description, row.sourceCategory) && subscription) {
      return assign(row, subscription);
    }
    if (sourceCategory === "service charges/fees" || /\bfee\b|\btip\b/i.test(description)) {
      return assign(row, expense("Fees", "Cash Advance Fees"));
    }
    return skip(row, "Cash advance principal movement");
  }

  if (matches(description, /gallowaycreek|the abbey rent/)) {
    return assign(row, expense("Housing", "Rent"));
  }

  if (matches(description, /city utilities|cu portal utility/)) {
    return assign(row, expense("Housing", "Utilities"));
  }

  if (matches(description, /dublins pass/)) {
    return assign(row, expense("Food", "Restaurants"));
  }

  if (
    matches(
      description,
      /gdf glenstone|vape cbd kratom|royalty vape|royal vape|springfield vapors|discount smokes/,
    )
  ) {
    return assign(row, expense("Other", "Weed, Vape, Drugs"));
  }

  if (matches(description, /4up bill payne|hidden valley|greatlife|golf fitness/)) {
    return assign(row, expense("Sports", "Golf"));
  }

  if (matches(description, /bigshots golf|osage national|rivercut golf/)) {
    return assign(row, expense("Sports", "Golf"));
  }

  if (
    matches(
      description,
      /the leagues sports|play ?it ?again ?sports|kansas city stadiu/,
    )
  ) {
    return assign(row, expense("Sports", "Sporting Goods and Leagues"));
  }

  if (matches(description, /anytime f/)) {
    return assign(row, expense("Health", "Fitness"));
  }

  if (matches(description, /suppsuper/)) {
    return assign(row, expense("Health", "Supplements"));
  }

  if (matches(description, /rise digital|mardel christian/)) {
    return assign(row, expense("Other", "Other"));
  }

  if (matches(description, /uber|doordash/)) {
    return assign(row, expense("Food", "Food Delivery"));
  }

  if (matches(description, /lyft/)) {
    return assign(row, expense("Transportation", "Rideshare"));
  }

  if (matches(description, /walmart|wal mart|wm superc/)) {
    return assign(row, expense("Food", "Groceries"));
  }

  if (matches(description, /price cutter|food 4 less|hy vee|aldi/)) {
    return assign(row, expense("Food", "Groceries"));
  }

  if (
    matches(
      description,
      /365 market|365 pay|365 sos|365 vend|imperial llc/,
    )
  ) {
    return assign(row, expense("Food", "Snacks & Convenience"));
  }

  if (
    matches(
      description,
      /maverik|signal food|kum go|fast n friendly|rapid roberts|caseys|brown derby|buc ee|cenex|32 market|next stop|clinton bullseye|flying j|\bqt\b|shell oil|love s|pilot|break time|break tim|convenience plus|foodmart|corner market/,
    )
  ) {
    return Math.abs(row.amount) >= GAS_STATION_FUEL_MINIMUM
      ? assign(row, expense("Transportation", "Fuel"))
      : assign(row, expense("Food", "Snacks & Convenience"));
  }

  if (
    matches(
      description,
      /mcdonald|taco bell|wendy|freddy|niji sushi|the rock food|tie and timber|sweet boys|tst |max orient|wisner bar|koriya|la paloma|hold fast brew|cassidy coffee|skinny slims|tuckers shuckers|el puente|chili s|roost bar|hog tide|culvers|jersey mikes|krispy kreme|panda express|jose locos|jimmy johns|hardees|firehouse subs|braums|neighbor s mill|team taco|the baked bean|417 taphouse|chick fil|burger king|subway|arbys|sonic|starbucks|restaurant|grill|cafe|coffee/,
    )
  ) {
    return assign(row, expense("Food", "Restaurants"));
  }

  if (matches(description, /shelter mutual|shelter insurance/)) {
    return assign(row, expense("Transportation", "Car Insurance"));
  }

  if (matches(description, /walgreens|cvs|pharmacy/)) {
    return assign(row, expense("Health", "Pharmacy"));
  }

  if (matches(description, /coxhealth|eustasis|hims and hers|pierce vision/)) {
    return assign(row, expense("Health", "Medical"));
  }

  if (matches(description, /cox medical group/)) {
    return assign(row, expense("Health", "Medical"));
  }

  if (matches(description, /precision wellness/)) {
    return assign(row, expense("Health", "Personal Care"));
  }

  if (matches(description, /muncy s superma|costco/)) {
    return assign(row, expense("Food", "Groceries"));
  }

  if (
    matches(
      description,
      /tillys|american eagle|hollister|marshalls|h m 0678|belfry collect/,
    )
  ) {
    return assign(row, expense("Shopping", "Clothing"));
  }

  if (matches(description, /tjmaxx|homegoods|target t|amazon mktpl|hobbylobby/)) {
    return assign(row, expense("Shopping", "Household and Online Shopping"));
  }

  if (matches(description, /bath and body works/)) {
    return assign(row, expense("Health", "Personal Care"));
  }

  if (matches(description, /lily s florist|ftd lindas flower/)) {
    return assign(row, expense("Other", "Gifts"));
  }

  if (matches(description, /horton smith g/)) {
    return assign(row, expense("Sports", "Golf"));
  }

  if (matches(description, /de sales catholic/)) {
    return assign(row, expense("Other", "Donations"));
  }

  if (matches(description, /mo dmv/)) {
    return assign(row, expense("Transportation", "Registration"));
  }

  if (matches(description, /mister car wash/)) {
    return assign(row, expense("Transportation", "Auto Maintenance"));
  }

  if (matches(description, /cash app/)) {
    return assign(row, expense("Other", "Cash App"));
  }

  if (matches(description, /srb green energy|smokos|the hub 5 smoke/)) {
    return assign(row, expense("Other", "Weed, Vape, Drugs"));
  }

  if (matches(description, /draftkings|fanduel|fd sptsbk casino/)) {
    return assign(row, expense("Entertainment", "Gambling"));
  }

  if (matches(description, /playstation/)) {
    return assign(row, expense("Entertainment", "Gaming"));
  }

  if (matches(description, /\bamc\b/)) {
    return assign(row, expense("Entertainment", "Movies"));
  }

  if (matches(description, /priceln|priceline/)) {
    return assign(row, expense("Other", "Travel"));
  }

  if (
    sourceCategory === "groceries" &&
    matches(
      description,
      /365 retail markets|kum go|rapid roberts|fast n friendly|casey s general|imperial llc|brown derby|buc ee/,
    )
  ) {
    return assign(row, expense("Food", "Snacks & Convenience"));
  }

  if (
    subscription &&
    (isExplicitSubscription(row.description, row.sourceCategory) ||
      matches(description, /rocket money/))
  ) {
    return assign(row, subscription);
  }

  switch (sourceCategory) {
    case "rent":
      return assign(row, expense("Housing", "Rent"));
    case "utilities":
      return assign(row, expense("Housing", "Utilities"));
    case "home improvement":
      return assign(row, expense("Housing", "Home Improvement"));
    case "groceries":
      return assign(row, expense("Food", "Groceries"));
    case "restaurants":
      return assign(row, expense("Food", "Restaurants"));
    case "gasoline/fuel":
      return assign(row, expense("Transportation", "Fuel"));
    case "automotive":
      return assign(row, expense("Transportation", "Auto Maintenance"));
    case "insurance":
      if (matches(description, /shelter insurance/)) {
        return assign(row, expense("Transportation", "Car Insurance"));
      }
      return assign(row, expense("Other", "Other"));
    case "healthcare/medical":
      if (matches(description, /walgreens|cvs|pharmacy/)) {
        return assign(row, expense("Health", "Pharmacy"));
      }
      return assign(row, expense("Health", "Medical"));
    case "personal care":
      return assign(row, expense("Health", "Personal Care"));
    case "general merchandise":
      if (matches(description, /dollar tree/)) {
        return assign(row, expense("Shopping", "Household Supplies"));
      }
      return assign(row, expense("Other", "Other"));
    case "clothing/shoes":
      return assign(row, expense("Shopping", "Clothing"));
    case "electronics":
      return assign(row, expense("Shopping", "Electronics"));
    case "entertainment":
      if (matches(description, /draftkings|fanduel/)) {
        return assign(row, expense("Entertainment", "Gambling"));
      }
      if (matches(description, /playstation/)) {
        return assign(row, expense("Entertainment", "Gaming"));
      }
      if (subscription) return assign(row, subscription);
      return assign(row, expense("Other", "Other"));
    case "dues & subscriptions":
      return subscription
        ? assign(row, subscription)
        : assign(row, expense("Other", "Other"));
    case "online services":
      if (matches(description, /missouri department of revenue/)) {
        return assign(row, income("Refunds"));
      }
      return assign(row, expense("Other", "Other"));
    case "service charges/fees":
      if (matches(description, /atm.*fee|non wells fargo atm transaction fee/)) {
        return assign(row, expense("Fees", "ATM Fees"));
      }
      return assign(row, expense("Fees", "Bank Fees"));
    case "atm/cash":
      return assign(row, expense("Other", "Cash Withdrawals"));
    case "travel":
      return assign(row, expense("Other", "Travel"));
    case "gifts":
      return assign(row, expense("Other", "Gifts"));
    case "charitable giving":
      return assign(row, expense("Other", "Donations"));
    case "other expenses":
    case "hobbies":
      return assign(row, expense("Other", "Other"));
    case "loans":
      return skip(row, "Debt principal movement");
    default:
      return assign(row, expense("Other", "Other"));
  }
};

const parseCsvRecords = (text: string): string[][] => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.trim() !== "")) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  record.push(field);
  if (record.some((value) => value.trim() !== "")) records.push(record);
  return records;
};

const parseAmount = (value: string): number => {
  const normalizedAmount = value
    .trim()
    .replace(/[$,]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  return Number(normalizedAmount);
};

const parseDate = (value: string): string => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
};

export const parseWellsFargoCsv = (text: string): WellsFargoCsvRow[] => {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  if (records.length < 2) throw new Error("The CSV does not contain transactions");

  const headers = records[0].map((header) => header.trim().toLowerCase());
  const requiredHeaders = ["date", "description", "amount"];
  const missingHeaders = requiredHeaders.filter(
    (requiredHeader) => !headers.includes(requiredHeader),
  );
  if (missingHeaders.length > 0) {
    throw new Error(`Missing transaction columns: ${missingHeaders.join(", ")}`);
  }

  const valueAt = (record: string[], header: string) =>
    record[headers.indexOf(header)]?.trim() || "";

  return records.slice(1).map((record, index) => ({
    lineNumber: index + 2,
    date: parseDate(valueAt(record, "date")),
    account: valueAt(record, "account") || (headers.includes("status") ? "Checking" : ""),
    description: valueAt(record, "description"),
    sourceCategory: valueAt(record, "category"),
    tags: valueAt(record, "tags") || valueAt(record, "status"),
    amount: parseAmount(valueAt(record, "amount")),
  }));
};

export const buildWellsFargoImportSignature = (
  date: string,
  amount: number,
  description: string,
) => `${date.slice(0, 10)}|${amount.toFixed(2)}|${normalize(description)}`;

export const createWellsFargoImportPreview = (
  csvText: string,
  existingTransactions: Transaction[] = [],
): WellsFargoImportPreview => {
  const existingSignatures = new Set(
    existingTransactions
      .filter((transaction) => !transaction.isVirtual)
      .map((transaction) =>
        buildWellsFargoImportSignature(
          transaction.date,
          transaction.amount,
          transaction.note,
        ),
      ),
  );

  const rows = parseWellsFargoCsv(csvText).map((row) => {
    const classified = classifyWellsFargoRow(row);
    if (
      classified.status === "import" &&
      existingSignatures.has(
        buildWellsFargoImportSignature(row.date, row.amount, row.description),
      )
    ) {
      return {
        ...classified,
        status: "duplicate" as const,
        reason: "Already imported",
      };
    }
    return classified;
  });

  const importable = rows.filter((row) => row.status === "import");
  const summaryMap = new Map<
    string,
    WellsFargoImportPreview["categorySummary"][number]
  >();
  importable.forEach((row) => {
    const key = `${row.parentCategory}|${row.categoryName}`;
    const summary = summaryMap.get(key) || {
      parentCategory: row.parentCategory!,
      categoryName: row.categoryName!,
      count: 0,
      amount: 0,
    };
    summary.count += 1;
    summary.amount += row.amount;
    summaryMap.set(key, summary);
  });

  return {
    rows,
    importable,
    skipped: rows.filter((row) => row.status === "skip"),
    duplicates: rows.filter((row) => row.status === "duplicate"),
    needsReview: rows.filter((row) => row.status === "review"),
    categorySummary: Array.from(summaryMap.values()).sort((left, right) =>
      left.parentCategory === right.parentCategory
        ? left.categoryName.localeCompare(right.categoryName)
        : left.parentCategory.localeCompare(right.parentCategory),
    ),
  };
};

const encodeCsvField = (value: string | number) =>
  `"${String(value).replace(/"/g, '""')}"`;

export const createWellsFargoExcludedCsv = (rows: WellsFargoImportRow[]): string => {
  const header = [
    "Line",
    "Date",
    "Account",
    "Description",
    "Source Category",
    "Tags",
    "Amount",
    "Exclusion Reason",
  ];
  const excludedRows = rows.filter((row) => row.status === "skip");
  const csvRows = excludedRows.map((row) => [
    row.lineNumber,
    row.date,
    row.account,
    row.description,
    row.sourceCategory,
    row.tags,
    row.amount.toFixed(2),
    row.reason || "Excluded",
  ]);

  return [header, ...csvRows]
    .map((values) => values.map(encodeCsvField).join(","))
    .join("\r\n") + "\r\n";
};

const requireExistingAccountNeon = async (
  accessToken: string,
  userId: string,
): Promise<number> => {
  const existingAccountId = await findUserAccountId(accessToken);
  if (existingAccountId === null) {
    throw new Error(
      `No active account found for signed-in user ${userId}. Add this exact user ID to an account before importing.`,
    );
  }

  return existingAccountId;
};

const ensureImportCategories = async (
  accessToken: string,
  accountId: number,
  rows: WellsFargoImportRow[],
): Promise<Map<string, number>> => {
  const pg = PostgrestClientFactory.createClient(accessToken);
  const { data: existingRows, error: existingError } = await pg
    .from("Categories")
    .select("CategoryId,Name,Type,ParentCategoryId")
    .eq("AccountId", accountId);
  if (existingError) {
    throw new Error(existingError.message || "Failed to load import categories");
  }

  const existing = (existingRows || []) as Array<{
    CategoryId: number;
    Name: string;
    Type: string;
    ParentCategoryId: number | null;
  }>;
  const requiredParents = Array.from(
    new Map(
      rows.map((row) => [
        `${row.categoryType}|${row.parentCategory}`,
        { Name: row.parentCategory!, Type: row.categoryType! },
      ]),
    ).values(),
  );

  const parentIds = new Map<string, number>();
  existing
    .filter((category) => category.ParentCategoryId === null)
    .forEach((category) =>
      parentIds.set(`${category.Type}|${category.Name}`, category.CategoryId),
    );

  const missingParents = requiredParents.filter(
    (parent) => !parentIds.has(`${parent.Type}|${parent.Name}`),
  );
  if (missingParents.length > 0) {
    const { data, error } = await pg
      .from("Categories")
      .insert(
        missingParents.map((parent) => ({
          ...parent,
          ParentCategoryId: null,
          AccountId: accountId,
        })),
      )
      .select("CategoryId,Name,Type");
    if (error) throw new Error(error.message || "Failed to create category groups");
    (data || []).forEach((category: any) =>
      parentIds.set(`${category.Type}|${category.Name}`, category.CategoryId),
    );
  }

  const categoryIds = new Map<string, number>();
  existing
    .filter((category) => category.ParentCategoryId !== null)
    .forEach((category) =>
      categoryIds.set(
        `${category.Type}|${category.ParentCategoryId}|${category.Name}`,
        category.CategoryId,
      ),
    );

  const requiredChildren = Array.from(
    new Map(
      rows.map((row) => {
        const parentId = parentIds.get(`${row.categoryType}|${row.parentCategory}`)!;
        const key = `${row.categoryType}|${parentId}|${row.categoryName}`;
        return [
          key,
          {
            Name: row.categoryName!,
            Type: row.categoryType!,
            ParentCategoryId: parentId,
            AccountId: accountId,
          },
        ];
      }),
    ).values(),
  );
  const missingChildren = requiredChildren.filter(
    (child) =>
      !categoryIds.has(
        `${child.Type}|${child.ParentCategoryId}|${child.Name}`,
      ),
  );
  if (missingChildren.length > 0) {
    const { data, error } = await pg
      .from("Categories")
      .insert(missingChildren)
      .select("CategoryId,Name,Type,ParentCategoryId");
    if (error) throw new Error(error.message || "Failed to create categories");
    (data || []).forEach((category: any) =>
      categoryIds.set(
        `${category.Type}|${category.ParentCategoryId}|${category.Name}`,
        category.CategoryId,
      ),
    );
  }

  const result = new Map<string, number>();
  rows.forEach((row) => {
    const parentId = parentIds.get(`${row.categoryType}|${row.parentCategory}`)!;
    const categoryId = categoryIds.get(
      `${row.categoryType}|${parentId}|${row.categoryName}`,
    );
    if (!categoryId) throw new Error(`Category not found: ${row.categoryName}`);
    result.set(`${row.categoryType}|${row.parentCategory}|${row.categoryName}`, categoryId);
  });
  return result;
};

export const importWellsFargoTransactionsNeon = async (options: {
  accessToken: string;
  userId: string;
  accountId: number | null;
  rows: WellsFargoImportRow[];
}): Promise<WellsFargoImportResult> => {
  const accountId =
    options.accountId ??
    (await requireExistingAccountNeon(options.accessToken, options.userId));
  const pg = PostgrestClientFactory.createClient(options.accessToken);

  const { data: existingRows, error: existingError } = await pg
    .from("Transactions")
    .select("Date,Amount,Note")
    .eq("AccountId", accountId);
  if (existingError) {
    throw new Error(existingError.message || "Failed to check existing transactions");
  }
  const existingSignatures = new Set(
    (existingRows || []).map((transaction: any) =>
      buildWellsFargoImportSignature(
        transaction.Date,
        Number(transaction.Amount),
        transaction.Note,
      ),
    ),
  );

  const rowsToImport = options.rows.filter(
    (row) =>
      row.status === "import" &&
      !existingSignatures.has(
        buildWellsFargoImportSignature(row.date, row.amount, row.description),
      ),
  );
  if (rowsToImport.length === 0) {
    return {
      accountId,
      importedCount: 0,
      duplicateCount: options.rows.filter((row) => row.status === "import").length,
    };
  }

  const categoryIds = await ensureImportCategories(
    options.accessToken,
    accountId,
    rowsToImport,
  );
  const insertRows = rowsToImport.map((row) => ({
    Date: row.date,
    Note: row.description,
    Amount: row.amount,
    CategoryId: categoryIds.get(
      `${row.categoryType}|${row.parentCategory}|${row.categoryName}`,
    ),
    AccountId: accountId,
  }));

  const chunkSize = 250;
  for (let index = 0; index < insertRows.length; index += chunkSize) {
    const { error } = await pg
      .from("Transactions")
      .insert(insertRows.slice(index, index + chunkSize));
    if (error) {
      throw new Error(error.message || "Failed to import transactions");
    }
  }

  return {
    accountId,
    importedCount: insertRows.length,
    duplicateCount:
      options.rows.filter((row) => row.status === "import").length -
      insertRows.length,
  };
};
