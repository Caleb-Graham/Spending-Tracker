-- Import Net Worth Data from Budget Sheet
-- User: 1af2e369-3604-4302-a90b-67edd4c26152

BEGIN;

  --------------------------------------------------------------------
  -- Step 0: Clear existing data for this user (child tables first)
  --------------------------------------------------------------------

  -- Delete NetWorth rows for this user's snapshots
  DELETE FROM "NetWorth"
  WHERE "SnapshotId" IN (
    SELECT "SnapshotId"
  FROM "NetWorthSnapshots"
  WHERE "UserId" = '1af2e369-3604-4302-a90b-67edd4c26152'
  );

  -- Delete snapshots
  DELETE FROM "NetWorthSnapshots"
  WHERE "UserId" = '1af2e369-3604-4302-a90b-67edd4c26152';

  -- Delete accounts
  DELETE FROM "NetWorthAccounts"
  WHERE "UserId" = '1af2e369-3604-4302-a90b-67edd4c26152';

  -- Delete net-worth categories (for a clean rebuild)
  DELETE FROM "NetWorthCategories"
  WHERE "UserId" = '1af2e369-3604-4302-a90b-67edd4c26152';

  --------------------------------------------------------------------
  -- Step 1: Insert/Upsert all net-worth categories for this user
  --------------------------------------------------------------------

  INSERT INTO "NetWorthCategories"
    ("UserId", "Name", "IsAsset", "Notes", "SortOrder")
  VALUES
    ('1af2e369-3604-4302-a90b-67edd4c26152', 'Assets', TRUE, '', 10),
    ('1af2e369-3604-4302-a90b-67edd4c26152', 'Bank Accounts', TRUE, '', 20),
    ('1af2e369-3604-4302-a90b-67edd4c26152', 'Credit Cards', FALSE, '', 30),
    ('1af2e369-3604-4302-a90b-67edd4c26152', 'Investments', TRUE, '', 40),
    ('1af2e369-3604-4302-a90b-67edd4c26152', 'Retirement', TRUE, '', 50),
    ('1af2e369-3604-4302-a90b-67edd4c26152', 'Debt', FALSE, '', 60)
  ON CONFLICT
  ("UserId", "Name") DO
  UPDATE
  SET "IsAsset"   = EXCLUDED."IsAsset",
      "Notes"     = EXCLUDED."Notes",
      "SortOrder" = EXCLUDED."SortOrder";

  --------------------------------------------------------------------
  -- Step 2: Insert all unique accounts, wired to NetWorthCategories
  --------------------------------------------------------------------

  WITH
    account_seed
    AS
    (
      SELECT *
      FROM (
      VALUES
          -- 2025+ accounts
          ('Model 3', 'Assets', TRUE, ''),
          ('Model Y', 'Assets', TRUE, ''),
          ('Passat', 'Assets', TRUE, 'Historical vehicle'),
          ('Checking', 'Bank Accounts', TRUE, ''),
          ('Emergency Fund', 'Bank Accounts', TRUE, ''),
          ('Travel Fund', 'Bank Accounts', TRUE, ''),
          ('Short Term Fund', 'Bank Accounts', TRUE, ''),
          ('Gift Fund', 'Bank Accounts', TRUE, ''),
          ('Car Fund', 'Bank Accounts', TRUE, ''),
          ('Edgewood Fund', 'Bank Accounts', TRUE, ''),
          ('Wedding Fund', 'Bank Accounts', TRUE, ''),
          ('Pet Fund', 'Bank Accounts', TRUE, ''),
          ('Fixed Expense Fund', 'Bank Accounts', TRUE, ''),
          ('Amazon Credit Card', 'Credit Cards', FALSE, ''),
          ('Citi Credit Card', 'Credit Cards', FALSE, ''),
          ('Chase Travel Card', 'Credit Cards', FALSE, ''),
          ('Bitcoin', 'Investments', TRUE, ''),
          ('HSA', 'Retirement', TRUE, ''),
          ('Robinhood', 'Investments', TRUE, ''),
          ('Roth IRA', 'Retirement', TRUE, ''),
          ('Roth 401k', 'Retirement', TRUE, ''),
          ('Model 3 Loan', 'Debt', FALSE, ''),
          ('Model Y Loan', 'Debt', FALSE, ''),
          ('Tesla Loan', 'Debt', FALSE, 'Historical'),
          ('Student Loans', 'Debt', FALSE, ''),

          -- 2021 accounts (historical-only)
          ('Checking', 'Bank Accounts', TRUE, 'Historical 2021'),
          ('Discover Credit Card', 'Credit Cards', FALSE, 'Historical 2021'),
          ('Etrade', 'Investments', TRUE, 'Historical 2021'),
          ('M1 Finance', 'Investments', TRUE, 'Historical 2021'),
          ('Roth 401k', 'Retirement', TRUE, 'Historical 2021'),

          -- 2020 accounts
          ('Fixed Expense Fund', 'Bank Accounts', TRUE, 'Historical 2020')
    ) AS t("Name", "CategoryName", "IsAsset", "Notes")
    )
  INSERT INTO "NetWorthAccounts"
    ("UserId", "Name", "NetWorthCategoryId", "IsAsset", "Notes")
  SELECT
    '1af2e369-3604-4302-a90b-67edd4c26152' AS "UserId",
    s."Name",
    c."CategoryId"                          AS "NetWorthCategoryId",
    s."IsAsset",
    s."Notes"
  FROM account_seed s
    JOIN "NetWorthCategories" c
    ON c."UserId" = '1af2e369-3604-4302-a90b-67edd4c26152'
      AND c."Name"   = s."CategoryName"
  ON CONFLICT
  ("UserId", "Name") DO NOTHING;

  --------------------------------------------------------------------
  -- Step 3: Temp table for snapshots
  --------------------------------------------------------------------

  CREATE TEMP TABLE temp_snapshots
  (
    "Date"         TIMESTAMPTZ,
    "Notes"        TEXT,
    snapshot_data  JSONB
  ) ON
  COMMIT
  DROP;

--------------------------------------------------------------------
-- Step 4: Insert all snapshots (2025–2020)
--------------------------------------------------------------------

INSERT INTO temp_snapshots
  ("Date", "Notes", snapshot_data)
VALUES
  -- 2025
  ('2025-01-01T00:00:00Z', '', '{"Model 3": 25000.00, "Model Y": 0.00, "Checking": 1715.22, "Emergency Fund": 6047.28, "Travel Fund": 1739.72, "Short Term Fund": 42809.91, "Gift Fund": 161.10, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 278.86, "Amazon Credit Card": 0.00, "Citi Credit Card": 0.00, "Chase Travel Card": 0.00, "Bitcoin": 4669.50, "HSA": 2267.83, "Robinhood": 39684.87, "Roth IRA": 30978.18, "Roth 401k": 22885.71, "Model 3 Loan": -6439.70, "Model Y Loan": 0.00, "Student Loans": -12256.65}'),
  ('2025-02-01T00:00:00Z', '', '{"Model 3": 24000.00, "Model Y": 0.00, "Checking": 2674.79, "Emergency Fund": 10207.20, "Travel Fund": 2045.80, "Short Term Fund": 38979.88, "Gift Fund": 131.34, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 210.39, "Amazon Credit Card": 0.00, "Citi Credit Card": -266.12, "Chase Travel Card": -126.15, "Bitcoin": 4729.62, "HSA": 2281.25, "Robinhood": 40855.29, "Roth IRA": 32172.09, "Roth 401k": 24861.20, "Model 3 Loan": -5566.58, "Model Y Loan": 0.00, "Student Loans": -12140.74}'),
  ('2025-03-01T00:00:00Z', 'TSLA down a lot - Money spent on Colorado trip - Money on Oso and Amanda', '{"Model 3": 24000.00, "Model Y": 0.00, "Checking": 2687.20, "Emergency Fund": 10436.12, "Travel Fund": 2120.12, "Short Term Fund": 37245.07, "Gift Fund": 261.85, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 321.13, "Amazon Credit Card": -22.01, "Citi Credit Card": -2165.13, "Chase Travel Card": -14.13, "Bitcoin": 4156.21, "HSA": 2515.25, "Robinhood": 36106.30, "Roth IRA": 33060.92, "Roth 401k": 25158.34, "Model 3 Loan": -4682.39, "Model Y Loan": 0.00, "Student Loans": -12014.71}'),
  ('2025-04-01T00:00:00Z', 'Market down because tarrifs', '{"Model 3": 24000.00, "Model Y": 0.00, "Checking": 2234.07, "Emergency Fund": 10318.67, "Travel Fund": 2282.88, "Short Term Fund": 36689.14, "Gift Fund": 237.78, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 385.56, "Amazon Credit Card": -141.89, "Citi Credit Card": -911.92, "Chase Travel Card": -132.37, "Bitcoin": 4029.36, "HSA": 2606.01, "Robinhood": 33542.44, "Roth IRA": 31732.25, "Roth 401k": 24647.75, "Model 3 Loan": -3333.50, "Model Y Loan": 0.00, "Student Loans": -11755.73}'),
  ('2025-05-01T00:00:00Z', '', '{"Model 3": 22500.00, "Model Y": 0.00, "Checking": 2215.88, "Emergency Fund": 10550.52, "Travel Fund": 2333.38, "Short Term Fund": 33850.44, "Gift Fund": 211.38, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 408.62, "Amazon Credit Card": 9.00, "Citi Credit Card": -198.25, "Chase Travel Card": 0.00, "Bitcoin": 4652.82, "HSA": 2670.96, "Robinhood": 37726.36, "Roth IRA": 33645.20, "Roth 401k": 26743.58, "Model 3 Loan": -2917.78, "Model Y Loan": 0.00, "Student Loans": -11785.70}'),
  ('2025-06-01T00:00:00Z', 'Market up - paid off car - bonus', '{"Model 3": 22000.00, "Model Y": 0.00, "Checking": 3416.40, "Emergency Fund": 10783.42, "Travel Fund": 2650.14, "Short Term Fund": 31910.66, "Gift Fund": 124.02, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 318.19, "Amazon Credit Card": 0.00, "Citi Credit Card": -88.30, "Chase Travel Card": 0.00, "Bitcoin": 5041.55, "HSA": 2827.74, "Robinhood": 43501.36, "Roth IRA": 35732.76, "Roth 401k": 30396.72, "Model 3 Loan": 0.00, "Model Y Loan": 0.00, "Student Loans": -11668.41}'),
  ('2025-07-01T00:00:00Z', 'Bought a ring and hawaii trip', '{"Model 3": 22000.00, "Model Y": 0.00, "Checking": 2140.12, "Emergency Fund": 10932.70, "Travel Fund": 974.50, "Short Term Fund": 28797.01, "Gift Fund": 254.57, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 429.31, "Amazon Credit Card": -15.92, "Citi Credit Card": -17.99, "Chase Travel Card": -2.91, "Bitcoin": 5139.15, "HSA": 2927.51, "Robinhood": 42732.61, "Roth IRA": 38012.95, "Roth 401k": 33194.76, "Model 3 Loan": 0.00, "Model Y Loan": 0.00, "Student Loans": -11400.82}'),
  ('2025-08-01T00:00:00Z', 'Profit sharing', '{"Model 3": 21750.00, "Model Y": 0.00, "Checking": 2600.34, "Emergency Fund": 11110.54, "Travel Fund": 1252.03, "Short Term Fund": 29189.10, "Gift Fund": 292.27, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 386.10, "Amazon Credit Card": -74.99, "Citi Credit Card": 6.48, "Chase Travel Card": -50.03, "Bitcoin": 5570.45, "HSA": 3128.16, "Robinhood": 44091.94, "Roth IRA": 38606.35, "Roth 401k": 39098.38, "Model 3 Loan": 0.00, "Model Y Loan": 0.00, "Student Loans": -11431.87}'),
  ('2025-09-01T00:00:00Z', '', '{"Model 3": 21750.00, "Model Y": 0.00, "Checking": 3445.44, "Emergency Fund": 11295.97, "Travel Fund": 1504.92, "Short Term Fund": 29869.16, "Gift Fund": 281.61, "Car Fund": 0.00, "Edgewood Fund": 0.00, "Wedding Fund": 0.00, "Pet Fund": 0.00, "Fixed Expense Fund": 221.46, "Amazon Credit Card": -21.21, "Citi Credit Card": -800.00, "Chase Travel Card": 0.00, "Bitcoin": 5218.50, "HSA": 3210.97, "Robinhood": 47358.47, "Roth IRA": 40634.11, "Roth 401k": 40523.78, "Model 3 Loan": 0.00, "Model Y Loan": 0.00, "Student Loans": -11313.62}'),
  ('2025-10-01T00:00:00Z', 'I guess the market is doing better than I thought. I spent 18k in cash (all mine) on a car and house and only down this much. When I get the loans for both of those I''m excited to see what my new net worth will be', '{"Model 3": 22000.00, "Model Y": 25000.00, "Checking": 2143.47, "Emergency Fund": 10781.20, "Travel Fund": 1869.64, "Short Term Fund": 11529.83, "Gift Fund": 348.50, "Car Fund": 1100.00, "Edgewood Fund": 2486.00, "Wedding Fund": 2000.00, "Pet Fund": 332.28, "Fixed Expense Fund": 82.83, "Amazon Credit Card": -41.43, "Citi Credit Card": 0.00, "Chase Travel Card": -15.75, "Bitcoin": 5751.31, "HSA": 3390.00, "Robinhood": 55826.19, "Roth IRA": 42859.88, "Roth 401k": 42787.89, "Model 3 Loan": 0.00, "Model Y Loan": -16591.56, "Student Loans": -11044.91}'),
  ('2025-11-01T00:00:00Z', '', '{"Model 3": 21750.00, "Model Y": 25000.00, "Checking": 3112.15, "Emergency Fund": 10314.53, "Travel Fund": 2125.89, "Short Term Fund": 23386.79, "Gift Fund": 381.18, "Car Fund": 1289.98, "Edgewood Fund": 2742.00, "Wedding Fund": 2156.00, "Pet Fund": 2991.18, "Fixed Expense Fund": 94.78, "Amazon Credit Card": 0.00, "Citi Credit Card": -88.00, "Chase Travel Card": 0.00, "Bitcoin": 5334.00, "HSA": 3265.00, "Robinhood": 58117.90, "Roth IRA": 43735.28, "Roth 401k": 44308.00, "Model 3 Loan": 0.00, "Model Y Loan": -16245.00, "Student Loans": -11075.00}'),

  -- 2024
  ('2024-12-01T00:00:00Z', 'TSLA popped', '{"Model 3": 25000.00, "Checking": 2440.67, "Emergency Fund": 7449.55, "Travel Fund": 1534.58, "Short Term Fund": 42964.10, "Gift Fund": 130.74, "Pet": 517.15, "Fixed Expense Fund": 211.00, "Amazon Credit Card": 0.00, "Citi Credit Card": 0.00, "Chase Travel Card": -836.00, "Bitcoin": 4719.53, "HSA": 2281.33, "Robinhood": 37326.07, "Roth IRA": 31560.82, "Roth 401k": 22213.52, "Tesla Loan": -7307.36, "Student Loans": -12371.09}'),
  ('2024-11-01T00:00:00Z', '', '{"Model 3": 25000.00, "Checking": 2556.57, "Emergency Fund": 7505.09, "Travel Fund": 1279.73, "Short Term Fund": 47944.63, "Gift Fund": 137.54, "Pet": 481.37, "Fixed Expense Fund": 143.36, "Amazon Credit Card": -120.22, "Citi Credit Card": -703.92, "Chase Travel Card": -111.05, "Bitcoin": 3310.03, "HSA": 2183.41, "Robinhood": 28954.19, "Roth IRA": 29852.96, "Roth 401k": 19856.44, "Tesla Loan": -17702.19, "Student Loans": -12339.65}'),
  ('2024-10-01T00:00:00Z', '', '{"Model 3": 26000.00, "Checking": 2280.09, "Emergency Fund": 7278.56, "Travel Fund": 1075.56, "Short Term Fund": 47209.04, "Gift Fund": 275.71, "Pet": 431.45, "Fixed Expense Fund": 125.90, "Amazon Credit Card": -95.96, "Citi Credit Card": -2070.90, "Chase Travel Card": -471.65, "Bitcoin": 2985.82, "HSA": 2075.98, "Robinhood": 28310.59, "Roth IRA": 29899.65, "Roth 401k": 19400.49, "Tesla Loan": -18043.09, "Student Loans": -12453.43}'),
  ('2024-09-01T00:00:00Z', '', '{"Model 3": 26000.00, "Checking": 2524.43, "Emergency Fund": 7374.27, "Travel Fund": 565.28, "Short Term Fund": 46018.81, "Gift Fund": 150.00, "Pet": 340.08, "Fixed Expense Fund": 448.11, "Amazon Credit Card": -72.77, "Citi Credit Card": -222.00, "Chase Travel Card": -10.80, "Bitcoin": 2808.76, "HSA": 1964.46, "Robinhood": 25765.02, "Roth IRA": 28501.94, "Roth 401k": 18827.94, "Tesla Loan": -18385.18, "Student Loans": -12719.15}'),
  ('2024-08-01T00:00:00Z', 'Profit sharing', '{"Model 3": 26000.00, "Checking": 2778.70, "Emergency Fund": 7147.54, "Travel Fund": 993.83, "Short Term Fund": 44427.62, "Pet": 289.01, "Fixed Expense Fund": 527.33, "Amazon Credit Card": -13.03, "Citi Credit Card": -15.49, "Chase Travel Card": -827.73, "Bitcoin": 3210.68, "HSA": 1853.94, "Robinhood": 26172.45, "Roth IRA": 27112.99, "Roth 401k": 18038.43, "Tesla Loan": -18719.70, "Student Loans": -12832.24}'),
  ('2024-07-01T00:00:00Z', '', '{"Model 3": 27000.00, "Checking": 1836.24, "Emergency Fund": 6920.83, "Travel Fund": 1195.12, "Short Term Fund": 42686.76, "Pet": 0.00, "Fixed Expense Fund": 458.42, "Amazon Credit Card": -118.48, "Citi Credit Card": 0.00, "Chase Travel Card": -10.80, "Bitcoin": 3039.03, "HSA": 1930.58, "Robinhood": 24896.04, "Roth IRA": 25997.44, "Roth 401k": 14013.94, "Tesla Loan": -19055.48, "Student Loans": -12946.13}'),
  ('2024-06-01T00:00:00Z', 'Had to wait until the 7th because money was moving to robinhood + yearly bonus', '{"Model 3": 28000.00, "Checking": 1059.80, "Emergency Fund": 6705.80, "Travel Fund": 1001.15, "Short Term Fund": 40910.92, "Pet": 0.00, "Fixed Expense Fund": 389.82, "Amazon Credit Card": -122.32, "Citi Credit Card": -69.09, "Chase Travel Card": 0.00, "Bitcoin": 3450.59, "HSA": 1871.76, "Robinhood": 22368.14, "Roth IRA": 25235.95, "Roth 401k": 13350.90, "Tesla Loan": -19411.27, "Student Loans": -12917.92}'),
  ('2024-05-01T00:00:00Z', '', '{"Model 3": 28000.00, "Checking": 1738.52, "Emergency Fund": 6500.95, "Travel Fund": 777.92, "Short Term Fund": 37765.52, "Pet": 0.00, "Fixed Expense Fund": 470.46, "Amazon Credit Card": 69.03, "Citi Credit Card": -124.31, "Chase Travel Card": -34.97, "Bitcoin": 2758.00, "HSA": 1763.51, "Robinhood": 21831.02, "Roth IRA": 23616.67, "Roth 401k": 11998.43, "Tesla Loan": -19725.08, "Student Loans": -13024.11}'),
  ('2024-04-01T00:00:00Z', '', '{"Model 3": 28000.00, "Checking": 1746.55, "Emergency Fund": 6756.09, "Travel Fund": 882.23, "Short Term Fund": 36492.80, "Pet": 0.00, "Fixed Expense Fund": 471.77, "Amazon Credit Card": -120.00, "Citi Credit Card": -264.54, "Chase Travel Card": -79.05, "Bitcoin": 3366.78, "HSA": 1606.64, "Robinhood": 21779.31, "Roth IRA": 23944.40, "Roth 401k": 12174.07, "Tesla Loan": -20059.02, "Student Loans": -13288.22}'),
  ('2024-03-01T00:00:00Z', 'EV tax return', '{"Model 3": 28760.00, "Checking": 2291.78, "Emergency Fund": 6510.92, "Travel Fund": 901.00, "Short Term Fund": 34755.20, "Pet": 0.00, "Fixed Expense Fund": 403.07, "Amazon Credit Card": -19.07, "Citi Credit Card": -247.90, "Chase Travel Card": -76.50, "Bitcoin": 2999.15, "HSA": 1549.95, "Robinhood": 23282.69, "Roth IRA": 22835.05, "Roth 401k": 11481.90, "Tesla Loan": -20293.45, "Student Loans": -13400.80}'),
  ('2024-02-01T00:00:00Z', '', '{"Model 3": 30650.00, "Checking": 2331.47, "Emergency Fund": 6268.27, "Travel Fund": 728.19, "Short Term Fund": 26112.70, "Pet": 0.00, "Fixed Expense Fund": 334.71, "Amazon Credit Card": -46.46, "Citi Credit Card": -737.27, "Chase Travel Card": 25.00, "Bitcoin": 2079.40, "HSA": 1444.20, "Robinhood": 21852.27, "Roth IRA": 21500.35, "Roth 401k": 10816.51, "Tesla Loan": -20732.11, "Student Loans": -13369.14}'),
  ('2024-01-01T00:00:00Z', '', '{"Model 3": 31537.00, "Checking": 2252.68, "Emergency Fund": 6025.67, "Travel Fund": 575.83, "Short Term Fund": 24388.09, "Pet": 0.00, "Fixed Expense Fund": 266.56, "Amazon Credit Card": -782.18, "Citi Credit Card": -128.96, "Chase Travel Card": 0.00, "Bitcoin": 2181.11, "HSA": 1291.52, "Robinhood": 24413.31, "Roth IRA": 20632.24, "Roth 401k": 9999.49, "Tesla Loan": -21054.74, "Student Loans": -13479.86}'),

  -- 2023
  ('2023-12-01T00:00:00Z', '', '{"Model 3": 31519.00, "Passat": 0.00, "Checking": 3323.48, "Emergency Fund": 5786.91, "Travel Fund": 310.78, "Short Term Fund": 21389.18, "Fixed Expense Fund": 198.76, "Amazon Credit Card": -107.98, "Citi Credit Card": -420.66, "Chase Travel Card": -11.40, "Bitcoin": 1879.61, "HSA": 1249.84, "Robinhood": 23782.65, "M1 Finance": 0.00, "Roth IRA": 19420.79, "Roth 401k": 9117.04, "Tesla Loan": -21269.07, "Student Loans": -13739.01}'),
  ('2023-11-01T00:00:00Z', '', '{"Model 3": 32691.00, "Passat": 0.00, "Checking": 2688.07, "Emergency Fund": 5546.09, "Travel Fund": 159.99, "Short Term Fund": 20868.23, "Fixed Expense Fund": 131.11, "Amazon Credit Card": -300.00, "Citi Credit Card": -645.71, "Chase Travel Card": -122.25, "Bitcoin": 1670.24, "HSA": 1161.64, "Robinhood": 20163.95, "M1 Finance": 0.00, "Roth IRA": 17232.71, "Roth 401k": 8193.77, "Tesla Loan": -21589.78, "Student Loans": -13851.54}'),
  ('2023-10-01T00:00:00Z', '', '{"Model 3": 32000.00, "Passat": 0.00, "Checking": 3104.32, "Emergency Fund": 4893.82, "Travel Fund": 526.93, "Short Term Fund": 18918.87, "Fixed Expense Fund": 63.71, "Amazon Credit Card": 15.29, "Citi Credit Card": -310.06, "Chase Travel Card": -9.44, "Bitcoin": 1313.45, "HSA": 1027.89, "Robinhood": 23297.09, "M1 Finance": 0.00, "Roth IRA": 17161.04, "Roth 401k": 7913.39, "Tesla Loan": -21915.93, "Student Loans": -13953.76}'),
  ('2023-09-01T00:00:00Z', '', '{"Model 3": 34000.00, "Passat": 0.00, "Checking": 2572.14, "Emergency Fund": 4245.17, "Travel Fund": 425.26, "Short Term Fund": 18509.19, "Fixed Expense Fund": 366.51, "Amazon Credit Card": -49.35, "Citi Credit Card": 0.00, "Chase Travel Card": -109.20, "Bitcoin": 1258.07, "HSA": 986.21, "Robinhood": 23233.68, "M1 Finance": 0.00, "Roth IRA": 17487.89, "Roth 401k": 8185.22, "Tesla Loan": -22180.00, "Student Loans": -14065.23}'),
  ('2023-08-01T00:00:00Z', 'Uhh bought a car. Got my yearly profit sharing. Dropped a fat downpayment on the Tesla', '{"Model 3": 35000.00, "Passat": 2000.00, "Checking": 1799.35, "Emergency Fund": 3810.74, "Travel Fund": 224.13, "Short Term Fund": 18245.78, "Fixed Expense Fund": 302.38, "Amazon Credit Card": -187.15, "Citi Credit Card": 0.00, "Chase Travel Card": -20.48, "Bitcoin": 1423.22, "HSA": 857.31, "Robinhood": 23703.80, "M1 Finance": 0.00, "Roth IRA": 17115.09, "Roth 401k": 8053.17, "Tesla Loan": -22180.00, "Student Loans": -14215.23}'),
  ('2023-07-01T00:00:00Z', 'Stocks have been popping off. Would be a lot more because amanda and jennie owe me for vacation ', '{"Model 3": 0.00, "Passat": 4000.00, "Checking": 1835.24, "Emergency Fund": 3165.93, "Travel Fund": 623.16, "Short Term Fund": 7496.88, "Fixed Expense Fund": 784.97, "Amazon Credit Card": -42.20, "Citi Credit Card": -911.15, "Chase Travel Card": -1599.08, "Bitcoin": 1474.86, "HSA": 1093.16, "Robinhood": 24759.11, "M1 Finance": 20968.92, "Roth IRA": 16412.98, "Roth 401k": 4407.41, "Tesla Loan": 0.00, "Student Loans": -14365.23}'),
  ('2023-06-01T00:00:00Z', '', '{"Model 3": 0.00, "Passat": 4000.00, "Checking": 1632.73, "Emergency Fund": 2523.99, "Travel Fund": 401.51, "Short Term Fund": 7218.43, "Fixed Expense Fund": 662.69, "Amazon Credit Card": 0.00, "Citi Credit Card": -154.13, "Chase Travel Card": -34.57, "Bitcoin": 1281.26, "HSA": 1005.81, "Robinhood": 19456.32, "M1 Finance": 19571.57, "Roth IRA": 15028.96, "Roth 401k": 3797.18, "Tesla Loan": 0.00, "Student Loans": -14515.23}'),
  ('2023-05-01T00:00:00Z', 'Honestly shocked that I''m up. TSLA has dropped to about 160$ a share which has hurt me', '{"Model 3": 0.00, "Passat": 4000.00, "Checking": 2958.30, "Emergency Fund": 1763.58, "Travel Fund": 295.20, "Short Term Fund": 6728.61, "Fixed Expense Fund": 554.20, "Amazon Credit Card": 0.00, "Citi Credit Card": 0.00, "Chase Travel Card": -105.13, "Bitcoin": 1343.57, "HSA": 1069.89, "Robinhood": 15979.07, "M1 Finance": 19629.92, "Roth IRA": 14659.24, "Roth 401k": 3565.79, "Tesla Loan": 0.00, "Student Loans": -14665.23}'),
  ('2023-04-01T00:00:00Z', '', '{"Model 3": 0.00, "Passat": 4000.00, "Checking": 2341.40, "Emergency Fund": 1099.61, "Travel Fund": 105.83, "Short Term Fund": 6700.00, "Fixed Expense Fund": 445.39, "Amazon Credit Card": -141.43, "Citi Credit Card": 0.00, "Chase Travel Card": 0.00, "Bitcoin": 1318.99, "HSA": 982.83, "Robinhood": 18450.04, "M1 Finance": 18818.54, "Roth IRA": 13926.38, "Roth 401k": 3346.54, "Tesla Loan": 0.00, "Student Loans": -14815.23}'),
  ('2023-03-01T00:00:00Z', 'Spent a bunch on Europe travel', '{"Model 3": 0.00, "Passat": 4000.00, "Checking": 3161.12, "Emergency Fund": 4708.58, "Travel Fund": 3.04, "Short Term Fund": 2886.76, "Fixed Expense Fund": 342.70, "Amazon Credit Card": 0.00, "Citi Credit Card": 71.33, "Chase Travel Card": -694.59, "Bitcoin": 1060.29, "HSA": 896.10, "Robinhood": 17421.79, "M1 Finance": 18408.72, "Roth IRA": 13230.22, "Roth 401k": 3055.57, "Tesla Loan": 0.00, "Student Loans": -15115.23}'),
  ('2023-02-01T00:00:00Z', 'Economy is actually doing well & I got a bonus this month', '{"Model 3": 0.00, "Passat": 4000.00, "Checking": 2376.11, "Emergency Fund": 4536.71, "Travel Fund": 388.79, "Short Term Fund": 2080.60, "Fixed Expense Fund": 240.36, "Amazon Credit Card": 0.00, "Citi Credit Card": -47.35, "Chase Travel Card": 0.00, "Bitcoin": 980.55, "HSA": 810.08, "Robinhood": 15989.26, "M1 Finance": 19155.98, "Roth IRA": 13300.11, "Roth 401k": 2996.87, "Tesla Loan": 0.00, "Student Loans": -15115.23}'),
  ('2023-01-01T00:00:00Z', '', '{"Model 3": 0.00, "Passat": 4000.00, "Checking": 2717.98, "Emergency Fund": 4364.44, "Travel Fund": 735.14, "Short Term Fund": 401.52, "Fixed Expense Fund": 138.26, "Amazon Credit Card": -92.59, "Citi Credit Card": -427.70, "Chase Travel Card": 0.00, "Bitcoin": 673.12, "HSA": 709.25, "Robinhood": 11144.52, "M1 Finance": 18489.42, "Roth IRA": 11656.46, "Roth 401k": 2617.67, "Tesla Loan": 0.00, "Student Loans": -15115.23}'),

  -- 2022
  ('2022-12-01T00:00:00Z', '', '{"Checking": 2232.24, "Emergency Fund": 4193.12, "Travel Fund": 553.47, "Short Term Fund": 400.46, "Fixed Expense Fund": 336.18, "HSA": 692.05, "Amazon Credit Card": -35.27, "Citi Credit Card": -156.95, "Bitcoin": 659.71, "Robinhood": 15357.50, "M1 Finance": 18412.92, "Roth IRA": 11710.06, "Roth 401k": 697.77, "Student Loans": -15115.23}'),
  ('2022-11-07T00:00:00Z', '', '{"Checking": 982.80, "Emergency Fund": 4063.15, "Travel Fund": 741.79, "Short Term Fund": 399.49, "Fixed Expense Fund": 240.87, "HSA": 660.31, "Amazon Credit Card": -4.13, "Citi Credit Card": 0.00, "Bitcoin": 737.45, "Robinhood": 14726.34, "M1 Finance": 16861.01, "Roth IRA": 10529.45, "Roth 401k": 541.87, "Student Loans": -15115.23}'),
  ('2022-10-01T00:00:00Z', '', '{"Checking": 3029.45, "Emergency Fund": 3900.34, "Travel Fund": 610.47, "Short Term Fund": 398.70, "Fixed Expense Fund": 145.86, "HSA": 628.89, "Amazon Credit Card": -37.21, "Citi Credit Card": -450.09, "Bitcoin": 638.40, "Robinhood": 17559.15, "M1 Finance": 14493.22, "Roth IRA": 9187.69, "Roth 401k": 436.88, "Student Loans": -15115.23}'),
  ('2022-09-01T00:00:00Z', '', '{"Checking": 2401.13, "Emergency Fund": 3709.37, "Travel Fund": 508.99, "Short Term Fund": 398.08, "Fixed Expense Fund": 440.54, "HSA": 557.86, "Amazon Credit Card": -102.71, "Citi Credit Card": -139.34, "Bitcoin": 633.44, "Robinhood": 18182.26, "M1 Finance": 15093.23, "Roth IRA": 9619.66, "Roth 401k": 424.87, "Student Loans": -15115.23}'),
  ('2022-08-01T00:00:00Z', '', '{"Checking": 3185.21, "Emergency Fund": 3524.51, "Travel Fund": 636.47, "Short Term Fund": 397.55, "Fixed Expense Fund": 355.82, "HSA": 497.03, "Amazon Credit Card": -11.69, "Citi Credit Card": 0.00, "Bitcoin": 691.79, "Robinhood": 18614.70, "M1 Finance": 14804.71, "Roth IRA": 9574.50, "Roth 401k": 390.36, "Student Loans": -15115.23}'),
  ('2022-07-01T00:00:00Z', 'Recession :)', '{"Checking": 1004.92, "Emergency Fund": 3386.22, "Travel Fund": 500.95, "Short Term Fund": 397.17, "Fixed Expense Fund": 271.30, "HSA": 466.53, "Amazon Credit Card": 0.00, "Citi Credit Card": 0.00, "Bitcoin": 634.48, "Robinhood": 16211.84, "M1 Finance": 13434.09, "Roth IRA": 8684.11, "Roth 401k": 320.55, "Student Loans": -15115.23}'),
  ('2022-06-01T00:00:00Z', 'And it keeps getting worse and will probably keep getting worse. - This month I also went on a vacation and paid for mexico and yellowstone stuff', '{"Checking": 2477.61, "Emergency Fund": 3113.95, "Travel Fund": 80.72, "Short Term Fund": 396.89, "Fixed Expense Fund": 335.54, "HSA": 406.26, "Amazon Credit Card": 0.00, "Citi Credit Card": -343.69, "Bitcoin": 870.41, "Robinhood": 15259.37, "M1 Finance": 13141.15, "Roth IRA": 8628.54, "Roth 401k": 280.70, "Student Loans": -15115.23}'),
  ('2022-05-01T00:00:00Z', 'Market is dreadful rn', '{"Checking": 2989.98, "Emergency Fund": 2932.36, "Travel Fund": 925.00, "Short Term Fund": 396.68, "Fixed Expense Fund": 561.46, "HSA": 316.14, "Amazon Credit Card": 0.00, "Citi Credit Card": -10.81, "Bitcoin": 1076.46, "Robinhood": 16859.42, "M1 Finance": 13268.93, "Roth IRA": 8060.67, "Roth 401k": 204.69, "Student Loans": -15115.23}'),
  ('2022-04-01T00:00:00Z', '', '{"Checking": 2579.58, "Emergency Fund": 2751.27, "Travel Fund": 764.68, "Short Term Fund": 396.53, "Fixed Expense Fund": 478.80, "HSA": 286.14, "Amazon Credit Card": 0.00, "Citi Credit Card": 0.00, "Bitcoin": 1299.49, "Robinhood": 20284.27, "M1 Finance": 12179.95, "Roth IRA": 8242.64, "Roth 401k": 200.41, "Student Loans": -15115.23}'),
  ('2022-03-01T00:00:00Z', 'Market still down. Getting worse because of Russia vs Ukraine stuff. But much better than where I was at a week ago. Also spent decent amount on vacation stuff this last month. Colorado and Chicago', '{"Checking": 2549.66, "Emergency Fund": 2525.38, "Travel Fund": 464.46, "Short Term Fund": 396.40, "Fixed Expense Fund": 396.19, "HSA": 226.14, "Amazon Credit Card": -29.98, "Citi Credit Card": -180.19, "Bitcoin": 1202.07, "Robinhood": 17005.27, "M1 Finance": 8984.26, "Roth IRA": 7593.97, "Roth 401k": 142.11, "Student Loans": -15115.23}'),
  ('2022-02-01T00:00:00Z', 'Had to drop about 500$ on my car but mostly market crash. Down huge this month', '{"Checking": 1958.07, "Emergency Fund": 2344.63, "Travel Fund": 741.75, "Short Term Fund": 396.28, "Fixed Expense Fund": 313.61, "HSA": 76.14, "Amazon Credit Card": -9.34, "Citi Credit Card": -130.36, "Bitcoin": 1039.47, "Robinhood": 17952.38, "M1 Finance": 8504.90, "Roth IRA": 7326.26, "Roth 401k": 96.39, "Student Loans": -15115.23}'),
  ('2022-01-01T00:00:00Z', '', '{"Checking": 2615.27, "Emergency Fund": 2263.83, "Travel Fund": 481.56, "Short Term Fund": 396.15, "Fixed Expense Fund": 231.05, "HSA": 368.22, "Amazon Credit Card": -29.28, "Citi Credit Card": -103.30, "Bitcoin": 1288.87, "Robinhood": 19748.14, "M1 Finance": 8102.19, "Roth IRA": 6973.14, "Roth 401k": 50.74, "Student Loans": -15115.23}'),

  -- 2021
  ('2021-12-01T00:00:00Z', '', '{"Checking": 1475.65, "Emergency Fund": 2185.08, "Travel Fund": 499.77, "Short Term Fund": 396.02, "Fixed Expense Fund": 148.52, "HSA": 338.22, "Amazon Credit Card": -15.51, "Citi Credit Card": -75.32, "Discover Credit Card": 0.00, "Bitcoin": 1494.78, "Etrade": 0.00, "Robinhood": 19666.74, "M1 Finance": 0.00, "M1 Finance": 7126.84, "Roth IRA": 6308.11, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-11-01T00:00:00Z', '', '{"Checking": 2428.23, "Emergency Fund": 2003.66, "Travel Fund": 406.48, "Short Term Fund": 395.71, "Fixed Expense Fund": 33.53, "HSA": 283.72, "Amazon Credit Card": -56.46, "Citi Credit Card": -77.58, "Discover Credit Card": 0.00, "Bitcoin": 1545.94, "Etrade": 0.00, "Robinhood": 20721.16, "M1 Finance": 3458.92, "M1 Finance": 3000.64, "Roth IRA": 5892.59, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-10-01T00:00:00Z', 'I haven''t had a job since August so I''m hurting for money. However I just got a Software Engineering job with BKD so that should improve', '{"Checking": 719.55, "Emergency Fund": 2503.66, "Travel Fund": 444.15, "Short Term Fund": 695.71, "Fixed Expense Fund": 33.53, "HSA": 285.72, "Amazon Credit Card": 18.95, "Citi Credit Card": -115.77, "Discover Credit Card": 0.00, "Bitcoin": 1216.36, "Etrade": 0.00, "Robinhood": 16188.21, "M1 Finance": 3228.91, "M1 Finance": 2849.74, "Roth IRA": 5218.42, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-09-01T00:00:00Z', '', '{"Checking": 1311.16, "Emergency Fund": 4002.59, "Travel Fund": 444.00, "Short Term Fund": 501.14, "Fixed Expense Fund": 161.02, "HSA": 285.72, "Amazon Credit Card": 0.00, "Citi Credit Card": -526.70, "Discover Credit Card": 0.00, "Bitcoin": 1245.54, "Etrade": 0.00, "Robinhood": 16002.58, "M1 Finance": 3360.14, "M1 Finance": 3365.79, "Roth IRA": 4933.41, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-08-01T00:00:00Z', '', '{"Checking": 1344.49, "Emergency Fund": 4001.23, "Travel Fund": 333.38, "Short Term Fund": 500.97, "Fixed Expense Fund": 130.50, "HSA": 0.00, "Amazon Credit Card": -26.05, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Bitcoin": 1070.62, "Etrade": 0.00, "Robinhood": 15193.71, "M1 Finance": 3259.83, "M1 Finance": 3058.26, "Roth IRA": 4240.06, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-07-01T00:00:00Z', 'Koch Sign On Bonus plus first paychecks.', '{"Checking": 2001.04, "Emergency Fund": 3985.01, "Travel Fund": 265.94, "Short Term Fund": 500.80, "Fixed Expense Fund": 0.00, "HSA": 0.00, "Amazon Credit Card": -12.71, "Citi Credit Card": -879.30, "Discover Credit Card": 0.00, "Bitcoin": 833.41, "Etrade": 0.00, "Robinhood": 14911.55, "M1 Finance": 3332.75, "M1 Finance": 2709.56, "Roth IRA": 3775.09, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-06-01T00:00:00Z', 'Bitcoin & Overall market "crash". Got 5,000$ for graduation. Had to buy an iPhone 12', '{"Checking": 549.74, "Emergency Fund": 4704.65, "Travel Fund": 503.80, "Short Term Fund": 500.64, "Fixed Expense Fund": 0.00, "HSA": 0.00, "Amazon Credit Card": -42.99, "Citi Credit Card": -1285.87, "Discover Credit Card": 0.00, "Bitcoin": 855.99, "Etrade": 0.00, "Robinhood": 13520.49, "M1 Finance": 2990.33, "M1 Finance": 2492.65, "Roth IRA": 3322.50, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-05-01T00:00:00Z', '', '{"Checking": 1166.80, "Emergency Fund": 5003.01, "Travel Fund": 403.65, "Short Term Fund": 500.47, "Fixed Expense Fund": 0.00, "HSA": 0.00, "Amazon Credit Card": -67.10, "Citi Credit Card": -233.17, "Discover Credit Card": 0.00, "Bitcoin": 1234.89, "Etrade": 0.00, "Robinhood": 11271.96, "M1 Finance": 3103.37, "M1 Finance": 992.53, "Roth IRA": 2085.30, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-04-01T00:00:00Z', '', '{"Checking": 1047.19, "Emergency Fund": 5001.37, "Travel Fund": 278.54, "Short Term Fund": 500.31, "Fixed Expense Fund": 0.00, "HSA": 0.00, "Amazon Credit Card": -94.98, "Citi Credit Card": -22.00, "Discover Credit Card": 0.00, "Bitcoin": 1165.29, "Etrade": 0.00, "Robinhood": 10132.39, "M1 Finance": 3027.17, "M1 Finance": 370.69, "Roth IRA": 1737.63, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-03-01T00:00:00Z', 'Colorado Trip. Had to pay for pants and jacket and the gear and shit when I got there. Built a whole new PC minus the graphics card and got second stimi', '{"Checking": 1275.14, "Emergency Fund": 3933.80, "Travel Fund": 478.41, "Short Term Fund": 1475.14, "Fixed Expense Fund": 0.00, "HSA": 0.00, "Amazon Credit Card": 0.00, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Bitcoin": 1035.76, "Etrade": 116.45, "Robinhood": 9592.52, "M1 Finance": 3258.39, "M1 Finance": 0.00, "Roth IRA": 1498.03, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-02-01T00:00:00Z', 'Transferred majority of Etrade to robinhood/M1. Market dipped hard last week. Got tax return of 2,000$, 1,150$ in cash moved to account and spent 1,850$ fixing my car. At the moment 400$ of bitcoin is cash and about 1,400$ of robinhood. And I suppose I should mention that the student loans hit', '{"Checking": 1160.60, "Emergency Fund": 5606.11, "Travel Fund": 756.19, "Short Term Fund": 225.02, "Fixed Expense Fund": 0.00, "HSA": 0.00, "Amazon Credit Card": 0.00, "Citi Credit Card": -427.20, "Discover Credit Card": 0.00, "Bitcoin": 369.10, "Etrade": 7099.01, "Robinhood": 5066.48, "M1 Finance": 0.00, "M1 Finance": 0.00, "Roth IRA": 1292.86, "Roth 401k": 0.00, "Student Loans": -15115.23}'),
  ('2021-01-01T00:00:00Z', 'First month with a true, operational budget. In the process of moving majority of equity stocks to robinhood, So expect Etrade to go down. Also I''m expecting some sort of correction this year so don''t be surprised if net worth is volatile. Started investing more into Bitcoin in January.', '{"Checking": 1363.89, "Emergency Fund": 5002.70, "Travel Fund": 630.75, "Short Term Fund": 0.00, "Fixed Expense Fund": 0.00, "HSA": 0.00, "Amazon Credit Card": 0.00, "Citi Credit Card": -56.23, "Discover Credit Card": -51.66, "Bitcoin": 24.60, "Etrade": 7787.38, "Robinhood": 3977.28, "M1 Finance": 0.00, "M1 Finance": 0.00, "Roth IRA": 1117.86, "Roth 401k": 0.00, "Student Loans": -11365.23}'),

  -- 2020
  ('2020-12-01T00:00:00Z', '', '{"Checking": 1298.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": -2.00, "Travel Fund": 565.00, "Etrade": 6980.00, "Robinhood": 3950.00, "Roth IRA": 1090.00, "Roth 401k": 0.00, "Student Loans": -11250.00}'),
  ('2020-11-01T00:00:00Z', '', '{"Checking": 1234.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": -123.00, "Discover Credit Card": -432.00, "Travel Fund": 300.00, "Etrade": 6378.00, "Robinhood": 2586.00, "Roth IRA": 590.00, "Roth 401k": 0.00, "Student Loans": -11250.00}'),
  ('2020-10-01T00:00:00Z', '', '{"Checking": 1233.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": -9.00, "Travel Fund": 200.00, "Etrade": 6123.00, "Robinhood": 2500.00, "Roth IRA": 567.00, "Roth 401k": 0.00, "Student Loans": -11250.00}'),
  ('2020-09-01T00:00:00Z', '', '{"Checking": 1233.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Travel Fund": 175.00, "Etrade": 4632.00, "Robinhood": 2013.00, "Roth IRA": 500.00, "Roth 401k": 0.00, "Student Loans": -10000.00}'),
  ('2020-08-01T00:00:00Z', '', '{"Checking": 234.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": -123.00, "Travel Fund": 300.00, "Etrade": 4578.00, "Robinhood": 1678.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -10000.00}'),
  ('2020-07-01T00:00:00Z', '', '{"Checking": 2343.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Travel Fund": 0.00, "Etrade": 4365.00, "Robinhood": 1545.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -7500.00}'),
  ('2020-06-01T00:00:00Z', '', '{"Checking": 340.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Travel Fund": 0.00, "Etrade": 4000.00, "Robinhood": 1500.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -7500.00}'),
  ('2020-05-01T00:00:00Z', '', '{"Checking": 24.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": -453.00, "Travel Fund": 0.00, "Etrade": 3100.00, "Robinhood": 1000.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -7500.00}'),
  ('2020-04-01T00:00:00Z', '', '{"Checking": 3456.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Travel Fund": 0.00, "Etrade": 3000.00, "Robinhood": 500.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -7500.00}'),
  ('2020-03-01T00:00:00Z', '', '{"Checking": 543.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 5000.00, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Travel Fund": 0.00, "Etrade": 0.00, "Robinhood": 0.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -7500.00}'),
  ('2020-02-01T00:00:00Z', '', '{"Checking": 345.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 4000.00, "Citi Credit Card": 0.00, "Discover Credit Card": 0.00, "Travel Fund": 0.00, "Etrade": 0.00, "Robinhood": 0.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -7500.00}'),
  ('2020-01-01T00:00:00Z', '', '{"Checking": 1234.00, "Fixed Expense Fund": 0.00, "Short Term Fund": 3000.00, "Citi Credit Card": 0.00, "Discover Credit Card": -234.00, "Travel Fund": 0.00, "Etrade": 0.00, "Robinhood": 0.00, "Roth IRA": 0.00, "Roth 401k": 0.00, "Student Loans": -7500.00}');

--------------------------------------------------------------------
-- Step 5: Insert snapshots and NetWorth rows
--------------------------------------------------------------------

WITH inserted_snapshots AS (
INSERT INTO "NetWorthSnapshots"
  ("UserId", "Date", "Notes")
SELECT
  '1af2e369-3604-4302-a90b-67edd4c26152' AS "UserId",
  "Date",
  "Notes"
FROM temp_snapshots
    RETURNING
"SnapshotId", "Date"
  ),
  account_values AS
(
    SELECT
  s."SnapshotId",
  s."Date",
  a."AccountId",
  CASE
        WHEN t.snapshot_data ? a."Name" THEN
          CAST(t.snapshot_data->>a."Name" AS NUMERIC(18,2))
        ELSE NULL
      END AS "Value"
FROM inserted_snapshots s
    CROSS JOIN "NetWorthAccounts" a
  INNER JOIN temp_snapshots t
  ON s."Date" = t."Date"
WHERE a."UserId" = '1af2e369-3604-4302-a90b-67edd4c26152'
  )
INSERT INTO "NetWorth"
  ("SnapshotId", "AccountId", "Value")
SELECT "SnapshotId", "AccountId", "Value"
FROM account_values
WHERE "Value" IS NOT NULL;

--------------------------------------------------------------------
-- Step 6: Quick verification (inside transaction)
--------------------------------------------------------------------

SELECT
  COUNT(*)    AS total_snapshots,
  MIN("Date") AS earliest_date,
  MAX("Date") AS latest_date
FROM "NetWorthSnapshots"
WHERE "UserId" = '1af2e369-3604-4302-a90b-67edd4c26152';

SELECT
  COUNT(*) AS total_net_worth_entries
FROM "NetWorth" nw
  INNER JOIN "NetWorthSnapshots" s
  ON nw."SnapshotId" = s."SnapshotId"
WHERE s."UserId" = '1af2e369-3604-4302-a90b-67edd4c26152';

COMMIT;

----------------------------------------------------------------------
-- Step 7: Sample data / verification (post-commit)
----------------------------------------------------------------------

-- Latest 5 snapshots with aggregated assets/liabilities and category count
SELECT
  s."Date",
  COUNT(DISTINCT c."Name") AS category_count,
  COUNT(*)                 AS account_count,
  SUM(CASE WHEN c."IsAsset" THEN nw."Value" ELSE 0 END)      AS total_assets,
  SUM(CASE WHEN NOT c."IsAsset" THEN nw."Value" ELSE 0 END)  AS total_liabilities
FROM "NetWorthSnapshots" s
  LEFT JOIN "NetWorth" nw
  ON s."SnapshotId" = nw."SnapshotId"
  LEFT JOIN "NetWorthAccounts" a
  ON nw."AccountId" = a."AccountId"
INSERT INTO "NetWorthAccounts"
LEFT JOIN "NetWorthCategories" c
  ON a."NetWorthCategoryId" = c."CategoryId"
WHERE s."UserId" = '1af2e369-3604-4302-a90b-67edd4c26152'
GROUP BY s."Date"
ORDER BY s."Date" DESC
LIMIT 5;

-- Overall verification
SELECT
  COUNT(DISTINCT s."SnapshotId") AS total_snapshots,
  COUNT(*)                       AS total_entries,
  MIN(s."Date")                  AS earliest_date,
  MAX(s."Date")                  AS latest_date
FROM "NetWorthSnapshots" s
  LEFT JOIN "NetWorth" n
  ON s."SnapshotId" = n."SnapshotId"
WHERE s."UserId" = '1af2e369-3604-4302-a90b-67edd4c26152';
