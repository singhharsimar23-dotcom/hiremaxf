export interface JobPointer {
    id?: string;
    fingerprint: string;
    company_id: string | null;
    role_category: string;
    seniority_band: string;
    location_type: string;
    source_url: string;
    source_type: string;
    confidence_tier: 'high' | 'medium' | 'low';
    quality_score: number;
    discovery_method: string;
    validation_status?: string;
    last_verified_at?: string;
    expires_at?: string;
}

export interface DiscoveryEvent {
    id?: string;
    company_id: string | null;
    governor_mode: string;
    attempted: boolean;
    success: boolean;
    pointers_created: number;
    failure_reason?: string | null;
    discovery_day: string;
    latency_ms: number;
    timestamp?: string;
}

export interface IntegrityEvent {
    id?: string;
    event_type: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    message: string;
    payload?: any;
    timestamp?: string;
}

export interface GovernorState {
    id: string;
    current_mode: 'FULL' | 'CONTROLLED' | 'SAFE' | 'READ_ONLY';
    scrape_success_rate: number;
    temporal_accuracy: number;
    state_accuracy: number;
    last_updated_at: string;
}
