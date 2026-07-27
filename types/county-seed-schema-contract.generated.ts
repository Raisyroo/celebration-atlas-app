/*
 * Generated from the linked Celebration Atlas Supabase public schema on 2026-07-27.
 * Command: supabase gen types typescript --linked --schema public
 * Full generated output SHA-256: 4b3d1db2cd33c4169f50c7b285ed51bed4f92e7c6769db2b98599824dbb1408e
 * Narrow excerpt: county-seed intake tables, direct supporting table, and RPCs only.
 * Do not hand-edit. Regenerate and review against the deployed schema contract.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CountySeedSchemaContract = {
  public: {
    Tables: {
      atlas_operation_runs: {
        Row: {
          actor_identity: string
          actor_type: string
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          idempotency_key: string
          operation_type: string
          request: Json
          started_at: string | null
          status: string
          summary: Json
          updated_at: string
        }
        Insert: {
          actor_identity: string
          actor_type: string
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          idempotency_key: string
          operation_type: string
          request?: Json
          started_at?: string | null
          status?: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          actor_identity?: string
          actor_type?: string
          completed_at?: string | null
          created_at?: string
          error?: Json | null
          id?: string
          idempotency_key?: string
          operation_type?: string
          request?: Json
          started_at?: string | null
          status?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: []
      }
      atlas_operation_actions: {
        Row: {
          action_type: string
          after_snapshot: Json | null
          applied_at: string | null
          applied_payload: Json | null
          before_snapshot: Json | null
          created_at: string
          failure: Json | null
          id: string
          lifecycle_state: string
          operation_run_id: string
          reason: string | null
          requested_payload: Json
          source_references: Json
          target_entity_id: string | null
          target_entity_type: string | null
          updated_at: string
          warnings: Json
        }
        Insert: {
          action_type: string
          after_snapshot?: Json | null
          applied_at?: string | null
          applied_payload?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          failure?: Json | null
          id?: string
          lifecycle_state?: string
          operation_run_id: string
          reason?: string | null
          requested_payload?: Json
          source_references?: Json
          target_entity_id?: string | null
          target_entity_type?: string | null
          updated_at?: string
          warnings?: Json
        }
        Update: {
          action_type?: string
          after_snapshot?: Json | null
          applied_at?: string | null
          applied_payload?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          failure?: Json | null
          id?: string
          lifecycle_state?: string
          operation_run_id?: string
          reason?: string | null
          requested_payload?: Json
          source_references?: Json
          target_entity_id?: string | null
          target_entity_type?: string | null
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "atlas_operation_actions_operation_run_id_fkey"
            columns: ["operation_run_id"]
            isOneToOne: false
            referencedRelation: "atlas_operation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_runs: {
        Row: {
          actual_cost: number | null
          approval_required: boolean
          approval_status: string
          candidates_created: number
          completed_at: string | null
          created_at: string
          duplicates_flagged: number
          error_message: string | null
          estimated_cost: number | null
          id: string
          items_found: number
          notes: string | null
          run_metadata: Json
          run_type: string
          source_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          actual_cost?: number | null
          approval_required?: boolean
          approval_status?: string
          candidates_created?: number
          completed_at?: string | null
          created_at?: string
          duplicates_flagged?: number
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          items_found?: number
          notes?: string | null
          run_metadata?: Json
          run_type: string
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          actual_cost?: number | null
          approval_required?: boolean
          approval_status?: string
          candidates_created?: number
          completed_at?: string | null
          created_at?: string
          duplicates_flagged?: number
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          items_found?: number
          notes?: string | null
          run_metadata?: Json
          run_type?: string
          source_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "discovery_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_sources: {
        Row: {
          city: string | null
          county: string | null
          created_at: string
          id: string
          is_active: boolean
          last_checked_at: string | null
          name: string
          notes: string | null
          priority: string
          region: string | null
          source_type: string
          source_url: string
          state: string
          trust_score: number
          updated_at: string
        }
        Insert: {
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name: string
          notes?: string | null
          priority?: string
          region?: string | null
          source_type: string
          source_url: string
          state?: string
          trust_score?: number
          updated_at?: string
        }
        Update: {
          city?: string | null
          county?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_checked_at?: string | null
          name?: string
          notes?: string | null
          priority?: string
          region?: string | null
          source_type?: string
          source_url?: string
          state?: string
          trust_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      event_candidates: {
        Row: {
          candidate_name: string
          category: string | null
          city: string | null
          country: string
          county: string | null
          created_at: string
          description: string | null
          discovery_confidence: number
          discovery_run_id: string
          duplicate_status: string
          end_date: string | null
          event_type: string
          id: string
          matched_event_id: string | null
          needs_review: boolean
          normalized_name: string | null
          official_website_candidate: string | null
          probable_recurrence: string | null
          raw_payload: Json
          semantic_notes: string | null
          slug_candidate: string | null
          social_links: Json
          source_urls: Json
          start_date: string | null
          state: string
          subcategory: string | null
          typical_month: string | null
          typical_season: string | null
          updated_at: string
          venue_name: string | null
          verification_status: string
        }
        Insert: {
          candidate_name: string
          category?: string | null
          city?: string | null
          country?: string
          county?: string | null
          created_at?: string
          description?: string | null
          discovery_confidence?: number
          discovery_run_id: string
          duplicate_status?: string
          end_date?: string | null
          event_type?: string
          id?: string
          matched_event_id?: string | null
          needs_review?: boolean
          normalized_name?: string | null
          official_website_candidate?: string | null
          probable_recurrence?: string | null
          raw_payload?: Json
          semantic_notes?: string | null
          slug_candidate?: string | null
          social_links?: Json
          source_urls?: Json
          start_date?: string | null
          state?: string
          subcategory?: string | null
          typical_month?: string | null
          typical_season?: string | null
          updated_at?: string
          venue_name?: string | null
          verification_status?: string
        }
        Update: {
          candidate_name?: string
          category?: string | null
          city?: string | null
          country?: string
          county?: string | null
          created_at?: string
          description?: string | null
          discovery_confidence?: number
          discovery_run_id?: string
          duplicate_status?: string
          end_date?: string | null
          event_type?: string
          id?: string
          matched_event_id?: string | null
          needs_review?: boolean
          normalized_name?: string | null
          official_website_candidate?: string | null
          probable_recurrence?: string | null
          raw_payload?: Json
          semantic_notes?: string | null
          slug_candidate?: string | null
          social_links?: Json
          source_urls?: Json
          start_date?: string | null
          state?: string
          subcategory?: string | null
          typical_month?: string | null
          typical_season?: string | null
          updated_at?: string
          venue_name?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_candidates_discovery_run_id_fkey"
            columns: ["discovery_run_id"]
            isOneToOne: false
            referencedRelation: "discovery_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_candidates_matched_event_id_fkey"
            columns: ["matched_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_candidate_sources: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          last_accessed: string | null
          source_excerpt: string | null
          source_name: string | null
          source_type: string | null
          source_url: string
          trust_score: number | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          last_accessed?: string | null
          source_excerpt?: string | null
          source_name?: string | null
          source_type?: string | null
          source_url: string
          trust_score?: number | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          last_accessed?: string | null
          source_excerpt?: string | null
          source_name?: string | null
          source_type?: string | null
          source_url?: string
          trust_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_candidate_sources_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "event_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string | null
          city: string | null
          confidence_score: number | null
          country: string
          county: string | null
          created_at: string
          event_type: string
          facebook_url: string | null
          first_discovered_at: string | null
          geocoded_at: string | null
          id: string
          instagram_url: string | null
          last_verified_at: string | null
          latitude: number | null
          location_confidence: number | null
          location_source: string | null
          location_verified: boolean
          long_description: string | null
          longitude: number | null
          name: string
          official_website: string | null
          recurrence_pattern: string | null
          short_description: string | null
          slug: string
          state: string
          status: string
          subcategory: string | null
          typical_month: string | null
          typical_season: string | null
          updated_at: string
          venue_name: string | null
          verification_status: string
        }
        Insert: {
          category?: string | null
          city?: string | null
          confidence_score?: number | null
          country?: string
          county?: string | null
          created_at?: string
          event_type: string
          facebook_url?: string | null
          first_discovered_at?: string | null
          geocoded_at?: string | null
          id?: string
          instagram_url?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          location_confidence?: number | null
          location_source?: string | null
          location_verified?: boolean
          long_description?: string | null
          longitude?: number | null
          name: string
          official_website?: string | null
          recurrence_pattern?: string | null
          short_description?: string | null
          slug: string
          state?: string
          status?: string
          subcategory?: string | null
          typical_month?: string | null
          typical_season?: string | null
          updated_at?: string
          venue_name?: string | null
          verification_status?: string
        }
        Update: {
          category?: string | null
          city?: string | null
          confidence_score?: number | null
          country?: string
          county?: string | null
          created_at?: string
          event_type?: string
          facebook_url?: string | null
          first_discovered_at?: string | null
          geocoded_at?: string | null
          id?: string
          instagram_url?: string | null
          last_verified_at?: string | null
          latitude?: number | null
          location_confidence?: number | null
          location_source?: string | null
          location_verified?: boolean
          long_description?: string | null
          longitude?: number | null
          name?: string
          official_website?: string | null
          recurrence_pattern?: string | null
          short_description?: string | null
          slug?: string
          state?: string
          status?: string
          subcategory?: string | null
          typical_month?: string | null
          typical_season?: string | null
          updated_at?: string
          venue_name?: string | null
          verification_status?: string
        }
        Relationships: []
      }
    }
    Functions: {
      atlas_assert_service_role: { Args: never; Returns: undefined }
      atlas_intake_event_candidate: {
        Args: {
          p_actor_identity: string
          p_actor_type: string
          p_candidate: Json
          p_idempotency_key: string
          p_sources: Json
        }
        Returns: Json
      }
      atlas_require_source_evidence: {
        Args: { p_sources: Json }
        Returns: undefined
      }
      atlas_start_operation: {
        Args: {
          p_actor_identity: string
          p_actor_type: string
          p_idempotency_key: string
          p_operation_type: string
          p_request?: Json
        }
        Returns: {
          actor_identity: string
          actor_type: string
          completed_at: string | null
          created_at: string
          error: Json | null
          id: string
          idempotency_key: string
          operation_type: string
          request: Json
          started_at: string | null
          status: string
          summary: Json
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "atlas_operation_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
