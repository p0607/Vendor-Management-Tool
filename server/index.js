const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt'); // Import bcrypt
const xlsx = require('xlsx');


const app = express();
const PORT = 5001;


// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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
// Signup endpoint
const ALLOWED_DESIGNATIONS = [
  'ASSOCIATE_VENDOR_MANAGEMENT',
  'ADMIN',
  'SUPER ADMIN',
  'BU HEAD',
  'FINANCE EXECUTIVE'
];

app.post('/signup', async (req, res) => {
  // Destructure all required fields from req.body
  const { name, designation, email, phone_number, password, business_unit } = req.body;

  // Validate required fields
  if (!name || !designation || !email || !phone_number || !password || !business_unit) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required'
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, designation, email, phone_number, password, business_unit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, designation, email, phone_number, hashedPassword, business_unit]
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    
    if (err.code === '23505') { // Unique violation (email already exists)
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Email already exists'
      });
    } else if (err.code === '23514') { // Check constraint violation
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Invalid designation or business unit value'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Database error',
        message: err.message
      });
    }
  }
});
// Login endpoint
app.post('/login', async (req, res) => {
  const { name, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE name = $1', [name]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid) {
      // Return user designation along with success message
      res.json({ 
        success: true, 
        message: 'Login successful',
        designation: user.designation,
        business_unit: user.business_unit
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}); 

// SUPER ADMIN and ADMIN can see all components
app.get('/CTS', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM "cts" ORDER BY created_at DESC');
    res.setHeader('Content-Type', 'application/json');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
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
        "Cheque Issued Name", "Cheque Date", "Cheque No", "Cheque Amount", "REMARK","domain","po_description",
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38,
        $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51, $52, $53,
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
        routingData['REMARK'] || null,
        routingData['domain'] || null,
        routingData['po_description'] || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding routing data:', err);
    res.status(500).json({ error: err.message });
  }
});


// PUT endpoint to update routing table data
app.put('/Alchemy_Routing/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    if (!id || !updatedData) {
      return res.status(400).json({ error: 'ID and updated data are required' });
    }

    // Update the record in your database
    const result = await pool.query(
      `UPDATE alchemy_routing SET
        "Costing Date" = $1,
        "IBM / KYNDRYL" = $2,
        "Requestor" = $3,
        "Department SPOC" = $4,
        "SPOC E-mail ID" = $5,
        "Training / Services Details" = $6,
        "Description" = $7,
        "PAX" = $8,
        "IBM / KYNDRYL PO No" = $9,
        "IBM / KYNDRYL PO Date" = $10,
        "IBM / KYNDRYL PO Value" = $11,
        "Duration / Days" = $12,
        "Payment INR / $" = $13,
        "Payment $ WHT %" = $14,
        "Gross Up $ Percentage" = $15,
        "Grossed Up Invoice $" = $16,
        "Vendor Payout" = $17,
        "Integration %" = $18,
        "Integrator Charges (Margin)" = $19,
        "Alchemy Billing Value" = $20,
        "Funding cost" = $21,
        "Net Margin" = $22,
        "Billing Month" = $23,
        "Payment Day's" = $24,
        "Vendor Details" = $25,
        "Vendor SPOC" = $26,
        "Vendor SPOC Contact No" = $27,
        "Vendor SPOC E-mail ID" = $28,
        "Trainer Name" = $29,
        "Training Dates" = $30,
        "Vendor Inv. No." = $31,
        "Vendor Inv. Date" = $32,
        "Vendor Inv. Amount" = $33,
        "CGST @ 9%" = $34,
        "SGST @ 9%" = $35,
        "IGST @ 18%" = $36,
        "Total Invoice" = $37,
        "Vendor Amount After TDS 10%" = $38,
        "Net Payment to Vendor" = $39,
        "Payment Due Date" = $40,
        "Payment Due Week" = $41,
        "Alchemy Techsol Invoive No" = $42,
        "Alchemy Techsol Invoice Date" = $43,
        "Alchemy Techsol Invoice Amount" = $44,
        "Payment Expected Date (IBM)" = $45,
        "Cheque Issued Name" = $46,
        "Cheque Date" = $47,
        "Cheque No" = $48,
        "Cheque Amount" = $49,
        "REMARK" = $50,
       "Sl.No" = $51,
        "domain" = $51,
        "po_description" = $52,
       WHERE "id" = $52
       RETURNING *`,
      [
        updatedData["Costing Date"],
        updatedData["IBM / KYNDRYL"],
        updatedData["Requestor"],
        updatedData["Department SPOC"],
        updatedData["SPOC E-mail ID"],
        updatedData["Training / Services Details"],
        updatedData["Description"],
        updatedData["PAX"],
        updatedData["IBM / KYNDRYL PO No"],
        updatedData["IBM / KYNDRYL PO Date"],
        updatedData["IBM / KYNDRYL PO Value"],
        updatedData["Duration / Days"],
        updatedData["Payment INR / $"],
        updatedData["Payment $ WHT %"],
        updatedData["Gross Up $ Percentage"],
        updatedData["Grossed Up Invoice $"],
        updatedData["Vendor Payout"],
        updatedData["Integration %"],
        updatedData["Integrator Charges (Margin)"],
        updatedData["Alchemy Billing Value"],
        updatedData["Funding cost"],
        updatedData["Net Margin"],
        updatedData["Billing Month"],
        updatedData["Payment Day's"],
        updatedData["Vendor Details"],
        updatedData["Vendor SPOC"],
        updatedData["Vendor SPOC Contact No"],
        updatedData["Vendor SPOC E-mail ID"],
        updatedData["Trainer Name"],
        updatedData["Training Dates"],
        updatedData["Vendor Inv. No."],
        updatedData["Vendor Inv. Date"],
        updatedData["Vendor Inv. Amount"],
        updatedData["CGST @ 9%"],
        updatedData["SGST @ 9%"],
        updatedData["IGST @ 18%"],
        updatedData["Total Invoice"],
        updatedData["Vendor Amount After TDS 10%"],
        updatedData["Net Payment to Vendor"],
        updatedData["Payment Due Date"],
        updatedData["Payment Due Week"],
        updatedData["Alchemy Techsol Invoive No"],
        updatedData["Alchemy Techsol Invoice Date"],
        updatedData["Alchemy Techsol Invoice Amount"],
        updatedData["Payment Expected Date (IBM)"],
        updatedData["Cheque Issued Name"],
        updatedData["Cheque Date"],
        updatedData["Cheque No"],
        updatedData["Cheque Amount"],
        updatedData["REMARK"],
        updatedData["REMARK"],
        updatedData["Sl.No"],
        updatedData["domain"],
        updatedData["po_description"],
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating routing data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CTS Routes
app.get('/CTS', async (req, res) => {
  console.log('CTS endpoint accessed'); // Debug log
  try {
    const { rows } = await pool.query('SELECT * FROM "cts" ORDER BY created_at DESC');
    
    // Enforce JSON response
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(rows);
    
    console.log(`Sent ${rows.length} records`); // Debug log
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST endpoint to add a new CTS record
app.post('/CTS', async (req, res) => {
  const data = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO cts (
        sl_no, vendor_name, booking_month, resource_name, service_month,
        vendor_invoice_no, vendor_invoice_date, base_amount, gst, total_amount,
        tds, net_receivable, payment_received, balance_receivable, tally_book_entry_date,
        sub_vendor_invoice_date, sub_vendor_invoice_no, base_amount_tally, margin,
        vendor_invoice_status, payment_date, instrument_no, payment_mode, payment_status,
        receipts_status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        data.sl_no, data.vendor_name, data.booking_month, data.resource_name, data.service_month,
        data.vendor_invoice_no, data.vendor_invoice_date, data.base_amount, data.gst, data.total_amount,
        data.tds, data.net_receivable, data.payment_received, data.balance_receivable, data.tally_book_entry_date,
        data.sub_vendor_invoice_date, data.sub_vendor_invoice_no, data.base_amount_tally, data.margin,
        data.vendor_invoice_status, data.payment_date, data.instrument_no, data.payment_mode, data.payment_status,
        data.receipts_status, data.created_at || new Date() // Use current date if not provided
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding CTS record:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT endpoint to update a CTS record by sl_no
app.put('/CTS/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const result = await pool.query(
      `UPDATE cts SET
        vendor_name = $1,
        booking_month = $2,
        resource_name = $3,
        service_month = $4,
        vendor_invoice_no = $5,
        vendor_invoice_date = $6,
        base_amount = $7,
        gst = $8,
        total_amount = $9,
        tds = $10,
        net_receivable = $11,
        payment_received = $12,
        balance_receivable = $13,
        tally_book_entry_date = $14,
        sub_vendor_invoice_date = $15,
        sub_vendor_invoice_no = $16,
        base_amount_tally = $17,
        margin = $18,
        vendor_invoice_status = $19,
        payment_date = $20,
        instrument_no = $21,
        payment_mode = $22,
        payment_status = $23,
        receipts_status = $24
      WHERE id = $25
      RETURNING *`,
      [
        data.vendor_name, data.booking_month, data.resource_name, data.service_month,
        data.vendor_invoice_no, data.vendor_invoice_date, data.base_amount, data.gst, data.total_amount,
        data.tds, data.net_receivable, data.payment_received, data.balance_receivable, data.tally_book_entry_date,
        data.sub_vendor_invoice_date, data.sub_vendor_invoice_no, data.base_amount_tally, data.margin,
        data.vendor_invoice_status, data.payment_date, data.instrument_no, data.payment_mode, data.payment_status,
        data.receipts_status, id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating CTS record:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/CTS/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  const setClause = Object.keys(fields)
    .map((key, idx) => `${key} = $${idx + 1}`)
    .join(', ');
  const values = Object.values(fields);

  if (!setClause) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const result = await pool.query(
      `UPDATE cts SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating CTS record:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/team-report', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM team_report');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error');
  }
});

app.post('/team-report', async (req, res) => {
  const { lob, particulars, amount, month } = req.body;
  if (!lob || !particulars || !amount || !month) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO team_report (lob, particulars, amount, month) VALUES ($1, $2, $3, $4) RETURNING *',
      [lob, particulars, amount, month]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding team report:', err);
    res.status(500).json({ error: err.message });
  }
});
   
app.patch('/Alchemy_Routing/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  if (!id || !fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'ID and at least one field are required' });
  }

  // Build SET clause dynamically
  const setClause = Object.keys(fields)
    .map((key, idx) => `"${key}" = $${idx + 1}`)
    .join(', ');
  const values = Object.values(fields);

  try {
    const result = await pool.query(
      `UPDATE "Alchemy_Routing" SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating Alchemy_Routing:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/team-report/bulk', async (req, res) => {
  try {
    const { data } = req.body; // data should be an array of objects
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }
    const values = data.map(row => [
      row.lob, row.particulars, row.amount, row.month
    ]);
    const query = `
      INSERT INTO team_report (lob, particulars, amount, month)
      VALUES ${values.map((_, i) => `($${i*4+1}, $${i*4+2}, $${i*4+3}, $${i*4+4})`).join(',')}
      RETURNING *
    `;
    const flatValues = values.flat();
    const result = await pool.query(query, flatValues);
    res.status(201).json(result.rows);
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});


// Start server
app.listen(5001, '0.0.0.0', () => {
  console.log(`Server running on port 5001`);
});