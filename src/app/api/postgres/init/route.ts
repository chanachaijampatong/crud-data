import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Endpoint to initialize table 'rytc' in the database
export async function POST(request: Request) {
  try {
    let tableName = "rytc";
    try {
      const body = await request.json();
      if (body.tableName) tableName = body.tableName;
    } catch {
      // json body optional
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) DEFAULT 'ทั่วไป',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);

    // Insert initial sample data if empty
    const checkRows = await pool.query(`SELECT COUNT(*) FROM "${tableName}";`);
    if (parseInt(checkRows.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO "${tableName}" (name, description, category, status)
        VALUES 
          ('รายการตัวอย่างที่ 1', 'ทดสอบเชื่อมต่อฐานข้อมูล rytc สำเร็จ', 'ทดสอบ', 'active'),
          ('รายการตัวอย่างที่ 2', 'ระบบ CRUD พร้อมใช้งาน เพิ่ม แก้ไข ลบได้ทันที', 'ระบบ', 'completed');
      `);
    }

    return NextResponse.json({
      success: true,
      tableName,
      message: `สร้างตาราง '${tableName}' พร้อมข้อมูลตัวอย่างเรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    console.error("Database Init Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "เกิดข้อผิดพลาดในการสร้างตาราง",
        code: error.code,
      },
      { status: 500 }
    );
  }
}
