export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      conversations: {
        Row: { id: string; user_id: string; title: string; created_at: string; updated_at: string };
        Insert: { id?: string; user_id: string; title?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; user_id?: string; title?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      messages: {
        Row: { id: string; conversation_id: string; user_id: string; role: string; content: string; citations: Json; created_at: string };
        Insert: { id?: string; conversation_id: string; user_id: string; role: string; content: string; citations?: Json; created_at?: string };
        Update: { id?: string; conversation_id?: string; user_id?: string; role?: string; content?: string; citations?: Json; created_at?: string };
        Relationships: [{
          foreignKeyName: "messages_conversation_id_fkey";
          columns: ["conversation_id"];
          isOneToOne: false;
          referencedRelation: "conversations";
          referencedColumns: ["id"];
        }];
      };
      documents: {
        Row: { id: string; source_path: string; title: string; chunk_index: number; content: string; embedding: string; metadata: Json; created_at: string };
        Insert: { id?: string; source_path: string; title: string; chunk_index: number; content: string; embedding: string; metadata?: Json; created_at?: string };
        Update: { id?: string; source_path?: string; title?: string; chunk_index?: number; content?: string; embedding?: string; metadata?: Json; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      match_documents: {
        Args: { query_embedding: string; match_threshold?: number; match_count?: number };
        Returns: { id: string; source_path: string; title: string; chunk_index: number; content: string; similarity: number }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
