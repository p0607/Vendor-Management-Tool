const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt'); // Import bcrypt

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // Your React app's URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'Vendor_Management',
  password: process.env.DB_PASSWORD || 'Postgres0607@',
  port: process.env.DB_PORT || 5432,
});

// Routes
// Endpoint for Signup
app.post('/signup', async (req, res) => {
  const { name, email, password, phone_number,  client_name, designation } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, name, phone_number, designation,   client_name, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [email, name, phone_number, designation, client_name, hashedPassword]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Received email:', email);

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (isPasswordValid) {
        res.status(200).json({ success: true, message: 'Login successful' });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ success: false, message: 'User not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// API endpoint to fetch demand data
app.get('/Alchemy_Routing', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "Alchemy_Routing"');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST endpoint for adding routing data
// POST endpoint for adding routing data
app.post('/Alchemy_Routing', async (req, res) => {
  console.log('POST /Alchemy_Routing received');
  // Destructure all fields from request body
  const routingData = req.body;

  // Basic validation - check if required fields are present
  if (!routingData['Sl.No'] || !routingData['Costing Date'] || !routingData['IBM / KYNDRYL']) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO "Alchemy_Routing" (
        "Sl.No", "Costing Date", "IBM / KYNDRYL", "Requestor", "Department SPOC",
        "SPOC E-mail ID", "Training / Services Details", "Description", "PAX",
        "IBM / KYNDRYL PO No", "IBM / KYNDRYL PO Date", "IBM / KYNDRYL PO Value",
        "Duration / Days", "Payment INR / $", "Payment $ WHT %", "Gross Up $ Percentage",
        "Grossed Up Invoice $", "Vendor Payout", "Integration %", "Integrator Charges (Margin)",
        "Alchemy Billing Value", "Funding cost", "Net Margin", "Billing Month", "Payment Day's",
        "Vendor Details", "Vendor SPOC", "Vendor SPOC Contact No", "Vendor SPOC E-mail ID",
        "Trainer Name", "Training Dates", "Vendor Inv. No.", "Vendor Inv. Date", "Vendor Inv. Amount",
        "CGST @ 9%", "SGST @ 9%", "IGST @ 18%", "Total Invoice", "Vendor Amount After TDS 10%",
        "Net Payment to Vendor", "Payment Due Date", "Payment Due Week", "Alchemy Techsol Invoive No",
        "Alchemy Techsol Invoice Date", "Alchemy Techsol Invoice Amount", "Payment Expected Date (IBM)",
        "Cheque Issued Name", "Cheque Date", "Cheque No", "Cheque Amount", "REMARK"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51 
      ) RETURNING *`,
      [
        routingData['Sl.No'],
        routingData['Costing Date'],
        routingData['IBM / KYNDRYL'],
        routingData['Requestor'] || null,
        routingData['Department SPOC'] || null,
        routingData['SPOC E-mail ID'] || null,
        routingData['Training / Services Details'] || null,
        routingData['Description'] || null,
        routingData['PAX'] || null,
        routingData['IBM / KYNDRYL PO No'] || null,
        routingData['IBM / KYNDRYL PO Date'] || null,
        routingData['IBM / KYNDRYL PO Value'] || null,
        routingData['Duration / Days'] || null,
        routingData['Payment INR / $'] || null,
        routingData['Payment $ WHT %'] || null,
        routingData['Gross Up $ Percentage'] || null,
        routingData['Grossed Up Invoice $'] || null,
        routingData['Vendor Payout'] || null,
        routingData['Integration %'] || null,
        routingData['Integrator Charges (Margin)'] || null,
        routingData['Alchemy Billing Value'] || null,
        routingData['Funding cost'] || null,
        routingData['Net Margin'] || null,
        routingData['Billing Month'] || null,
        routingData["Payment Day's"] || null,
        routingData['Vendor Details'] || null,
        routingData['Vendor SPOC'] || null,
        routingData['Vendor SPOC Contact No'] || null,
        routingData['Vendor SPOC E-mail ID'] || null,
        routingData['Trainer Name'] || null,
        routingData['Training Dates'] || null,
        routingData['Vendor Inv. No.'] || null,
        routingData['Vendor Inv. Date'] || null,
        routingData['Vendor Inv. Amount'] || null,
        routingData['CGST @ 9%'] || null,
        routingData['SGST @ 9%'] || null,
        routingData['IGST @ 18%'] || null,
        routingData['Total Invoice'] || null,
        routingData['Vendor Amount After TDS 10%'] || null,
        routingData['Net Payment to Vendor'] || null,
        routingData['Payment Due Date'] || null,
        routingData['Payment Due Week'] || null,
        routingData['Alchemy Techsol Invoive No'] || null,
        routingData['Alchemy Techsol Invoice Date'] || null,
        routingData['Alchemy Techsol Invoice Amount'] || null,
        routingData['Payment Expected Date (IBM)'] || null,
        routingData['Cheque Issued Name'] || null,
        routingData['Cheque Date'] || null,
        routingData['Cheque No'] || null,
        routingData['Cheque Amount'] || null,
        routingData['REMARK'] || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding routing data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});