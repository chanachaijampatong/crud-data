import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Helper endpoint to initialize a default 'postgres' table if the user needs one
export async function POST() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "postgres" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) DEFAULT 'General',
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(createTableQuery);

    // Insert sample data if empty
    const checkRows = await pool.query(`SELECT COUNT(*) FROM "postgres";`);
    if (parseInt(checkRows.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO "postgres" (name, description, category, status)
        VALUES 
          ('ข้อมูลตัวอย่างที่ 1', 'รายละเอียดข้อมูลสำหรับทดสอบระบบ CRUD', 'Demo', 'active'),
          ('ข้อมูลตัวอย่างที่ 2', 'ทดสอบเชื่อมต่อ PostgreSQL ผ่าน node-postgres', 'Test', 'pending');
      `);
    }

    return NextResponse.json({
      success: true,
      message: "สร้างตาราง 'postgres' พร้อมข้อมูลตัวอย่างเรียบร้อยแล้ว",
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
