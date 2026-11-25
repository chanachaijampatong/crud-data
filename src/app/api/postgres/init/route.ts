import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Endpoint to initialize table 'student' in the database
export async function POST() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS "student" (
        sid INTEGER PRIMARY KEY,
        sname TEXT NOT NULL,
        phon INTEGER NOT NULL
      );
    `;

    await pool.query(createTableQuery);

    // Insert sample student row if empty
    const checkRows = await pool.query(`SELECT COUNT(*) FROM "student";`);
    if (parseInt(checkRows.rows[0].count, 10) === 0) {
      await pool.query(`
        INSERT INTO "student" (sid, sname, phon)
        VALUES (69001, 'นายคงทุย ทนงเดช', 920205025)
        ON CONFLICT (sid) DO NOTHING;
      `);
    }

    return NextResponse.json({
      success: true,
      tableName: "student",
      message: "สร้างตาราง student พร้อมข้อมูลตั้งต้นเรียบร้อยแล้ว",
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
