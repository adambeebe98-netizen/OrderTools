
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_events": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"id": number,"kind": string,"request_id": string | null,"summary": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"kind": string,"request_id"?: string | null,"summary": string,"team_id": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"id"?: never,"kind"?: string,"request_id"?: string | null,"summary"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_events_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_events_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"catalog_items": {
                  Row: {
                    "archived_at": string | null,"category_id": string | null,"created_at": string,"description": string | null,"grainger_sku": string | null,"grainger_url": string | null,"id": string,"image_url": string | null,"name": string,"sort_order": number,"team_id": string,"unit": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"category_id"?: string | null,"created_at"?: string,"description"?: string | null,"grainger_sku"?: string | null,"grainger_url"?: string | null,"id"?: string,"image_url"?: string | null,"name": string,"sort_order"?: number,"team_id": string,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"category_id"?: string | null,"created_at"?: string,"description"?: string | null,"grainger_sku"?: string | null,"grainger_url"?: string | null,"id"?: string,"image_url"?: string | null,"name"?: string,"sort_order"?: number,"team_id"?: string,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "catalog_items_category_id_team_id_fkey"
      columns: ["category_id","team_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "catalog_items_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name": string,"sort_order": number,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"sort_order"?: number,"team_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"order_batches": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"reference": string | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"reference"?: string | null,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"reference"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_batches_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_batches_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string | null,"id": string,"is_super_admin": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string | null,"id": string,"is_super_admin"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string,"is_super_admin"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limits": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"request_items": {
                  Row: {
                    "catalog_item_id": string | null,"created_at": string,"custom_note": string | null,"custom_url": string | null,"grainger_sku": string | null,"grainger_url": string | null,"id": string,"is_custom": boolean,"name": string,"order_batch_id": string | null,"ordered_at": string | null,"ordered_by": string | null,"quantity": number,"removed_at": string | null,"removed_by": string | null,"request_id": string,"status": string,"team_id": string,"unit": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "catalog_item_id"?: string | null,"created_at"?: string,"custom_note"?: string | null,"custom_url"?: string | null,"grainger_sku"?: string | null,"grainger_url"?: string | null,"id"?: string,"is_custom"?: boolean,"name": string,"order_batch_id"?: string | null,"ordered_at"?: string | null,"ordered_by"?: string | null,"quantity": number,"removed_at"?: string | null,"removed_by"?: string | null,"request_id": string,"status"?: string,"team_id": string,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "catalog_item_id"?: string | null,"created_at"?: string,"custom_note"?: string | null,"custom_url"?: string | null,"grainger_sku"?: string | null,"grainger_url"?: string | null,"id"?: string,"is_custom"?: boolean,"name"?: string,"order_batch_id"?: string | null,"ordered_at"?: string | null,"ordered_by"?: string | null,"quantity"?: number,"removed_at"?: string | null,"removed_by"?: string | null,"request_id"?: string,"status"?: string,"team_id"?: string,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_items_catalog_item_id_team_id_fkey"
      columns: ["catalog_item_id","team_id"]
isOneToOne: false
      referencedRelation: "catalog_items"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "request_items_order_batch_id_team_id_fkey"
      columns: ["order_batch_id","team_id"]
isOneToOne: false
      referencedRelation: "order_batches"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "request_items_ordered_by_fkey"
      columns: ["ordered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_items_removed_by_fkey"
      columns: ["removed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_items_request_id_team_id_fkey"
      columns: ["request_id","team_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"requests": {
                  Row: {
                    "created_at": string,"id": string,"note": string | null,"ordered_at": string | null,"removed_at": string | null,"status": string,"team_id": string,"technician_id": string,"technician_name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"ordered_at"?: string | null,"removed_at"?: string | null,"status"?: string,"team_id": string,"technician_id": string,"technician_name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"ordered_at"?: string | null,"removed_at"?: string | null,"status"?: string,"team_id"?: string,"technician_id"?: string,"technician_name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requests_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_technician_id_team_id_fkey"
      columns: ["technician_id","team_id"]
isOneToOne: false
      referencedRelation: "technicians"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"last_seen_at": string,"notify_new_requests": boolean,"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"last_seen_at"?: string,"notify_new_requests"?: boolean,"team_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"last_seen_at"?: string,"notify_new_requests"?: boolean,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "created_at": string,"id": string,"is_active": boolean,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"technicians": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"last_request_at": string | null,"name": string,"name_key": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"last_request_at"?: string | null,"name": string,"name_key": string,"team_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"last_request_at"?: string | null,"name"?: string,"name_key"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "technicians_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "check_rate_limit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"is_super_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_team_member":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"mark_items_ordered":
{ Args: { "p_item_ids": (string)[],"p_reference"?: string,"p_team_id": string }; Returns: number
                           },
"mark_items_requested":
{ Args: { "p_item_ids": (string)[],"p_team_id": string }; Returns: number
                           },
"merge_technicians":
{ Args: { "p_from": string,"p_into": string,"p_team_id": string }; Returns: undefined
                           },
"normalize_name":
{ Args: { "p": string }; Returns: string
                           },
"refresh_request_status":
{ Args: { "p_request_id": string }; Returns: undefined
                           },
"submit_request":
{ Args: { "p_items": Json,"p_note"?: string,"p_slug": string,"p_technician_name": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
