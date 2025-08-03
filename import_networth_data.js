const fs = require('fs');
const https = require('https');

// Net worth data extracted from your CSV - main historical timeline
const netWorthData = [
  // 2020 data
  { date: '2020-01-01', netWorth: -3500.00, notes: 'First attempt at personalized budget' },
  { date: '2020-02-01', netWorth: -3155.00, notes: null },
  { date: '2020-03-01', netWorth: -1957.00, notes: null },
  { date: '2020-04-01', netWorth: 4456.00, notes: null },
  { date: '2020-05-01', netWorth: 1171.00, notes: null },
  { date: '2020-06-01', netWorth: 3340.00, notes: null },
  { date: '2020-07-01', netWorth: 5753.00, notes: null },
  { date: '2020-08-01', netWorth: 1667.00, notes: null },
  { date: '2020-09-01', netWorth: 3553.00, notes: null },
  { date: '2020-10-01', netWorth: 4364.00, notes: null },
  { date: '2020-11-01', netWorth: 4283.00, notes: null },
  { date: '2020-12-01', netWorth: 7631.00, notes: null },
  
  // 2021 data
  { date: '2021-01-01', netWorth: 8431.34, notes: 'First month with operational budget' },
  { date: '2021-02-01', netWorth: 6032.94, notes: 'Transferred Etrade to robinhood, market dip, car repair' },
  { date: '2021-03-01', netWorth: 7548.41, notes: 'Colorado trip, new PC build, stimulus' },
  { date: '2021-04-01', netWorth: 8028.37, notes: null },
  { date: '2021-05-01', netWorth: 10346.48, notes: null },
  { date: '2021-06-01', netWorth: 12996.70, notes: 'Bitcoin crash, graduation money, iPhone 12' },
  { date: '2021-07-01', netWorth: 16307.91, notes: 'Koch sign-on bonus' },
  { date: '2021-08-01', netWorth: 17991.77, notes: null },
  { date: '2021-09-01', netWorth: 19971.16, notes: null },
  { date: '2021-10-01', netWorth: 18171.91, notes: 'No job since August, got BKD software job' },
  { date: '2021-11-01', netWorth: 24921.31, notes: null },
  { date: '2021-12-01', netWorth: 24433.67, notes: null },
  
  // 2022 data
  { date: '2022-01-01', netWorth: 27271.35, notes: null },
  { date: '2022-02-01', netWorth: 25494.95, notes: 'Car repair, market crash' },
  { date: '2022-03-01', netWorth: 26160.51, notes: 'Russia vs Ukraine impact, vacation spending' },
  { date: '2022-04-01', netWorth: 34348.53, notes: null },
  { date: '2022-05-01', netWorth: 32465.75, notes: 'Market is dreadful' },
  { date: '2022-06-01', netWorth: 29532.22, notes: 'Getting worse, vacation expenses' },
  { date: '2022-07-01', netWorth: 30196.93, notes: 'Recession' },
  { date: '2022-08-01', netWorth: 37545.73, notes: null },
  { date: '2022-09-01', netWorth: 36612.15, notes: null },
  { date: '2022-10-01', netWorth: 35426.52, notes: null },
  { date: '2022-11-07', netWorth: 35365.17, notes: 'Had to wait until 7th - money moving to robinhood + yearly bonus' },
  { date: '2022-12-01', netWorth: 39938.03, notes: null },
  
  // 2023 data
  { date: '2023-01-01', netWorth: 42012.26, notes: null },
  { date: '2023-02-01', netWorth: 51692.84, notes: 'Economy doing well, got bonus' },
  { date: '2023-03-01', netWorth: 53436.40, notes: 'Europe travel spending' },
  { date: '2023-04-01', netWorth: 56578.89, notes: null },
  { date: '2023-05-01', netWorth: 57777.01, notes: 'TSLA dropped to $160/share' },
  { date: '2023-06-01', netWorth: 61876.52, notes: null },
  { date: '2023-07-01', netWorth: 70104.96, notes: 'Stocks popping off, vacation owed money' },
  { date: '2023-08-01', netWorth: 75932.11, notes: 'Bought Tesla, profit sharing, fat downpayment' },
  { date: '2023-09-01', netWorth: 74865.56, notes: null },
  { date: '2023-10-01', netWorth: 74046.61, notes: null },
  { date: '2023-11-01', netWorth: 73997.52, notes: null },
  { date: '2023-12-01', netWorth: 82429.92, notes: null },
  
  // 2024 data
  { date: '2024-01-01', netWorth: 88117.76, notes: null },
  { date: '2024-02-01', netWorth: 89258.09, notes: null },
  { date: '2024-03-01', netWorth: 101732.99, notes: 'EV tax return' },
  { date: '2024-04-01', netWorth: 103409.81, notes: null },
  { date: '2024-05-01', netWorth: 104381.56, notes: null },
  { date: '2024-06-01', netWorth: 111824.23, notes: null },
  { date: '2024-07-01', netWorth: 117843.51, notes: null },
  { date: '2024-08-01', netWorth: 126144.33, notes: 'Profit sharing' },
  { date: '2024-09-01', netWorth: 129879.20, notes: null },
  { date: '2024-10-01', netWorth: 134213.81, notes: null },
  { date: '2024-11-01', netWorth: 138228.29, notes: null },
  { date: '2024-12-01', netWorth: 157834.61, notes: 'TSLA popped' },
  
  // 2025 data (current)
  { date: '2025-01-01', netWorth: 159930.88, notes: null },
  { date: '2025-02-01', netWorth: 165396.20, notes: null },
  { date: '2025-03-01', netWorth: 159585.23, notes: 'TSLA down, Colorado trip, money on Oso and Amanda' },
  { date: '2025-04-01', netWorth: 156914.08, notes: 'Market down because tariffs' },
  { date: '2025-05-01', netWorth: 163070.86, notes: null },
  { date: '2025-06-01', netWorth: 177313.90, notes: 'Market up, paid off car, bonus' },
  { date: '2025-07-01', netWorth: 176527.66, notes: 'Bought a ring and Hawaii trip' }
];

// Detailed asset data for recent months where available
const detailedAssets = {
  '2025-01-01': [
    { name: 'Tesla', category: 'Bank Accounts', value: 25000.00, isAsset: true },
    { name: 'Checking', category: 'Bank Accounts', value: 1715.22, isAsset: true },
    { name: 'Emergency Fund', category: 'Bank Accounts', value: 6047.28, isAsset: true },
    { name: 'Travel', category: 'Bank Accounts', value: 1739.72, isAsset: true },
    { name: 'Short Term Savings', category: 'Bank Accounts', value: 42809.91, isAsset: true },
    { name: 'Gifts', category: 'Bank Accounts', value: 161.10, isAsset: true },
    { name: 'Oso', category: 'Bank Accounts', value: 389.05, isAsset: true },
    { name: 'FE Checking', category: 'Bank Accounts', value: 278.86, isAsset: true },
    { name: 'Bitcoin', category: 'Investments', value: 4669.50, isAsset: true },
    { name: 'HSA', category: 'Investments', value: 2267.83, isAsset: true },
    { name: 'Robinhood', category: 'Investments', value: 39684.87, isAsset: true },
    { name: 'Roth IRA', category: 'Retirement', value: 30978.18, isAsset: true },
    { name: 'Roth 401k', category: 'Retirement', value: 22885.71, isAsset: true },
    { name: 'Tesla Loan', category: 'Debt', value: 6439.70, isAsset: false },
    { name: 'Student Loans', category: 'Debt', value: 12256.65, isAsset: false }
  ],
  
  '2025-07-01': [
    { name: 'Tesla', category: 'Bank Accounts', value: 22000.00, isAsset: true },
    { name: 'Checking', category: 'Bank Accounts', value: 2140.12, isAsset: true },
    { name: 'Emergency Fund', category: 'Bank Accounts', value: 10932.70, isAsset: true },
    { name: 'Travel', category: 'Bank Accounts', value: 974.50, isAsset: true },
    { name: 'Short Term Savings', category: 'Bank Accounts', value: 28797.01, isAsset: true },
    { name: 'Gifts', category: 'Bank Accounts', value: 254.57, isAsset: true },
    { name: 'Oso', category: 'Bank Accounts', value: 429.31, isAsset: true },
    { name: 'FE Checking', category: 'Bank Accounts', value: 430.11, isAsset: true },
    { name: 'Amazon Credit Card', category: 'Credit Cards', value: 15.92, isAsset: false },
    { name: 'Citi Credit Card', category: 'Credit Cards', value: 17.99, isAsset: false },
    { name: 'Chase Travel Card', category: 'Credit Cards', value: 2.91, isAsset: false },
    { name: 'Bitcoin', category: 'Investments', value: 5139.15, isAsset: true },
    { name: 'HSA', category: 'Investments', value: 2927.51, isAsset: true },
    { name: 'Robinhood', category: 'Investments', value: 42732.61, isAsset: true },
    { name: 'Roth IRA', category: 'Retirement', value: 38012.95, isAsset: true },
    { name: 'Roth 401k', category: 'Retirement', value: 33194.76, isAsset: true },
    { name: 'Student Loans', category: 'Debt', value: 11400.82, isAsset: false }
  ]
};

async function createNetWorthSnapshot(data) {
  const assets = detailedAssets[data.date] || [];
  
  const payload = {
    date: data.date,
    netWorth: data.netWorth,
    notes: data.notes,
    assets: assets
  };

  const postData = JSON.stringify(payload);
  
  const options = {
    hostname: 'localhost',
    port: 5249,
    path: '/api/networth',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    rejectUnauthorized: false
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✓ Created snapshot for ${payload.date}: $${payload.netWorth.toLocaleString()}`);
          resolve(JSON.parse(data));
        } else {
          console.error(`✗ Failed to create snapshot for ${payload.date}: ${res.statusCode} ${data}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`✗ Network error for ${payload.date}:`, err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function importAllData() {
  console.log('🚀 Starting net worth data import...\n');
  
  for (const entry of netWorthData) {
    try {
      await createNetWorthSnapshot(entry);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to import ${entry.date}:`, error.message);
    }
  }
  
  console.log('\n✅ Net worth data import completed!');
}

// Change to http for localhost
const http = require('http');
async function createNetWorthSnapshotHttp(data) {
  const assets = detailedAssets[data.date] || [];
  
  const payload = {
    date: data.date,
    netWorth: data.netWorth,
    notes: data.notes,
    assets: assets
  };

  const postData = JSON.stringify(payload);
  
  const options = {
    hostname: 'localhost',
    port: 5249,
    path: '/api/networth',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✓ Created snapshot for ${payload.date}: $${payload.netWorth.toLocaleString()}`);
          resolve(JSON.parse(data));
        } else {
          console.error(`✗ Failed to create snapshot for ${payload.date}: ${res.statusCode} ${data}`);
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`✗ Network error for ${payload.date}:`, err.message);
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

async function importAllDataHttp() {
  console.log('🚀 Starting net worth data import...\n');
  
  for (const entry of netWorthData) {
    try {
      await createNetWorthSnapshotHttp(entry);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Failed to import ${entry.date}:`, error.message);
    }
  }
  
  console.log('\n✅ Net worth data import completed!');
}

importAllDataHttp();
