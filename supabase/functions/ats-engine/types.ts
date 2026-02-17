export interface JobPointer {
    id?: string;
    fingerprint: string;
    company_id: string | null;
    company_name?: string;
    role_category: string;
    seniority_band: string;
    location_type: string;
    location_name?: string;
    source_url: string;
    source_type: string;
    confidence_tier: 'high' | 'medium' | 'low' | 'MEDIUM';
    quality_score: number;
    discovery_method: string;
    validation_status?: string;
    last_verified_at?: string;
    expires_at?: string;
    raw_payload?: any;
    canonical_hash?: string;
    is_direct_ats?: boolean;
    is_direct_company?: boolean;
    is_government?: boolean;
    source_origin_type?: 'ats' | 'company' | 'government';
    ingestion_origin?: string;
    redirect_depth?: number;
    canonical_verified?: boolean;
    application_endpoint?: string;
    ats_provider?: string;
    external_id?: string;
    request_id?: string;
    source_fetched_at?: string;
    source_http_status?: number;
    source_response_time_ms?: number;
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
