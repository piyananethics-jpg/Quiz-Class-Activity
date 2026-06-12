import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, HelpCircle, XCircle } from "lucide-react";

interface CSVRecord {
  no: number;
  studentId: string;
  fullName: string;
  email: string;
}

interface StudentCSVImporterProps {
  courseId: string;
  sectionId: string;
  onImportCompleted: (importedCount: number, records: CSVRecord[]) => void;
  onCancel: () => void;
}

export function StudentCSVImporter({ courseId, sectionId, onImportCompleted, onCancel }: StudentCSVImporterProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<CSVRecord[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "parsed" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV Line securely without breaking simple comma splits inside quotes
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        result.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    result.push(entry.trim());
    return result;
  };

  const handleFileProcess = (rawText: string) => {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim() !== "");
    if (lines.length < 2) {
      setValidationErrors(["CSV file is empty or missing data rows."]);
      setStatus("error");
      return;
    }

    // Header validation (no, studentId, fullName, email)
    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const required = ["no", "studentid", "fullname", "email"];
    
    // Check if headers match closely
    const isHeaderValid = required.every(field => headers.includes(field));
    if (!isHeaderValid) {
      setValidationErrors([
        `Invalid CSV header structure. Found columns: [${parseCSVLine(lines[0]).join(", ")}]. It must exactly contain these headers: 'no', 'studentId', 'fullName', 'email'.`
      ]);
      setStatus("error");
      return;
    }

    const colIndices = {
      no: headers.indexOf("no"),
      studentId: headers.indexOf("studentid"),
      fullName: headers.indexOf("fullname"),
      email: headers.indexOf("email"),
    };

    const errors: string[] = [];
    const validRecords: CSVRecord[] = [];

    // Constraint: Limit to 300 rows max
    const dataLines = lines.slice(1);
    if (dataLines.length > 300) {
      errors.push("The sheet size exceeds limits. Maximum of 300 enrolled student rows is allowed per CSV import.");
      setValidationErrors(errors);
      setStatus("error");
      return;
    }

    dataLines.forEach((line, index) => {
      const lineNo = index + 2; // Header is line 1
      const cells = parseCSVLine(line);
      
      // Allow empty lines at the physical end of file
      if (cells.length === 1 && cells[0] === "") return;

      const noValStr = cells[colIndices.no] || "";
      const idVal = cells[colIndices.studentId] || "";
      const nameVal = cells[colIndices.fullName] || "";
      const emailVal = cells[colIndices.email] || "";

      // Validate No
      const parsedNo = parseInt(noValStr, 10);
      if (isNaN(parsedNo)) {
        errors.push(`Row ${lineNo}: 'no' column must be a numeric line counter.`);
      }

      // Validate studentId (exactly 8 digits)
      const sanitizedId = idVal.replace(/\D/g, "");
      if (!idVal || sanitizedId.length < 8 || sanitizedId.length > 10) {
        errors.push(`Row ${lineNo}: Student ID '${idVal}' must be standard 8-to-10 digits.`);
      }

      // Validate name
      if (!nameVal.trim()) {
        errors.push(`Row ${lineNo}: Missing required student 'fullName'.`);
      }

      // Validate email (Must end with @au.edu)
      if (!emailVal || !emailVal.toLowerCase().endsWith("@au.edu")) {
        errors.push(`Row ${lineNo}: Email '${emailVal || "N/A"}' must end with the school domain '@au.edu'.`);
      }

      if (errors.length === 0) {
        validRecords.push({
          no: parsedNo || index + 1,
          studentId: sanitizedId,
          fullName: nameVal.trim(),
          email: emailVal.trim().toLowerCase(),
        });
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      setParsedRecords([]);
      setStatus("error");
    } else {
      setValidationErrors([]);
      setParsedRecords(validRecords);
      setStatus("parsed");
    }
  };

  const handleFileReader = (fileToLoad: File) => {
    setFile(fileToLoad);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      handleFileProcess(text);
    };
    reader.readAsText(fileToLoad);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileReader(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileReader(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleCommit = () => {
    if (parsedRecords.length === 0) return;
    onImportCompleted(parsedRecords.length, parsedRecords);
  };

  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 text-slate-100 space-y-6">
      <div className="flex justify-between items-start border-b border-white/10 pb-4">
        <div>
          <h4 className="font-bold text-white text-base flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-400" />
            <span>CSV Batch Enrollment Importer</span>
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Register students via CSV registry list. All records are validated atomically.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-350 hover:text-white rounded-lg cursor-pointer"
        >
          Cancel Importer
        </button>
      </div>

      {status === "idle" && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-4 ${
            dragActive
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-450 text-indigo-400">
            <Upload className="h-7 w-7 animate-bounce" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Drag and drop your spreadsheet here</p>
            <p className="text-xs text-slate-400 mt-1">or click to browse local files (.csv)</p>
          </div>
          <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 font-mono">
            Requires headers: no, studentId, fullName, email (@au.edu) • Limit 300 rows
          </span>
        </div>
      )}

      {/* CSV Validation Failure State */}
      {status === "error" && (
        <div className="space-y-4">
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-300 rounded-xl flex items-start space-x-3 text-xs leading-relaxed animate-fade-in">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm text-red-200">Atomic Validation Failed (All-or-Nothing Model)</span>
              <span className="block mt-1">
                Your file contains validation errors. Registration was aborted to prevent half-joined databases. Please review the lines below:
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-4 border border-white/5 rounded-xl max-h-56 overflow-y-auto space-y-1.5 font-mono text-[11px] text-red-300 select-all">
            {validationErrors.map((err, idx) => (
              <div key={idx} className="flex items-start space-x-1.5">
                <span className="text-red-500 text-xs shrink-0">•</span>
                <span>{err}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Correct the spreadsheet and upload the corrected copy.</span>
            </span>
            <button
              onClick={() => {
                setStatus("idle");
                setFile(null);
                setValidationErrors([]);
              }}
              className="px-4 py-2 bg-indigo-505 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Upload another CSV
            </button>
          </div>
        </div>
      )}

      {/* Valid Parser State with Live Table Preview */}
      {status === "parsed" && (
        <div className="space-y-4 animate-fade-in">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span>Spreadsheet parsed cleanly! All {parsedRecords.length} records completed domain-checks.</span>
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Preview Registered Registry Entries
            </span>
            <div className="border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-slate-950/40 text-[11px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-350 font-bold">
                    <th className="py-2 px-3 text-center">No</th>
                    <th className="py-2 px-3">Student ID</th>
                    <th className="py-2 px-3">Full Name</th>
                    <th className="py-2 px-3">Email Address</th>
                    <th className="py-2 px-3 text-center">Security Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {parsedRecords.map((rec) => (
                    <tr key={rec.no} className="hover:bg-white/5">
                      <td className="py-1.5 px-3 text-center text-slate-400 font-mono">{rec.no}</td>
                      <td className="py-1.5 px-3 text-white font-mono">{rec.studentId}</td>
                      <td className="py-1.5 px-3 font-semibold text-white">{rec.fullName}</td>
                      <td className="py-1.5 px-3 text-slate-300">{rec.email}</td>
                      <td className="py-1.5 px-3 text-center text-emerald-405 text-emerald-400 font-bold uppercase text-[9px]">
                        Pass
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => {
                setStatus("idle");
                setFile(null);
                setParsedRecords([]);
              }}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Reset Importer
            </button>
            <button
              onClick={handleCommit}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              Finalize Import & Enroll ({parsedRecords.length}) Students
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
