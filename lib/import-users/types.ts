export type ImportedStaffCategory = "RN" | "PN" | "NA" | "OTHER";

export type StaffImportRow = {
  rowNumber: number;
  staffCode: string;
  generatedStaffCode: boolean;
  fullName: string;
  homeWard: string;
  position: string;
  payPosition: string;
  staffCategory: ImportedStaffCategory;
  otRate: number;
  shiftPayRate: number;
  isHead: boolean;
  isNewNurse: boolean;
  canBeInCharge: boolean;
};

export type ImportRowIssue = {
  rowNumber: number;
  staffCode?: string;
  message: string;
};

export type ParsedStaffImport = {
  sheetName: string;
  rows: StaffImportRow[];
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  totalRows: number;
};

export type PersonnelImportPreview = {
  fileName: string;
  sheetName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  generatedCodeCount: number;
  wardCount: number;
  headCount: number;
  newNurseCount: number;
  inChargeCount: number;
  categoryCounts: Record<ImportedStaffCategory, number>;
  wardCounts: Array<{ ward: string; count: number }>;
  sampleRows: StaffImportRow[];
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
};

export type ImportStaffUsersOptions = {
  resetPassword?: boolean;
};

export type ImportStaffUsersSummary = {
  totalRows: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  createdUsers: number;
  updatedUsers: number;
  createdStaff: number;
  updatedStaff: number;
  createdWards: number;
  errors: ImportRowIssue[];
  skipped: ImportRowIssue[];
};
