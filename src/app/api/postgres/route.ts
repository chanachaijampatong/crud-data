import { NextResponse } from "next/server";
import pool from "@/lib/db";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}

// Helper to get schema of table in 'public' schema
async function getTableSchema(tableName: string = "student"): Promise<{
  columns: ColumnInfo[];
  primaryKey: string | null;
  availableTables: string[];
}> {
  // Check available tables in public schema
  const tablesRes = await pool.query(
    `SELECT table_name 
     FROM information_schema.tables 
     WHERE table_schema = 'public' 
     ORDER BY table_name;`
  );
  const availableTables = tablesRes.rows.map((r) => r.table_name);

  // Check columns and primary keys of specified table
  const columnsRes = await pool.query(
    `SELECT 
        c.column_name, 
        c.data_type, 
        c.is_nullable, 
        c.column_default,
        CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN true ELSE false END as is_primary_key
     FROM information_schema.columns c
     LEFT JOIN information_schema.key_column_usage kcu
        ON c.table_schema = kcu.table_schema
        AND c.table_name = kcu.table_name
        AND c.column_name = kcu.column_name
     LEFT JOIN information_schema.table_constraints tc
        ON kcu.table_schema = tc.table_schema
        AND kcu.table_name = tc.table_name
        AND kcu.constraint_name = tc.constraint_name
        AND tc.constraint_type = 'PRIMARY KEY'
     WHERE c.table_schema = 'public' 
        AND c.table_name = $1
     ORDER BY c.ordinal_position;`,
    [tableName]
  );

  const columns: ColumnInfo[] = columnsRes.rows.map((row) => ({
    column_name: row.column_name,
    data_type: row.data_type,
    is_nullable: row.is_nullable,
    column_default: row.column_default,
    is_primary_key: Boolean(row.is_primary_key),
  }));

  const pkCol = columns.find((c) => c.is_primary_key)?.column_name || columns[0]?.column_name || null;

  return { columns, primaryKey: pkCol, availableTables };
}

// 1. GET: Fetch table schema and all records
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("table") || "student";

    const { columns, primaryKey, availableTables } = await getTableSchema(tableName);

    if (columns.length === 0) {
      return NextResponse.json({
        success: false,
        tableNotFound: true,
        message: `ตาราง '${tableName}' ยังไม่มีในฐานข้อมูล schema public`,
        availableTables,
      });
    }

    // Query rows ordered by PK or first column
    const orderClause = primaryKey ? `ORDER BY "${primaryKey}" ASC` : "";
    const rowsRes = await pool.query(`SELECT * FROM "${tableName}" ${orderClause} LIMIT 500;`);

    return NextResponse.json({
      success: true,
      tableName,
      columns,
      primaryKey,
      rows: rowsRes.rows,
      total: rowsRes.rowCount,
      availableTables,
    });
  } catch (error: any) {
    console.error("Database GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลจาก PostgreSQL",
        code: error.code,
        hint: error.hint,
      },
      { status: 500 }
    );
  }
}

// 2. POST: Create a new record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tableName = body.tableName || "student";
    const data = body.data || body;

    const { columns } = await getTableSchema(tableName);
    if (columns.length === 0) {
      return NextResponse.json({ success: false, error: `ไม่พบตาราง ${tableName}` }, { status: 404 });
    }

    const validCols: string[] = [];
    const values: any[] = [];

    for (const col of columns) {
      const colName = col.column_name;
      const rawVal = data[colName];

      if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
        validCols.push(`"${colName}"`);
        // Format according to data type
        if (col.data_type.includes("int")) {
          values.push(parseInt(String(rawVal), 10));
        } else if (col.data_type.includes("numeric") || col.data_type.includes("double")) {
          values.push(parseFloat(String(rawVal)));
        } else {
          values.push(rawVal);
        }
      }
    }

    if (validCols.length === 0) {
      return NextResponse.json({ success: false, error: "ไม่มีข้อมูลสำหรับบันทึก" }, { status: 400 });
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
    const query = `
      INSERT INTO "${tableName}" (${validCols.join(", ")})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    return NextResponse.json({
      success: true,
      message: "เพิ่มข้อมูลสำเร็จ",
      row: result.rows[0],
    });
  } catch (error: any) {
    console.error("Database POST Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
        code: error.code,
      },
      { status: 500 }
    );
  }
}

// 3. PUT: Update an existing record
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const tableName = body.tableName || "student";
    const { id, primaryKey: customPk, data } = body;

    const { columns, primaryKey: detectedPk } = await getTableSchema(tableName);
    const pk = customPk || detectedPk;

    if (!pk) {
      return NextResponse.json({ success: false, error: "ไม่พบคอลัมน์ Primary Key สำหรับอัปเดต" }, { status: 400 });
    }

    if (id === undefined || id === null) {
      return NextResponse.json({ success: false, error: "ไม่พบรหัสอ้างอิง (ID) ของแถวข้อมูล" }, { status: 400 });
    }

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const rowData = data || body;
    for (const col of columns) {
      const colName = col.column_name;
      if (colName === pk) continue;

      if (rowData[colName] !== undefined) {
        setClauses.push(`"${colName}" = $${paramIndex}`);
        const rawVal = rowData[colName];
        if (rawVal === "" || rawVal === null) {
          values.push(null);
        } else if (col.data_type.includes("int")) {
          values.push(parseInt(String(rawVal), 10));
        } else if (col.data_type.includes("numeric") || col.data_type.includes("double")) {
          values.push(parseFloat(String(rawVal)));
        } else {
          values.push(rawVal);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ success: false, error: "ไม่มีข้อมูลที่ต้องอัปเดต" }, { status: 400 });
    }

    const pkCol = columns.find((c) => c.column_name === pk);
    const pkValue = pkCol?.data_type.includes("int") ? parseInt(String(id), 10) : id;
    values.push(pkValue);

    const query = `
      UPDATE "${tableName}"
      SET ${setClauses.join(", ")}
      WHERE "${pk}" = $${paramIndex}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูลที่ต้องการอัปเดต" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "อัปเดตข้อมูลสำเร็จ",
      row: result.rows[0],
    });
  } catch (error: any) {
    console.error("Database PUT Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "เกิดข้อผิดพลาดในการอัปเดตข้อมูล",
        code: error.code,
      },
      { status: 500 }
    );
  }
}

// 4. DELETE: Delete a record
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const customPk = searchParams.get("key");
    const tableName = searchParams.get("table") || "student";

    if (!id) {
      return NextResponse.json({ success: false, error: "ต้องระบุ id ที่ต้องการลบ" }, { status: 400 });
    }

    const { columns, primaryKey: detectedPk } = await getTableSchema(tableName);
    const pk = customPk || detectedPk;

    if (!pk) {
      return NextResponse.json({ success: false, error: "ไม่พบคอลัมน์ Primary Key สำหรับลบข้อมูล" }, { status: 400 });
    }

    const pkCol = columns.find((c) => c.column_name === pk);
    const pkValue = pkCol?.data_type.includes("int") ? parseInt(String(id), 10) : id;

    const query = `DELETE FROM "${tableName}" WHERE "${pk}" = $1 RETURNING *;`;
    const result = await pool.query(query, [pkValue]);

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: "ไม่พบข้อมูลที่ต้องการลบ" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "ลบข้อมูลสำเร็จ",
      deletedRow: result.rows[0],
    });
  } catch (error: any) {
    console.error("Database DELETE Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "เกิดข้อผิดพลาดในการลบข้อมูล",
        code: error.code,
      },
      { status: 500 }
    );
  }
}
