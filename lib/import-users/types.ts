export type StaffImportRow = {
  rowNumber: number;
  staffCode: string;
  fullName: string;
  homeWard: string;
  role?: string;
  position?: string;
  payPosition?: string;
  otRate: number;
  shiftPayRate: number;
  isHead: boolean;
  isTrainee: boolean;
  allowedWards: string[];
};

export type ImportRowError = {
  rowNumber: number;
  staffCode?: string;
  message: string;
};

export type ParsedStaffImport = {
  rows: StaffImportRow[];
  errors: ImportRowError[];
  totalRows: number;
};

export type ImportStaffUsersOptions = {
  resetPassword?: boolean;
};

export type ImportStaffUsersSummary = {
  totalRows: number;
  successCount: number;
  failedCount: number;
  createdUsers: number;
  updatedUsers: number;
  createdStaff: number;
  updatedStaff: number;
  createdWards: number;
  errors: ImportRowError[];
};
