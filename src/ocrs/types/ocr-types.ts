export interface OcrResult {
    text: string;
    confidence: number;
}

export interface ExpenseData {
    amount: number;
    description: string;
    spentAt: Date;
    category?: string;
    confidence: number;
}

export interface OcrCompletedEvent {
    jobId: string;
    userId: string;
    expenseData: ExpenseData;
    fileUrl: string;
}

export enum OcrJobStatus {
    QUEUED = 'queued',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}
