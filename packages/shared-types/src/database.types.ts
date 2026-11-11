
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "audit_logs": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"id": number,"new_data": Json | null,"old_data": Json | null,"record_id": string,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id": string,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"id"?: never,"new_data"?: Json | null,"old_data"?: Json | null,"record_id"?: string,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buyers": {
                  Row: {
                    "address": string | null,"created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "buyers_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"doc_counters": {
                  Row: {
                    "last_no": number,"period": string,"prefix": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_no"?: number,"period": string,"prefix": string
                  }
                  Update: {
                    "last_no"?: number,"period"?: string,"prefix"?: string
                  }
                  Relationships: [
                    
                  ]
                },"inbound_items": {
                  Row: {
                    "base_qty": number | null,"factor": number,"id": string,"inbound_id": string,"input_qty": number,"item_id": string,"unit_id": string,"unit_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_qty"?: never,"factor": number,"id"?: string,"inbound_id": string,"input_qty": number,"item_id": string,"unit_id": string,"unit_name": string
                  }
                  Update: {
                    "base_qty"?: never,"factor"?: number,"id"?: string,"inbound_id"?: string,"input_qty"?: number,"item_id"?: string,"unit_id"?: string,"unit_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbound_items_inbound_id_fkey"
      columns: ["inbound_id"]
isOneToOne: false
      referencedRelation: "inbound_transactions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbound_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbound_items_unit_id_fkey"
      columns: ["unit_id"]
isOneToOne: false
      referencedRelation: "item_units"
      referencedColumns: ["id"]
    }
                  ]
                },"inbound_transactions": {
                  Row: {
                    "created_at": string,"created_by": string,"doc_no": string,"id": string,"idempotency_key": string,"location_id": string,"notes": string | null,"transaction_date": string,"vendor_id": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"doc_no": string,"id"?: string,"idempotency_key": string,"location_id": string,"notes"?: string | null,"transaction_date": string,"vendor_id": string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"doc_no"?: string,"id"?: string,"idempotency_key"?: string,"location_id"?: string,"notes"?: string | null,"transaction_date"?: string,"vendor_id"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inbound_transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbound_transactions_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbound_transactions_vendor_id_fkey"
      columns: ["vendor_id"]
isOneToOne: false
      referencedRelation: "vendors"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inbound_transactions_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"item_units": {
                  Row: {
                    "created_at": string,"factor": number,"id": string,"is_active": boolean,"is_base": boolean,"item_id": string,"unit_name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"factor": number,"id"?: string,"is_active"?: boolean,"is_base"?: boolean,"item_id": string,"unit_name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"factor"?: number,"id"?: string,"is_active"?: boolean,"is_base"?: boolean,"item_id"?: string,"unit_name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_units_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "base_unit": string,"created_at": string,"id": string,"is_active": boolean,"min_stock": number,"name": string,"sku": string,"type": Database["public"]['Enums']["item_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "base_unit": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"min_stock"?: number,"name": string,"sku": string,"type": Database["public"]['Enums']["item_type"],"updated_at"?: string
                  }
                  Update: {
                    "base_unit"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"min_stock"?: number,"name"?: string,"sku"?: string,"type"?: Database["public"]['Enums']["item_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"locations": {
                  Row: {
                    "address": string | null,"code": string,"created_at": string,"deleted_at": string | null,"id": string,"is_active": boolean,"is_inbound_hub": boolean,"name": string,"type": Database["public"]['Enums']["location_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"code": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_active"?: boolean,"is_inbound_hub"?: boolean,"name": string,"type": Database["public"]['Enums']["location_type"],"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"code"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"is_active"?: boolean,"is_inbound_hub"?: boolean,"name"?: string,"type"?: Database["public"]['Enums']["location_type"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"product_locations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"finished_item_id": string,"location_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"finished_item_id": string,"location_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"finished_item_id"?: string,"location_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_locations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_locations_finished_item_id_fkey"
      columns: ["finished_item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_locations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"product_packagings": {
                  Row: {
                    "finished_item_id": string,"packaging_item_id": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "finished_item_id": string,"packaging_item_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "finished_item_id"?: string,"packaging_item_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_packagings_finished_item_id_fkey"
      columns: ["finished_item_id"]
isOneToOne: true
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_packagings_packaging_item_id_fkey"
      columns: ["packaging_item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "product_packagings_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string,"id": string,"is_active": boolean,"role": Database["public"]['Enums']["user_role"],"updated_at": string,"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name": string,"id": string,"is_active"?: boolean,"role": Database["public"]['Enums']["user_role"],"updated_at"?: string,"username": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"is_active"?: boolean,"role"?: Database["public"]['Enums']["user_role"],"updated_at"?: string,"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stock_adjustment_items": {
                  Row: {
                    "adjustment_id": string,"delta": number | null,"id": string,"item_id": string,"physical_qty": number,"system_qty": number
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_id": string,"delta"?: never,"id"?: string,"item_id": string,"physical_qty": number,"system_qty": number
                  }
                  Update: {
                    "adjustment_id"?: string,"delta"?: never,"id"?: string,"item_id"?: string,"physical_qty"?: number,"system_qty"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
      columns: ["adjustment_id"]
isOneToOne: false
      referencedRelation: "stock_adjustments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustment_items_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_adjustments": {
                  Row: {
                    "adjustment_date": string,"created_at": string,"created_by": string,"doc_no": string,"id": string,"idempotency_key": string,"kind": string,"location_id": string,"reason": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adjustment_date": string,"created_at"?: string,"created_by": string,"doc_no": string,"id"?: string,"idempotency_key": string,"kind": string,"location_id": string,"reason": string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "adjustment_date"?: string,"created_at"?: string,"created_by"?: string,"doc_no"?: string,"id"?: string,"idempotency_key"?: string,"kind"?: string,"location_id"?: string,"reason"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_adjustments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_adjustments_voided_by_fkey"
      columns: ["voided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_movements": {
                  Row: {
                    "balance_after": number,"created_at": string,"created_by": string,"from_location_id": string | null,"id": number,"item_id": string,"location_id": string,"movement_type": Database["public"]['Enums']["movement_type"],"quantity_delta": number,"ref_doc_no": string,"ref_id": string,"ref_type": string,"to_location_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "balance_after": number,"created_at"?: string,"created_by": string,"from_location_id"?: string | null,"id"?: never,"item_id": string,"location_id": string,"movement_type": Database["public"]['Enums']["movement_type"],"quantity_delta": number,"ref_doc_no": string,"ref_id": string,"ref_type": string,"to_location_id"?: string | null
                  }
                  Update: {
                    "balance_after"?: number,"created_at"?: string,"created_by"?: string,"from_location_id"?: string | null,"id"?: never,"item_id"?: string,"location_id"?: string,"movement_type"?: Database["public"]['Enums']["movement_type"],"quantity_delta"?: number,"ref_doc_no"?: string,"ref_id"?: string,"ref_type"?: string,"to_location_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_movements_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_from_location_id_fkey"
      columns: ["from_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stock_movements_to_location_id_fkey"
      columns: ["to_location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"stocks": {
                  Row: {
                    "item_id": string,"location_id": string,"quantity": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "item_id": string,"location_id": string,"quantity"?: number,"updated_at"?: string
                  }
                  Update: {
                    "item_id"?: string,"location_id"?: string,"quantity"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stocks_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stocks_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"user_locations": {
                  Row: {
                    "created_at": string,"created_by": string | null,"location_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"location_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"location_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_locations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_locations_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "user_locations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vendors": {
                  Row: {
                    "address": string | null,"created_at": string,"created_by": string | null,"id": string,"is_active": boolean,"name": string,"notes": string | null,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"notes"?: string | null,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vendors_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "stock_levels": {
                  Row: {
                    "base_unit": string,"is_low": boolean | null,"item_id": string,"item_name": string,"item_type": Database["public"]['Enums']["item_type"],"location_code": string,"location_id": string,"location_name": string,"location_type": Database["public"]['Enums']["location_type"],"min_stock": number,"quantity": number,"sku": string,"updated_at": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "stocks_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "stocks_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "admin_update_user":
{ Args: { "p_full_name": string,"p_is_active": boolean,"p_location_ids": (string)[],"p_role": Database["public"]['Enums']["user_role"],"p_user_id": string }; Returns: undefined
                           },
"create_inbound":
{ Args: { "p_idempotency_key": string,"p_items": Json,"p_notes": string,"p_transaction_date": string,"p_vendor_id": string }; Returns: Json
                           },
"create_stock_adjustment":
{ Args: { "p_adjustment_date": string,"p_idempotency_key": string,"p_items": Json,"p_kind": string,"p_location_id": string,"p_reason": string }; Returns: Json
                           },
"get_my_context":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"void_transaction":
{ Args: { "p_reason": string,"p_ref_id": string,"p_ref_type": string }; Returns: Json
                           }
          }
          Enums: {
            "item_type": "PACKAGING"|"FINISHED_GOOD","location_type": "WAREHOUSE"|"FACTORY"|"SALES_WAREHOUSE","movement_type": "INBOUND"|"SHIPMENT_PICKUP"|"SHIPMENT_RECEIVE"|"SHIPMENT_RETURN"|"PRODUCTION_CONSUME"|"PRODUCTION_RESULT"|"DISTRIBUTION"|"OPENING_BALANCE"|"ADJUSTMENT_IN"|"ADJUSTMENT_OUT"|"VOID_REVERSAL","user_role": "SUPER_OWNER"|"ADMIN_GUDANG"|"OWNER_PABRIK"|"DRIVER"
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
  "public": {
          Enums: {
            "item_type": ["PACKAGING", "FINISHED_GOOD"],"location_type": ["WAREHOUSE", "FACTORY", "SALES_WAREHOUSE"],"movement_type": ["INBOUND", "SHIPMENT_PICKUP", "SHIPMENT_RECEIVE", "SHIPMENT_RETURN", "PRODUCTION_CONSUME", "PRODUCTION_RESULT", "DISTRIBUTION", "OPENING_BALANCE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "VOID_REVERSAL"],"user_role": ["SUPER_OWNER", "ADMIN_GUDANG", "OWNER_PABRIK", "DRIVER"]
          }
        }
} as const
