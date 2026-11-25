"use client";

import { useEffect, useState, useMemo } from "react";

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  is_primary_key: boolean;
}

interface ApiResponse {
  success: boolean;
  tableName?: string;
  columns?: ColumnInfo[];
  primaryKey?: string | null;
  rows?: Record<string, any>[];
  total?: number;
  availableTables?: string[];
  tableNotFound?: boolean;
  message?: string;
  error?: string;
  code?: string;
}

// Friendly labels for common student columns
const COLUMN_LABELS: Record<string, string> = {
  sid: "รหัสนักศึกษา (sid)",
  sname: "ชื่อ-นามสกุล (sname)",
  phon: "เบอร์โทรศัพท์ (phon)",
};

export default function CrudPage() {
  const [currentTable, setCurrentTable] = useState<string>("student");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);

  // Form states
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedRow, setSelectedRow] = useState<Record<string, any> | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showNotification = (type: "success" | "error", text: string) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch data
  const fetchData = async (table: string = currentTable) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/postgres?table=${encodeURIComponent(table)}`);
      const result: ApiResponse = await res.json();
      setData(result);
    } catch (err: any) {
      setData({
        success: false,
        error: err.message || "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentTable);
  }, [currentTable]);

  // Filter rows by search keyword
  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (!search.trim()) return data.rows;
    const lower = search.toLowerCase();
    return data.rows.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      )
    );
  }, [data?.rows, search]);

  // Open Create Modal
  const handleOpenCreate = () => {
    const initial: Record<string, any> = {};
    data?.columns?.forEach((col) => {
      initial[col.column_name] = "";
    });
    setFormData(initial);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (row: Record<string, any>) => {
    setSelectedRow(row);
    const initial: Record<string, any> = {};
    data?.columns?.forEach((col) => {
      initial[col.column_name] = row[col.column_name] ?? "";
    });
    setFormData(initial);
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (row: Record<string, any>) => {
    setSelectedRow(row);
    setIsDeleteModalOpen(true);
  };

  // Submit Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/postgres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: currentTable, data: formData }),
      });
      const result = await res.json();
      if (result.success) {
        showNotification("success", "เพิ่มข้อมูลสำเร็จ!");
        setIsCreateModalOpen(false);
        fetchData(currentTable);
      } else {
        showNotification("error", result.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (err: any) {
      showNotification("error", err.message || "การเชื่อมต่อล้มเหลว");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRow || !data?.primaryKey) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/postgres", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: currentTable,
          primaryKey: data.primaryKey,
          id: selectedRow[data.primaryKey],
          data: formData,
        }),
      });
      const result = await res.json();
      if (result.success) {
        showNotification("success", "อัปเดตข้อมูลสำเร็จ!");
        setIsEditModalOpen(false);
        fetchData(currentTable);
      } else {
        showNotification("error", result.error || "เกิดข้อผิดพลาดในการแก้ไข");
      }
    } catch (err: any) {
      showNotification("error", err.message || "การเชื่อมต่อล้มเหลว");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Delete
  const handleDeleteSubmit = async () => {
    if (!selectedRow || !data?.primaryKey) return;
    setSubmitting(true);
    try {
      const id = selectedRow[data.primaryKey];
      const res = await fetch(
        `/api/postgres?table=${encodeURIComponent(currentTable)}&key=${encodeURIComponent(
          data.primaryKey
        )}&id=${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      const result = await res.json();
      if (result.success) {
        showNotification("success", "ลบข้อมูลสำเร็จ!");
        setIsDeleteModalOpen(false);
        fetchData(currentTable);
      } else {
        showNotification("error", result.error || "เกิดข้อผิดพลาดในการลบ");
      }
    } catch (err: any) {
      showNotification("error", err.message || "การเชื่อมต่อล้มเหลว");
    } finally {
      setSubmitting(false);
    }
  };

  // Render Form Input
  const renderInput = (col: ColumnInfo, isEdit: boolean = false) => {
    const isPk = col.is_primary_key;
    const isAutoIncrement = col.column_default?.includes("nextval") || col.data_type.includes("serial");
    const disabled = isPk && (isEdit || isAutoIncrement);

    if (disabled && !isEdit && isAutoIncrement) {
      return (
        <span className="text-xs text-zinc-400 italic">
          (ระบบสร้างให้อัตโนมัติ - Auto Increment)
        </span>
      );
    }

    const placeholder =
      col.column_name === "sid"
        ? "เช่น 6501001"
        : col.column_name === "sname"
        ? "เช่น สมชาย ใจดี"
        : col.column_name === "phon"
        ? "เช่น 0812345678"
        : `กรอก ${col.column_name}`;

    const inputType =
      col.data_type.includes("int") || col.data_type.includes("numeric")
        ? "number"
        : "text";

    return (
      <input
        type={inputType}
        required={col.is_nullable === "NO" && !disabled}
        disabled={disabled}
        value={formData[col.column_name] ?? ""}
        onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-700 text-sm ${
          disabled ? "bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed text-zinc-500" : ""
        }`}
      />
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-8">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm transition-all ${
            notification.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200"
              : "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200"
          }`}
        >
          <span>{notification.type === "success" ? "✓" : "✕"}</span>
          <span>{notification.text}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold tracking-tight">ระบบจัดการข้อมูลนักศึกษา (Student CRUD)</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium">
                  node-postgres
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Database: <span className="font-semibold text-zinc-800 dark:text-zinc-200">rytc</span> | Table:{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400">{currentTable}</span>
                {data?.primaryKey && (
                  <span className="ml-3 text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-400 font-mono">
                    Primary Key: {data.primaryKey}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {data?.availableTables && data.availableTables.length > 1 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">ตาราง:</span>
                  <select
                    value={currentTable}
                    onChange={(e) => setCurrentTable(e.target.value)}
                    className="border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {data.availableTables.map((tbl) => (
                      <option key={tbl} value={tbl}>
                        {tbl}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => fetchData(currentTable)}
                disabled={loading}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                <span className={loading ? "animate-spin" : ""}>🔄</span>
                <span>รีเฟรช</span>
              </button>

              <button
                onClick={handleOpenCreate}
                disabled={!data?.success}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                <span>เพิ่มข้อมูลนักศึกษา</span>
              </button>
            </div>
          </div>
        </div>

        {/* Connection Error Card */}
        {data && !data.success && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-6 text-rose-800 dark:text-rose-200 space-y-3">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span>⚠️</span>
              <span>ไม่สามารถเชื่อมต่อกับ PostgreSQL ฐานข้อมูล rytc ได้</span>
            </div>
            <p className="text-sm font-mono bg-rose-100/70 dark:bg-rose-900/60 p-3 rounded-lg overflow-x-auto">
              {data.error}
            </p>
            <div className="text-sm space-y-1">
              <p className="font-semibold">💡 วิธีแก้ไขการเชื่อมต่อ:</p>
              <ul className="list-disc list-inside space-y-1 text-rose-700 dark:text-rose-300">
                <li>
                  เปิดไฟล์ <code className="bg-rose-200/50 dark:bg-rose-900/50 px-1 py-0.5 rounded">.env.local</code>{" "}
                  ในโปรเจกต์ และใส่รหัสผ่านที่คุณใช้ล็อกอิน phpPgAdmin ที่บรรทัด <code className="font-mono">PGPASSWORD=รหัสผ่าน</code>
                </li>
                <li>
                  ตรวจสอบว่าระบุ <code className="font-mono">DATABASE_URL=postgresql://rytc:รหัสผ่าน@localhost:5432/rytc</code>
                </li>
              </ul>
            </div>
            <button
              onClick={() => fetchData(currentTable)}
              className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              ลองเชื่อมต่อใหม่อีกครั้ง
            </button>
          </div>
        )}

        {/* Main Table Card */}
        {data?.success && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            {/* Search and Summary Bar */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <span className="absolute left-3 top-2.5 text-zinc-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="ค้นหารหัส, ชื่อ หรือเบอร์โทร..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-xs text-zinc-500 flex items-center gap-4">
                <span>
                  แสดง <strong className="text-zinc-800 dark:text-zinc-200">{filteredRows.length}</strong> จากทั้งหมด{" "}
                  <strong className="text-zinc-800 dark:text-zinc-200">{data.total ?? data.rows?.length ?? 0}</strong> คน
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                    {data.columns?.map((col) => (
                      <th key={col.column_name} className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{COLUMN_LABELS[col.column_name] || col.column_name}</span>
                          {col.is_primary_key && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-bold">
                              PK
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400 lowercase font-normal">({col.data_type})</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-right whitespace-nowrap">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={(data.columns?.length || 0) + 1}
                        className="px-6 py-12 text-center text-zinc-500"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className="animate-spin">🔄</span>
                          <span>กำลังดึงข้อมูลจากตาราง student...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={(data.columns?.length || 0) + 1}
                        className="px-6 py-12 text-center text-zinc-500"
                      >
                        <p className="text-base font-medium">ยังไม่มีข้อมูลในตาราง student</p>
                        <p className="text-xs text-zinc-400 mt-1">คลิกปุ่ม &quot;+ เพิ่มข้อมูลนักศึกษา&quot; เพื่อบันทึกข้อมูลแรก</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <tr
                        key={data.primaryKey ? row[data.primaryKey] : idx}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        {data.columns?.map((col) => {
                          const val = row[col.column_name];
                          return (
                            <td
                              key={col.column_name}
                              className={`px-6 py-4 ${
                                col.is_primary_key
                                  ? "font-mono font-bold text-blue-600 dark:text-blue-400"
                                  : "text-zinc-800 dark:text-zinc-200"
                              }`}
                            >
                              {val ?? "-"}
                            </td>
                          );
                        })}

                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                            >
                              ✏️ แก้ไข
                            </button>
                            <button
                              onClick={() => handleOpenDelete(row)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 transition-colors"
                            >
                              🗑️ ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 1. Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-bold">➕ เพิ่มข้อมูลนักศึกษาใหม่</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {data?.columns?.map((col) => (
                <div key={col.column_name} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {COLUMN_LABELS[col.column_name] || col.column_name}{" "}
                    <span className="text-zinc-400 font-normal">({col.data_type})</span>
                    {col.is_nullable === "NO" && <span className="text-rose-500 ml-1">*</span>}
                  </label>
                  {renderInput(col, false)}
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Modal */}
      {isEditModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-bold">
                ✏️ แก้ไขข้อมูลนักศึกษา (รหัส: {data?.primaryKey ? selectedRow[data.primaryKey] : ""})
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {data?.columns?.map((col) => (
                <div key={col.column_name} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {COLUMN_LABELS[col.column_name] || col.column_name}{" "}
                    <span className="text-zinc-400 font-normal">({col.data_type})</span>
                    {col.is_primary_key && (
                      <span className="ml-2 text-xs text-blue-500 font-normal">(Primary Key ไม่สามารถเปลี่ยนได้)</span>
                    )}
                  </label>
                  {renderInput(col, true)}
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? "กำลังอัปเดต..." : "อัปเดตข้อมูล"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">ยืนยันการลบข้อมูล</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักศึกษารหัส{" "}
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono">
                {data?.primaryKey ? selectedRow[data.primaryKey] : ""}
              </strong>{" "}
              ({selectedRow.sname}) ออกจากระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={submitting}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {submitting ? "กำลังลบ..." : "ลบข้อมูลทันที"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
