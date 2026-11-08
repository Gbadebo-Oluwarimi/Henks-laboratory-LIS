import type { ObjectId } from "mongodb";
import type { ResultKind } from "@/lib/catalogue";

export type UserRole = "Administrator" | "Reception" | "Laboratory Staff";

export type UserPermission =
  | "clients:view"
  | "clients:create"
  | "clients:edit"
  | "orders:view"
  | "orders:create"
  | "results:edit"
  | "results:submit"
  | "results:review"
  | "reports:view"
  | "reports:authorize"
  | "catalogue:manage"
  | "users:manage"
  | "reagents:view"
  | "reagents:manage"
  | "reagents:receive"
  | "reagents:verify"
  | "reagents:approve"
  | "reagents:use"
  | "reagents:adjust"
  | "reagents:dispose";

export type UserRecord = {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  /** Marks the one-time first-administrator account. */
  bootstrapAdmin?: boolean;
  /** Explicit approval permission; Administrators always have this capability. */
  canAuthorizeReports?: boolean;
  permissions?: UserPermission[];
};

export type ChatMessageRecord = {
  _id: ObjectId;
  senderId: ObjectId;
  senderName: string;
  body: string;
  mentions: Array<{ userId: ObjectId; name: string }>;
  createdAt: Date;
};

export type ClientRecord = {
  _id: ObjectId;
  patientId: string;
  fullName: string;
  dateOfBirth?: string;
  sex?: "Female" | "Male" | "Other";
  phone?: string;
  email?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderedTest = {
  code: string;
  panel: string;
  subcategory?: string;
  name: string;
  kind: ResultKind;
  unit: string;
  sourceReference: string;
  referenceApproved: boolean;
  specimenType?: string;
  departmentCode?: string;
  departmentName?: string;
  status: "Pending" | "In Progress" | "Awaiting Review" | "Completed";
  result: string;
  /** Numeric representation for numeric tests; `result` remains the display string for legacy reports. */
  resultValue?: number;
  updatedAt?: Date;
  updatedBy?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  /** Number of reagent usage ledger entries linked to this order test. */
  reagentUsageCount?: number;
};

export type LabOrder = {
  _id: ObjectId;
  accessionId: string;
  clientId: ObjectId;
  clientSnapshot: Pick<ClientRecord, "patientId" | "fullName" | "dateOfBirth" | "sex" | "phone" | "email" | "address">;
  reportDetails?: LabReportDetails;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: OrderedTest["status"];
  tests: OrderedTest[];
  /** Prices captured for each ordered panel; absent on orders created before pricing was configured. */
  priceSnapshots?: OrderedPanelPriceSnapshot[];
  specimenIds?: ObjectId[];
  reportVersions?: ReleasedReportVersion[];
  pendingAmendment?: { reason: string; startedAt: Date; startedBy: string };
  /** Number of reagent usage ledger entries referencing this order. */
  reagentUsageCount?: number;

  /** Final report authorization metadata. Set by an Administrator or explicitly approved user. */
  authorizedBy?: string;
  authorizedByName?: string;
  authorizedByEmail?: string;
  authorizedByRole?: UserRole;
  authorizedAt?: Date;
};

export type LabReportDetails = {
  surname: string;
  otherNames: string;
  laboratoryNo: string;
  hospitalNo: string;
  age: string;
  ageUnit: "days" | "months" | "years";
  sex: "Female" | "Male" | "Other" | "";
  date: string;
  requestedTest: string;
  specimen: string;
  generalComment: string;
  filmReport: string;
  filmRBCs: string;
  filmWBCs: string;
  filmPlatelets: string;
  filmMalaria: string;
};

export type ReleasedReportVersion = {
  version: number;
  accessionId: string;
  releasedAt: Date;
  releasedBy: string;
  releasedByName: string;
  releasedByRole?: UserRole;
  patientSnapshot: LabOrder["clientSnapshot"];
  reportDetails?: LabReportDetails;
  tests: OrderedTest[];
  amendmentReason?: string;
};

export type OrderedPanelPriceSnapshot = {
  panel: string;
  amountMinor?: number;
  currency: "NGN";
  priceRecordId?: ObjectId;
  capturedAt: Date;
};

export type CataloguePriceRecord = {
  _id: ObjectId;
  panel: string;
  amountMinor: number;
  currency: "NGN";
  effectiveFrom: Date;
  reason: string;
  createdBy: ObjectId;
  createdAt: Date;
};

export type SpecimenStatus = "ORDERED" | "COLLECTED" | "RECEIVED" | "ACCEPTED" | "IN_PROCESS" | "COMPLETED" | "REJECTED" | "RECOLLECTION_REQUIRED" | "CANCELLED";

export type SpecimenEvent = {
  action: SpecimenStatus;
  fromStatus?: SpecimenStatus;
  toStatus: SpecimenStatus;
  actorId: ObjectId;
  occurredAt: Date;
  reason?: string;
  notes?: string;
};

export type SpecimenRecord = {
  _id: ObjectId;
  specimenId: string;
  patientId: ObjectId;
  patientName: string;
  patientNumber: string;
  orderId: ObjectId;
  parentSpecimenId?: ObjectId;
  accessionId: string;
  testCodes: string[];
  departmentCodes?: string[];
  departmentNames?: string[];
  specimenType: string;
  status: SpecimenStatus;
  collectedAt?: Date;
  collectedBy?: ObjectId;
  receivedAt?: Date;
  receivedBy?: ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  events: SpecimenEvent[];
};

export type QualityControlConfigRecord = {
  _id: ObjectId;
  testCode: string;
  testName: string;
  controlName: string;
  controlLevel: string;
  lotNumber: string;
  expiresAt: Date;
  unit: string;
  minimumAccepted: number;
  maximumAccepted: number;
  instrument?: string;
  method?: string;
  requiresPassedQc: boolean;
  active: boolean;
  createdAt: Date;
  createdBy: ObjectId;
  updatedAt: Date;
};

export type QualityControlRunRecord = {
  _id: ObjectId;
  configId: ObjectId;
  testCode: string;
  testName: string;
  controlName: string;
  controlLevel: string;
  lotNumber: string;
  observedValue: number;
  unit: string;
  minimumAccepted: number;
  maximumAccepted: number;
  expiresAt: Date;
  instrument?: string;
  method?: string;
  status: "PASS" | "FAIL" | "INVALID";
  runAt: Date;
  operatorId: ObjectId;
  comments?: string;
  events: Array<{ action: "RUN_RECORDED" | "CORRECTIVE_ACTION"; actorId: ObjectId; occurredAt: Date; notes?: string }>;
};

export type ReagentCategory = "Chemistry" | "Haematology" | "Microbiology" | "Immunology" | "Serology" | "Coagulation" | "Molecular Biology" | "Other";
export type ReagentLotStatus = "QUARANTINED" | "PENDING_VERIFICATION" | "APPROVED" | "REJECTED" | "IN_USE" | "EXHAUSTED" | "EXPIRED" | "DISPOSED";
export type ReagentStorageType = "LABORATORY" | "DEPARTMENT" | "STORE" | "ROOM" | "REFRIGERATOR" | "FREEZER" | "SHELF" | "BIN";
export type ReagentMovementType = "RECEIPT" | "CONSUMPTION" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "TRANSFER" | "EXPIRED" | "DISPOSAL" | "RETURN";

export type DepartmentRecord = {
  _id: ObjectId;
  code: string;
  name: string;
  departmentKind?: "PERFORMING" | "ORDER_GROUP";
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type ReagentRecord = {
  _id: ObjectId;
  code: string;
  name: string;
  description?: string;
  category: ReagentCategory;
  departmentId: ObjectId;
  manufacturer?: string;
  catalogueNumber?: string;
  unitOfIssue: string;
  defaultStorageCondition?: string;
  minimumStock?: number;
  maximumStock?: number;
  reorderLevel: number;
  inUseStabilityDays?: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
};

export type ReagentStorageLocationRecord = {
  _id: ObjectId;
  code: string;
  name: string;
  type: ReagentStorageType;
  parentId?: ObjectId;
  departmentId?: ObjectId;
  temperatureRange?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

export type ReagentLotRecord = {
  _id: ObjectId;
  reagentId: ObjectId;
  lotNumber: string;
  batchNumber?: string;
  manufacturer?: string;
  catalogueNumber?: string;
  supplier?: string;
  quantityReceived: number;
  currentQuantity: number;
  unit: string;
  dateReceived: Date;
  expiryDate: Date;
  openedAt?: Date;
  openedBy?: string;
  inUseExpiryDate?: Date;
  storageLocationId: ObjectId;
  status: ReagentLotStatus;
  receivedBy: string;
  conditionOnReceipt?: string;
  remarks?: string;
  verifiedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectedAt?: Date;
  verificationDate?: Date;
  approvalDate?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ReagentVerificationRecord = {
  _id: ObjectId;
  reagentId: ObjectId;
  lotId: ObjectId;
  verificationMethod: string;
  verificationNotes?: string;
  result: string;
  performedBy: string;
  performedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  decision?: "APPROVED" | "REJECTED";
  rejectionReason?: string;
};

export type ReagentStockMovementRecord = {
  _id: ObjectId;
  reagentId: ObjectId;
  lotId: ObjectId;
  type: ReagentMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unit: string;
  reason: string;
  referenceType?: "labOrderTest" | "manual";
  referenceId?: string;
  testCode?: string;
  fromLocationId?: ObjectId;
  toLocationId?: ObjectId;
  performedBy: string;
  performedAt: Date;
};

export type TestReagentRequirementRecord = {
  _id: ObjectId;
  testCode: string;
  reagentId: ObjectId;
  role: "REAGENT" | "CALIBRATOR" | "CONTROL" | "OTHER";
  quantityPerTest?: number;
  unit?: string;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};
